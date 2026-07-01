import React, { useState, useRef } from 'react';
import {
  ArrowLeft, Download, Film, RefreshCw, Sliders,
  Type, Clock, Zap, Palette, Play, ChevronDown
} from 'lucide-react';
import './VideoEditor.css';

const API_BASE = 'http://localhost:5000';

const STYLE_NAMES = {
  1: 'Hormozi Pop',
  2: 'Cinematic Drama',
  3: 'Cyberpunk Neon',
  4: 'Retro Film',
  5: 'Bold Minimalist',
  6: 'Glitch Warp',
  7: 'Comic Book',
  8: 'Clean Corporate',
  9: 'Fast & Furious',
  10: 'Aesthetic Vlog'
};

const CAPTION_PREVIEW_STYLES = {
  1:  { fontFamily: 'Impact, Arial Black, sans-serif', color: '#fff', textShadow: '0 0 8px #00ff00, 2px 2px 0 #000', textTransform: 'uppercase', fontSize: '1.4rem' },
  2:  { fontFamily: 'Georgia, Times New Roman, serif', color: '#efefef', textShadow: '1px 1px 3px rgba(0,0,0,0.8)', fontSize: '1.1rem' },
  3:  { fontFamily: 'Courier New, monospace', color: '#00ffff', textShadow: '0 0 10px #ff00ff, 0 0 20px #00ffff', fontSize: '1.2rem' },
  4:  { fontFamily: 'Courier New, monospace', color: '#fff', background: 'rgba(0,0,0,0.6)', padding: '4px 12px', borderRadius: '2px', fontSize: '1rem' },
  5:  { fontFamily: 'Inter, Arial, sans-serif', color: '#fff', textShadow: '2px 2px 0 #000', fontSize: '1.3rem' },
  6:  { fontFamily: 'Arial Black, Impact, sans-serif', color: '#ffff00', textShadow: '0 0 6px #ff0000, 2px 2px 0 #000', textTransform: 'uppercase', fontSize: '1.5rem' },
  7:  { fontFamily: 'Comic Sans MS, cursive', color: '#ffff00', textShadow: '3px 3px 0 #000, -1px -1px 0 #000', fontSize: '1.3rem' },
  8:  { fontFamily: 'Roboto, Arial, sans-serif', color: '#fff', background: 'rgba(51,51,51,0.85)', padding: '6px 14px', borderRadius: '4px', fontSize: '0.95rem' },
  9:  { fontFamily: 'Impact, Arial Black, sans-serif', color: '#ff6600', textShadow: '2px 2px 0 #000', textTransform: 'uppercase', fontStyle: 'italic', fontSize: '1.6rem' },
  10: { fontFamily: 'Pacifico, Comic Sans MS, cursive', color: '#ffc0d8', textShadow: '1px 1px 2px rgba(128,128,128,0.6)', fontSize: '1.2rem' },
};

const ANIMATION_OPTIONS = [
  { id: 0, name: 'Ken Burns In',     icon: '🔍' },
  { id: 1, name: 'Ken Burns Out',    icon: '🔭' },
  { id: 2, name: 'Slide Left',       icon: '⬅️' },
  { id: 3, name: 'Slide Right',      icon: '➡️' },
  { id: 4, name: 'Slide Up',         icon: '⬆️' },
  { id: 5, name: 'Flutters',         icon: '🦋' },
  { id: 6, name: 'Echo Pull',        icon: '🌀' },
  { id: 7, name: 'Pull Vibration',   icon: '📳' },
  { id: 8, name: 'Mist Dissipates',  icon: '🌫️' },
  { id: 9, name: 'Slash Vibration',  icon: '⚡' },
];

export default function VideoEditor({ video, onClose, onExportComplete }) {
  const meta = video.editorMeta || {};
  const assets = meta.assets || [];

  const buildInitialSlides = () => {
    const uniformDuration = meta.slideDuration || 3;
    const allowed = meta.allowedAnimations || [0, 1, 2];
    return assets.map((filename, i) => ({
      asset: filename,
      duration: uniformDuration,
      animation: allowed[(i + (meta.variationIndex || 0)) % allowed.length] || 0
    }));
  };

  const [slides, setSlides] = useState(buildInitialSlides);
  const [selectedSlide, setSelectedSlide] = useState(0);
  const [stylePreset, setStylePreset] = useState(video.stylePreset || 1);
  const [titleText, setTitleText] = useState(video.title || '');
  const [captionRows, setCaptionRows] = useState(() => {
    if (meta.tableRows && meta.tableRows.length > 0) {
      return meta.tableRows.map(r => ({
        quote: r.quote || '',
        startTime: r.startTime || 0,
        textAnimation: r.textAnimation || 'none',
        textBackground: r.textBackground || 'black'
      }));
    }
    return [{ quote: video.quote || '', startTime: 0, textAnimation: 'none', textBackground: 'black' }];
  });
  const [animationSpeed, setAnimationSpeed] = useState(meta.animationSpeed || 'normal');
  const [voiceoverEnabled, setVoiceoverEnabled] = useState(meta.voiceoverEnabled || false);
  const [voiceStyle, setVoiceStyle] = useState(meta.voiceStyle || 'deep-cinematic');
  const [musicVolume, setMusicVolume] = useState(meta.musicVolume ?? 0.15);
  const [captionPosition, setCaptionPosition] = useState(meta.captionPosition || 'bottom');
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(`${API_BASE}${video.url}`);
  const videoRef = useRef(null);

  const totalDuration = slides.reduce((sum, s) => sum + s.duration, 0);

  const updateSlide = (index, field, value) => {
    setSlides(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      const res = await fetch(`${API_BASE}/api/re-render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assets: slides.map(s => s.asset),
          slideOverrides: slides.map(s => ({ duration: s.duration, animation: s.animation })),
          stylePreset,
          titleText,
          quoteText: captionRows.map(r => r.quote).join('. '),
          tableRows: captionRows,
          voiceoverEnabled,
          voiceStyle,
          musicTrack: meta.musicTrack,
          musicVolume,
          animationSpeed,
          musicStartTime: 0,
          musicSectionDuration: 0,
          sameTextThroughout: meta.sameTextThroughout || false,
          captionPosition
        })
      });
      const data = await res.json();
      if (data.success) {
        setPreviewUrl(`${API_BASE}${data.video.url}?t=${Date.now()}`);
        if (onExportComplete) onExportComplete(data.video);
      } else {
        setExportError(data.error || 'Export failed');
      }
    } catch (err) {
      setExportError('Could not connect to server');
    } finally {
      setIsExporting(false);
    }
  };

  const downloadVideo = (url, filename) => {
    fetch(url)
      .then(res => res.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename || 'video.mp4';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
      })
      .catch(() => window.open(url, '_blank'));
  };

  const current = slides[selectedSlide];

  return (
    <div className="editor-overlay">
      <div className="editor-header">
        <h2>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}>
            <ArrowLeft size={14} /> Back
          </button>
          <Film size={18} style={{ color: 'var(--accent-purple)' }} /> Video Editor
        </h2>
        <div className="header-actions">
          {exportError && <span style={{ color: '#f87171', fontSize: '0.8rem' }}>{exportError}</span>}
          <button className="btn btn-secondary" onClick={() => downloadVideo(previewUrl, 'edited_video.mp4')} style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}>
            <Download size={14} /> Download
          </button>
          <button className="btn btn-accent" onClick={handleExport} disabled={isExporting} style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}>
            {isExporting ? <RefreshCw size={14} className="spin" /> : <Zap size={14} />}
            {isExporting ? 'Exporting...' : 'Export Video'}
          </button>
        </div>
      </div>

      <div className="editor-body">
        {/* Video Preview */}
        <div className="editor-preview">
          <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', maxHeight: '100%' }}>
            <video ref={videoRef} src={previewUrl} controls autoPlay key={previewUrl}
              style={{ maxWidth: '100%', maxHeight: '100%', aspectRatio: '4/5', borderRadius: '12px', display: 'block' }} />
            {/* Live caption overlay — shows first caption row with text */}
            {captionRows.filter(r => r.quote.trim()).length > 0 && (
              <div style={{
                position: 'absolute',
                left: 0, right: 0,
                ...(captionPosition === 'top' ? { top: '5%' } : captionPosition === 'center' ? { top: '50%', transform: 'translateY(-50%)' } : { bottom: '12%' }),
                textAlign: 'center',
                padding: '0 1rem',
                pointerEvents: 'none',
                zIndex: 2,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.3rem',
                alignItems: 'center'
              }}>
                {captionRows.filter(r => r.quote.trim()).slice(0, 3).map((row, idx) => {
                  const bgStyle = row.textBackground === 'black' ? { background: 'rgba(0,0,0,0.6)', padding: '4px 12px', borderRadius: '4px' }
                    : row.textBackground === 'dark-gray' ? { background: 'rgba(51,51,51,0.7)', padding: '4px 12px', borderRadius: '4px' }
                    : {};
                  return (
                    <span key={idx} style={{
                      display: 'inline-block',
                      fontWeight: 700,
                      lineHeight: 1.3,
                      letterSpacing: '0.02em',
                      maxWidth: '90%',
                      wordBreak: 'break-word',
                      ...(CAPTION_PREVIEW_STYLES[stylePreset] || CAPTION_PREVIEW_STYLES[1]),
                      ...bgStyle,
                      opacity: idx === 0 ? 1 : 0.5
                    }}>
                      {row.quote.trim()}
                      <span style={{ fontSize: '0.55rem', marginLeft: '0.4rem', opacity: 0.6 }}>@{row.startTime}s</span>
                    </span>
                  );
                })}
              </div>
            )}
            {/* Live title overlay */}
            {titleText && (
              <div style={{
                position: 'absolute',
                top: '3%', left: 0, right: 0,
                textAlign: 'center',
                pointerEvents: 'none',
                zIndex: 2
              }}>
                <span style={{
                  fontFamily: 'Impact, Arial Black, sans-serif',
                  color: '#fff',
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                  textTransform: 'uppercase'
                }}>
                  {titleText}
                </span>
              </div>
            )}
          </div>
          {isExporting && (
            <div className="editor-exporting-overlay">
              <RefreshCw size={36} className="spin" style={{ color: 'var(--accent-purple)' }} />
              <p>Re-rendering video with your changes...</p>
            </div>
          )}
        </div>

        {/* Properties Panel */}
        <div className="editor-props">
          {current && (
            <>
              <div className="prop-section">
                <h3><Sliders size={14} /> Slide {selectedSlide + 1} Properties</h3>
                <div className="prop-row">
                  <label><Clock size={12} /> Duration: {current.duration.toFixed(1)}s</label>
                  <input type="range" min="0.5" max="15" step="0.5" value={current.duration}
                    onChange={e => updateSlide(selectedSlide, 'duration', parseFloat(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--accent-purple)' }} />
                </div>
                <div className="prop-row">
                  <label>Animation</label>
                  <div className="anim-picker-grid">
                    {ANIMATION_OPTIONS.map(anim => (
                      <button key={anim.id}
                        className={current.animation === anim.id ? 'active' : ''}
                        onClick={() => updateSlide(selectedSlide, 'animation', anim.id)}>
                        <span>{anim.icon}</span> {anim.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="prop-section">
            <h3><Palette size={14} /> Global Style</h3>
            <div className="prop-row">
              <label>Subtitle Preset</label>
              <select className="form-select" value={stylePreset} onChange={e => setStylePreset(parseInt(e.target.value))}
                style={{ fontSize: '0.8rem', padding: '0.45rem' }}>
                {Object.entries(STYLE_NAMES).map(([id, name]) => (
                  <option key={id} value={id}>Style {id}: {name}</option>
                ))}
              </select>
            </div>
            <div className="prop-row">
              <label>Animation Speed</label>
              <select className="form-select" value={animationSpeed} onChange={e => setAnimationSpeed(e.target.value)}
                style={{ fontSize: '0.8rem', padding: '0.45rem' }}>
                <option value="slow">🐢 Slow</option>
                <option value="normal">▶️ Normal</option>
                <option value="fast">⚡ Fast</option>
              </select>
            </div>
            <div className="prop-row">
              <label>Caption Position</label>
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                {[
                  { value: 'top', label: '⬆ Top' },
                  { value: 'center', label: '⬛ Center' },
                  { value: 'bottom', label: '⬇ Bottom' }
                ].map(pos => (
                  <button key={pos.value}
                    onClick={() => setCaptionPosition(pos.value)}
                    className={`btn ${captionPosition === pos.value ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, padding: '0.3rem', fontSize: '0.7rem' }}>
                    {pos.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="prop-row">
              <label>Voiceover</label>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button className={`btn ${voiceoverEnabled ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setVoiceoverEnabled(true)}
                  style={{ flex: 1, padding: '0.35rem', fontSize: '0.75rem' }}>On</button>
                <button className={`btn ${!voiceoverEnabled ? 'btn-accent' : 'btn-secondary'}`}
                  onClick={() => setVoiceoverEnabled(false)}
                  style={{ flex: 1, padding: '0.35rem', fontSize: '0.75rem' }}>Off</button>
              </div>
            </div>
            {voiceoverEnabled && (
              <div className="prop-row">
                <label>Voice</label>
                <select className="form-select" value={voiceStyle} onChange={e => setVoiceStyle(e.target.value)}
                  style={{ fontSize: '0.8rem', padding: '0.45rem' }}>
                  <option value="deep-cinematic">🎙️ Deep Cinematic</option>
                  <option value="female-narrator">👩 Female Narrator</option>
                </select>
              </div>
            )}
            {meta.musicTrack && (
              <div className="prop-row">
                <label>🔊 Music Volume: {Math.round(musicVolume * 100)}%</label>
                <input type="range" min="0" max="1" step="0.05" value={musicVolume}
                  onChange={e => setMusicVolume(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-cyber)' }} />
              </div>
            )}
          </div>

          <div className="prop-section">
            <h3><Type size={14} /> Text Overlay</h3>
            <div className="prop-row">
              <label>Title (first 2.5s)</label>
              <input type="text" value={titleText} onChange={e => setTitleText(e.target.value)}
                placeholder="Title overlay..." />
            </div>
            {captionRows.map((row, idx) => (
              <div key={idx} style={{ background: 'var(--bg-primary)', borderRadius: '6px', padding: '0.6rem', marginBottom: '0.5rem', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--accent-purple)' }}>Caption {idx + 1}</label>
                  {captionRows.length > 1 && (
                    <button onClick={() => setCaptionRows(prev => prev.filter((_, i) => i !== idx))}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.7rem' }}>✕</button>
                  )}
                </div>
                <textarea rows={2} value={row.quote}
                  onChange={e => setCaptionRows(prev => prev.map((r, i) => i === idx ? { ...r, quote: e.target.value } : r))}
                  placeholder="Caption text..."
                  style={{ width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)', padding: '0.4rem', borderRadius: '4px', fontFamily: 'var(--font-sans)', fontSize: '0.8rem', resize: 'vertical', outline: 'none', marginBottom: '0.35rem' }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.3rem' }}>
                  <div>
                    <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block' }}>Start (s)</label>
                    <input type="number" min="0" step="0.5" value={row.startTime}
                      onChange={e => setCaptionRows(prev => prev.map((r, i) => i === idx ? { ...r, startTime: parseFloat(e.target.value) || 0 } : r))}
                      style={{ width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)', padding: '0.3rem', borderRadius: '4px', fontSize: '0.75rem', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block' }}>Animation</label>
                    <select value={row.textAnimation}
                      onChange={e => setCaptionRows(prev => prev.map((r, i) => i === idx ? { ...r, textAnimation: e.target.value } : r))}
                      className="form-select" style={{ padding: '0.3rem', fontSize: '0.7rem' }}>
                      <option value="none">None</option>
                      <option value="typed">Typed</option>
                      <option value="blur-out">Blur Out</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block' }}>Background</label>
                    <select value={row.textBackground}
                      onChange={e => setCaptionRows(prev => prev.map((r, i) => i === idx ? { ...r, textBackground: e.target.value } : r))}
                      className="form-select" style={{ padding: '0.3rem', fontSize: '0.7rem' }}>
                      <option value="black">Black</option>
                      <option value="dark-gray">Dark Gray</option>
                      <option value="none">None</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
            <button onClick={() => setCaptionRows(prev => [...prev, { quote: '', startTime: 0, textAnimation: 'none', textBackground: 'black' }])}
              className="btn btn-secondary" style={{ width: '100%', padding: '0.35rem', fontSize: '0.75rem' }}>
              + Add Caption
            </button>
          </div>
        </div>

        {/* Timeline */}
        <div className="editor-timeline">
          <div className="timeline-header">
            <span><Film size={12} /> Timeline — {slides.length} slides</span>
            <span>Total: {totalDuration.toFixed(1)}s</span>
          </div>
          <div className="timeline-track">
            {slides.map((slide, i) => {
              const widthPercent = Math.max((slide.duration / totalDuration) * 100, 8);
              const ext = slide.asset.split('.').pop().toLowerCase();
              const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);
              const thumbUrl = `${API_BASE}/uploads/${slide.asset}`;
              return (
                <div key={i}
                  className={`timeline-slide ${selectedSlide === i ? 'selected' : ''}`}
                  style={{ flex: `${widthPercent} 0 0` }}
                  onClick={() => setSelectedSlide(i)}>
                  {isImage ? (
                    <img src={thumbUrl} alt={`Slide ${i + 1}`} className="slide-thumb" />
                  ) : (
                    <video src={thumbUrl} muted className="slide-thumb" />
                  )}
                  <span className="slide-duration-badge">{slide.duration.toFixed(1)}s</span>
                  <div className="slide-info">
                    {ANIMATION_OPTIONS[slide.animation]?.icon} {ANIMATION_OPTIONS[slide.animation]?.name || `Anim ${slide.animation}`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
