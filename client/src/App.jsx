import React, { useState, useEffect, useRef } from 'react';
import {
  Upload, Trash2, Plus, Play, Download, Sparkles,
  Settings, RefreshCw, Music, Film, Image as ImageIcon,
  CheckCircle2, AlertCircle, X, Layers, Mic, MicOff, Zap, Pencil
} from 'lucide-react';
import VideoEditor from './VideoEditor.jsx';

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

const API_BASE = 'http://localhost:5000';

export default function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [showApiSettings, setShowApiSettings] = useState(!localStorage.getItem('gemini_api_key'));
  
  const [assets, setAssets] = useState([]);
  const [musicTrack, setMusicTrack] = useState(null);
  const [musicList, setMusicList] = useState([]);
  
  const [voiceStyle, setVoiceStyle] = useState('deep-cinematic');
  const [stylePreset, setStylePreset] = useState('1');
  const [variationCount, setVariationCount] = useState(1);
  const [orderOfInsertion, setOrderOfInsertion] = useState(true);
  const [sameTextThroughout, setSameTextThroughout] = useState(false);
  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const [captionPosition, setCaptionPosition] = useState('bottom');
  const [voiceoverEnabled, setVoiceoverEnabled] = useState(true);
  const [slideDuration, setSlideDuration] = useState(3);
  const [musicVolume, setMusicVolume] = useState(0.15);
  const [animationSpeed, setAnimationSpeed] = useState('normal');
  const [allowedAnimations, setAllowedAnimations] = useState([0, 1, 2]);
  
  // Trimming Background Music States
  const [musicSections, setMusicSections] = useState([]);
  const [enableMusicTrim, setEnableMusicTrim] = useState(false);
  const [playingSectionIndex, setPlayingSectionIndex] = useState(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [sameMusicSectionForAll, setSameMusicSectionForAll] = useState(true);

  // Per-video original audio settings: { [assetId]: { useOriginalAudio: bool, volume: 0-1 } }
  const [videoAudioSettings, setVideoAudioSettings] = useState({});
  const [copyAudioSettingToAll, setCopyAudioSettingToAll] = useState(false);

  const audioPlaybackRef = useRef(null);
  const playbackTimeoutRef = useRef(null);
  
  const [tableRows, setTableRows] = useState([
    { title: 'Visual Hook', quote: 'Stop doing this mistake today if you want to scale your content fast.', startTime: 0, textAnimation: 'none', textBackground: 'black' }
  ]);
  const [topicInput, setTopicInput] = useState('');
  const [isGeneratingQuotes, setIsGeneratingQuotes] = useState(false);
  
  const [jobs, setJobs] = useState([]);
  const [completedVideos, setCompletedVideos] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('reelsflow_videos') || '[]');
    } catch { return []; }
  });
  const [showDeletePrompt, setShowDeletePrompt] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [errorBanner, setErrorBanner] = useState(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [editorVideo, setEditorVideo] = useState(null);

  const fileInputRef = useRef(null);
  const musicInputRef = useRef(null);

  useEffect(() => { localStorage.setItem('gemini_api_key', apiKey); }, [apiKey]);
  useEffect(() => { localStorage.setItem('reelsflow_videos', JSON.stringify(completedVideos.slice(0, 20))); }, [completedVideos]);

  // Synchronize musicSections count to variationCount without wiping edits
  useEffect(() => {
    if (musicTrack) {
      const audioUrl = `${API_BASE}/uploads/${musicTrack}`;
      const tempAudio = new Audio(audioUrl);
      const onLoadedMetadata = () => {
        const duration = tempAudio.duration;
        setAudioDuration(duration);
        setMusicSections(prev => {
          const updated = [...prev];
          if (updated.length < variationCount) {
            for (let i = updated.length; i < variationCount; i++) {
              updated.push({
                start: 0,
                end: Math.min(duration, 15)
              });
            }
          } else if (updated.length > variationCount) {
            updated.splice(variationCount);
          }
          return updated.map(sec => ({
            start: Math.min(sec.start, duration),
            end: Math.min(sec.end, duration)
          }));
        });
      };
      tempAudio.addEventListener('loadedmetadata', onLoadedMetadata);
      return () => {
        tempAudio.removeEventListener('loadedmetadata', onLoadedMetadata);
      };
    } else {
      setAudioDuration(0);
      setMusicSections([]);
    }
  }, [musicTrack, variationCount]);

  // Playback handlers to audition a specific audio section
  const handlePlaySection = (index, start, end) => {
    if (playingSectionIndex !== null) {
      handleStopSection();
      if (playingSectionIndex === index) {
        return; // toggle off
      }
    }

    if (!musicTrack) return;
    const audioUrl = `${API_BASE}/uploads/${musicTrack}`;
    const audio = new Audio(audioUrl);
    audio.currentTime = start;
    audio.volume = musicVolume;
    audioPlaybackRef.current = audio;
    setPlayingSectionIndex(index);

    audio.play().then(() => {
      const durationMs = (end - start) * 1000;
      playbackTimeoutRef.current = setTimeout(() => {
        handleStopSection();
      }, durationMs);
    }).catch(err => {
      console.error('Audio play failed', err);
      setPlayingSectionIndex(null);
    });

    audio.addEventListener('ended', () => {
      handleStopSection();
    });
  };

  const handleStopSection = () => {
    if (audioPlaybackRef.current) {
      audioPlaybackRef.current.pause();
      audioPlaybackRef.current = null;
    }
    if (playbackTimeoutRef.current) {
      clearTimeout(playbackTimeoutRef.current);
      playbackTimeoutRef.current = null;
    }
    setPlayingSectionIndex(null);
  };

  useEffect(() => {
    fetchMedia();
    const interval = setInterval(pollJobs, 3000);
    return () => {
      clearInterval(interval);
      if (audioPlaybackRef.current) audioPlaybackRef.current.pause();
      if (playbackTimeoutRef.current) clearTimeout(playbackTimeoutRef.current);
    };
  }, []);

  const fetchMedia = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/media`);
      const data = await res.json();
      if (data.music) setMusicList(data.music);
    } catch (err) { console.error('Error fetching media:', err); }
  };

  const uploadFiles = async (files, targetType = 'assets') => {
    setIsUploading(true);
    setErrorBanner(null);
    const formData = new FormData();
    for (const file of files) formData.append('files', file);

    try {
      const res = await fetch(`${API_BASE}/api/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        if (targetType === 'music') {
          const audioFiles = data.files.filter(f => f.type === 'music');
          if (audioFiles.length > 0) {
            setMusicTrack(audioFiles[0].filename);
            setMusicList(prev => [...audioFiles, ...prev]);
          } else {
            setErrorBanner('No valid audio files found. Please upload MP3, WAV or M4A.');
          }
        } else {
          const visualFiles = data.files.filter(f => f.type === 'image' || f.type === 'video');
          if (visualFiles.length > 0) {
            const withDurations = await Promise.all(visualFiles.map(f => {
              if (f.type === 'video') {
                return new Promise(resolve => {
                  const vid = document.createElement('video');
                  vid.preload = 'metadata';
                  vid.onloadedmetadata = () => { resolve({ ...f, duration: vid.duration }); URL.revokeObjectURL(vid.src); };
                  vid.onerror = () => resolve({ ...f, duration: 0 });
                  vid.src = `${API_BASE}${f.path}`;
                });
              }
              return Promise.resolve({ ...f, duration: 0 });
            }));
            setAssets(prev => [...prev, ...withDurations]);
          }
          else setErrorBanner('No valid image or video assets found.');
        }
      } else {
        setErrorBanner(data.error || 'Upload failed');
      }
    } catch (err) {
      setErrorBanner('Could not connect to server upload API');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };
  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files?.[0]) uploadFiles(e.dataTransfer.files, 'assets');
  };

  const toggleAnimation = (id) => {
    setAllowedAnimations(prev => {
      if (prev.includes(id)) return prev.filter(a => a !== id);
      if (prev.length >= 3) {
        setErrorBanner('You can select up to 3 animations. Remove one first.');
        return prev;
      }
      return [...prev, id];
    });
  };

  const generateQuotesFromAI = async () => {
    if (!topicInput.trim()) { setErrorBanner('Please type a topic first.'); return; }
    if (!apiKey) { setErrorBanner('Please add your Gemini API Key first.'); setShowApiSettings(true); return; }
    setIsGeneratingQuotes(true); setErrorBanner(null);
    try {
      const res = await fetch(`${API_BASE}/api/generate-quotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-gemini-api-key': apiKey },
        body: JSON.stringify({ topic: topicInput, count: 5 })
      });
      const data = await res.json();
      if (data.success && data.quotes) setTableRows(data.quotes.map((q, i) => ({ title: q.title, quote: q.quote, startTime: i * 3, textAnimation: 'none', textBackground: 'black' })));
      else setErrorBanner(data.error || 'Failed to generate quotes');
    } catch (err) {
      setErrorBanner('Error contacting quote generator API');
    } finally {
      setIsGeneratingQuotes(false);
    }
  };

  const addTableRow = () => {
    if (tableRows.length >= 20) { setErrorBanner('Maximum of 20 rows reached.'); return; }
    setTableRows([...tableRows, { title: '', quote: '', startTime: 0, textAnimation: 'none', textBackground: 'black' }]);
  };
  const updateTableRow = (i, field, val) => {
    const u = [...tableRows]; u[i][field] = val; setTableRows(u);
  };
  const deleteTableRow = (i) => {
    const u = tableRows.filter((_, idx) => idx !== i);
    setTableRows(u.length > 0 ? u : [{ title: '', quote: '', startTime: 0, textAnimation: 'none', textBackground: 'black' }]);
  };
  const removeAsset = (id) => setAssets(assets.filter(a => a.id !== id));

  const videoAssets = assets.filter(a => a.type === 'video');

  const getVideoAudioSetting = (assetId) => videoAudioSettings[assetId] || { useOriginalAudio: false, volume: 1.0 };

  const updateVideoAudioSetting = (assetId, updates) => {
    setCopyAudioSettingToAll(false);
    setVideoAudioSettings(prev => ({
      ...prev,
      [assetId]: { ...getVideoAudioSetting(assetId), ...updates }
    }));
  };

  const handleToggleCopyAudioToAll = (checked) => {
    setCopyAudioSettingToAll(checked);
    if (checked && videoAssets.length > 0) {
      const base = getVideoAudioSetting(videoAssets[0].id);
      setVideoAudioSettings(prev => {
        const next = { ...prev };
        videoAssets.forEach(a => { next[a.id] = { ...base }; });
        return next;
      });
    }
  };

  const triggerBulkRender = async () => {
    if (assets.length === 0) { setErrorBanner('Please upload at least one image or video.'); return; }
    const validRows = tableRows.filter(r => r.quote.trim().length > 0);
    if (validRows.length === 0) { setErrorBanner('Please add at least one quote/dialogue row.'); return; }
    if (allowedAnimations.length === 0) { setErrorBanner('Please select at least 1 animation.'); return; }

    const newCount = parseInt(variationCount) || 1;
    if (completedVideos.length + newCount > 20) {
      setShowDeletePrompt(true);
      return;
    }
    await doRender(validRows);
  };

  const doRender = async (validRows) => {
    setIsRendering(true); setErrorBanner(null);
    try {
      const res = await fetch(`${API_BASE}/api/generate-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assets: assets.map(a => a.filename),
          musicTrack,
          voiceStyle,
          stylePreset,
          orderOfInsertion,
          variationCount: parseInt(variationCount) || 1,
          tableRows: validRows,
          voiceoverEnabled,
          slideDuration: parseFloat(slideDuration),
          musicVolume: parseFloat(musicVolume),
          animationSpeed,
          allowedAnimations,
          musicSections: enableMusicTrim ? musicSections : [],
          sameTextThroughout,
          captionPosition,
          captionsEnabled,
          videoAudioSettings
        })
      });
      const data = await res.json();
      if (data.success) {
        setJobs(prev => [{ id: data.jobId, status: 'running', progress: 0, totalVideos: data.totalVideos, videos: [] }, ...prev]);
      } else {
        setErrorBanner(data.error || 'Render failed to start');
      }
    } catch (err) {
      setErrorBanner('Could not submit job to rendering backend');
    } finally {
      setIsRendering(false);
    }
  };

  const pollJobs = async () => {
    setJobs(prevJobs => {
      const active = prevJobs.filter(j => j.status === 'running');
      active.forEach(async (job) => {
        try {
          const res = await fetch(`${API_BASE}/api/status/${job.id}`);
          if (res.status === 404) return;
          const updated = await res.json();
          setJobs(c => c.map(j => j.id === job.id ? updated : j));
          if ((updated.status === 'completed' || updated.status === 'failed') && updated.videos?.length > 0) {
            setCompletedVideos(prev => {
              const existingIds = new Set(prev.map(v => v.filename));
              return [...updated.videos.filter(v => !existingIds.has(v.filename)), ...prev];
            });
          }
        } catch (err) { console.error('Polling job failed:', err); }
      });
      return prevJobs;
    });
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

  const totalOutputCount = variationCount;

  return (
    <div className="app-container">
      <header>
        <div className="header-content">
          <div className="logo-section">
            <h1><Layers size={22} /> ReelsFlow <span style={{ fontSize: '0.8rem', opacity: 0.6, fontWeight: 400 }}>Bulk Creator v2.0</span></h1>
          </div>
          <div className="settings-bar">
            {showApiSettings ? (
              <div className="settings-input-group">
                <Settings size={16} />
                <input type="password" placeholder="Gemini API Key (for AI Auto-Fill)" value={apiKey} onChange={e => setApiKey(e.target.value)} />
                <button onClick={() => setShowApiSettings(false)} className="icon-btn" style={{ width: 22, height: 22 }}><X size={12} /></button>
              </div>
            ) : (
              <button onClick={() => setShowApiSettings(true)} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                <Settings size={14} /> {apiKey ? '✓ API Key Saved' : 'Enter API Key'}
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="main-content">
        <div className="workspace-main">
          {errorBanner && (
            <div className="creator-card" style={{ borderLeft: '4px solid #ef4444', display: 'flex', gap: '0.75rem', alignItems: 'center', background: 'rgba(239,68,68,0.05)', marginBottom: '1rem' }}>
              <AlertCircle size={20} style={{ color: '#ef4444', flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: '0.9rem', color: '#fca5a5' }}>{errorBanner}</div>
              <button onClick={() => setErrorBanner(null)} style={{ background: 'transparent', border: 'none', color: '#fca5a5', cursor: 'pointer' }}><X size={16} /></button>
            </div>
          )}

          {/* Step 1: Upload Assets */}
          <div className="creator-card purple-glow">
            <h2 className="card-title"><Upload size={18} style={{ color: 'var(--accent-purple)' }} /> 1. Drag &amp; Drop Visuals &amp; Music</h2>
            <div className="controls-grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
              <div>
                <div className={`dropzone ${isDragActive ? 'active' : ''}`}
                  onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={handleDrop}
                  onClick={() => fileInputRef.current.click()}>
                  <input type="file" ref={fileInputRef} multiple accept="image/*,video/*" onChange={e => uploadFiles(e.target.files, 'assets')} style={{ display: 'none' }} />
                  <ImageIcon size={32} className="dropzone-icon" />
                  <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>Drag &amp; Drop Images / Videos</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Or click to browse</p>
                </div>
                {assets.length > 0 && (
                  <div className="preview-grid">
                    {assets.map(asset => (
                      <div key={asset.id} className="preview-item">
                        {asset.type === 'image' ? <img src={`${API_BASE}${asset.path}`} alt="thumb" /> : <video src={`${API_BASE}${asset.path}`} muted />}
                        <span className="file-type-badge">{asset.type}</span>
                        <button className="remove-btn" onClick={() => removeAsset(asset.id)}><X size={10} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="dropzone" onClick={() => musicInputRef.current.click()} style={{ padding: '1.2rem', minHeight: '100px' }}>
                  <input type="file" ref={musicInputRef} accept="audio/*" onChange={e => uploadFiles(e.target.files, 'music')} style={{ display: 'none' }} />
                  <Music size={24} className="dropzone-icon" style={{ color: 'var(--accent-cyber)' }} />
                  <p style={{ fontSize: '0.8rem', fontWeight: 500 }}>Add Background Music</p>
                </div>
                <select className="form-select" value={musicTrack || ''} onChange={e => setMusicTrack(e.target.value || null)}>
                  <option value="">No Music (Voice Only)</option>
                  {musicList.map(m => <option key={m.id} value={m.filename}>🎵 {m.originalName || m.filename}</option>)}
                </select>
                <div className="form-group">
                  <label>🔊 Music Volume: {Math.round(musicVolume * 100)}%</label>
                  <input type="range" min="0" max="1" step="0.05" value={musicVolume}
                    onChange={e => setMusicVolume(parseFloat(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--accent-cyber)' }} />
                </div>
              </div>
            </div>

            {/* Per-Video Original Audio Settings */}
            {videoAssets.length > 0 && (
              <div style={{ marginTop: '1.25rem', padding: '1rem', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0' }}>🎬 Video Clip Audio</span>
                  {videoAssets.length > 1 && (
                    <label style={{ fontSize: '0.8rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                      <input type="checkbox" checked={copyAudioSettingToAll}
                        onChange={e => handleToggleCopyAudioToAll(e.target.checked)}
                        style={{ accentColor: 'var(--accent-purple)' }} />
                      🔁 Apply same setting to all videos
                    </label>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {videoAssets.map(asset => {
                    const setting = getVideoAudioSetting(asset.id);
                    return (
                      <div key={asset.id} style={{ padding: '0.6rem 0.75rem', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                            {asset.originalName || asset.filename}
                          </span>
                          <label style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                            <input type="checkbox" checked={setting.useOriginalAudio}
                              onChange={e => updateVideoAudioSetting(asset.id, { useOriginalAudio: e.target.checked })}
                              style={{ accentColor: 'var(--accent-emerald)' }} />
                            Use Original Audio
                          </label>
                        </div>
                        {setting.useOriginalAudio && (
                          <div style={{ marginTop: '0.5rem' }}>
                            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>
                              Volume: {Math.round(setting.volume * 100)}%
                            </label>
                            <input type="range" min="0" max="1" step="0.05" value={setting.volume}
                              onChange={e => updateVideoAudioSetting(asset.id, { volume: parseFloat(e.target.value) })}
                              style={{ width: '100%', accentColor: 'var(--accent-emerald)' }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Background Music Section Picker */}
            {musicTrack && (
              <div style={{ marginTop: '1.25rem', padding: '1rem', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#e2e8f0' }}>
                    <input type="checkbox" checked={enableMusicTrim} onChange={e => setEnableMusicTrim(e.target.checked)} style={{ accentColor: 'var(--accent-cyber)' }} />
                    ✂️ Enable Background Music Trimming
                  </label>
                  {audioDuration > 0 && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Total Track Length: <strong style={{ color: 'var(--accent-cyber)' }}>{audioDuration.toFixed(1)}s</strong>
                    </span>
                  )}
                </div>

                {enableMusicTrim && musicSections.length > 1 && (
                  <label style={{ fontSize: '0.8rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    <input type="checkbox" checked={sameMusicSectionForAll}
                      onChange={e => {
                        const checked = e.target.checked;
                        setSameMusicSectionForAll(checked);
                        if (checked && musicSections.length > 0) {
                          const base = musicSections[0];
                          setMusicSections(prev => prev.map(() => ({ ...base })));
                        }
                      }}
                      style={{ accentColor: 'var(--accent-purple)' }} />
                    🔁 Apply same section to all variations
                  </label>
                )}

                {enableMusicTrim && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem', marginTop: '0.75rem' }}>
                    {musicSections.map((sec, idx) => (
                      <div key={idx} style={{ padding: '0.75rem', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--accent-purple)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>Variation {idx + 1} Music Section</span>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                            Duration: <strong style={{ color: '#fff' }}>{(sec.end - sec.start).toFixed(1)}s</strong>
                          </span>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>Start (sec)</label>
                            <input type="number" min="0" max={audioDuration} step="0.5" className="form-input" style={{ padding: '0.3rem', fontSize: '0.75rem', width: '100%' }}
                              value={sec.start}
                              onChange={e => {
                                const startVal = Math.max(0, Math.min(audioDuration, parseFloat(e.target.value) || 0));
                                setSameMusicSectionForAll(false);
                                setMusicSections(prev => prev.map((s, i) => i === idx ? { ...s, start: startVal } : s));
                              }}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>End (sec)</label>
                            <input type="number" min="0" max={audioDuration} step="0.5" className="form-input" style={{ padding: '0.3rem', fontSize: '0.75rem', width: '100%' }}
                              value={sec.end}
                              onChange={e => {
                                const endVal = Math.max(0, Math.min(audioDuration, parseFloat(e.target.value) || 0));
                                setSameMusicSectionForAll(false);
                                setMusicSections(prev => prev.map((s, i) => i === idx ? { ...s, end: endVal } : s));
                              }}
                            />
                          </div>
                          <div style={{ alignSelf: 'flex-end' }}>
                            <button
                              type="button"
                              className={`btn ${playingSectionIndex === idx ? 'btn-accent' : 'btn-secondary'}`}
                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', minWidth: '60px' }}
                              onClick={() => handlePlaySection(idx, sec.start, sec.end)}
                            >
                              {playingSectionIndex === idx ? 'Stop' : 'Play'}
                            </button>
                          </div>
                        </div>

                        {/* Slider controls */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.25rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', width: '25px' }}>Start</span>
                            <input 
                              type="range" 
                              min="0" 
                              max={audioDuration || 100} 
                              step="0.1"
                              value={sec.start}
                              onChange={e => {
                                const startVal = parseFloat(e.target.value);
                                const endVal = Math.max(startVal + 0.5, sec.end);
                                setSameMusicSectionForAll(false);
                                setMusicSections(prev => prev.map((s, i) => i === idx ? { start: startVal, end: Math.min(audioDuration, endVal) } : s));
                              }}
                              style={{ flex: 1, height: '4px', accentColor: 'var(--accent-purple)' }}
                            />
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', width: '30px', textAlign: 'right' }}>{sec.start.toFixed(1)}s</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', width: '25px' }}>End</span>
                            <input 
                              type="range" 
                              min="0" 
                              max={audioDuration || 100} 
                              step="0.1"
                              value={sec.end}
                              onChange={e => {
                                const endVal = parseFloat(e.target.value);
                                const startVal = Math.min(endVal - 0.5, sec.start);
                                setSameMusicSectionForAll(false);
                                setMusicSections(prev => prev.map((s, i) => i === idx ? { start: Math.max(0, startVal), end: endVal } : s));
                              }}
                              style={{ flex: 1, height: '4px', accentColor: 'var(--accent-cyber)' }}
                            />
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', width: '30px', textAlign: 'right' }}>{sec.end.toFixed(1)}s</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 2: Animation Style */}
          <div className="creator-card">
            <h2 className="card-title"><Zap size={18} style={{ color: 'var(--accent-cyber)' }} /> 2. Animation &amp; Style Settings</h2>
            <div className="controls-grid">
              <div className="form-group">
                <label>Subtitle Preset</label>
                <select className="form-select" value={stylePreset} onChange={e => setStylePreset(e.target.value)}>
                  <option value="random">🎲 Shuffled / Random Styles</option>
                  {Object.entries(STYLE_NAMES).map(([id, name]) => <option key={id} value={id}>Style {id}: {name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>⚡ Animation Speed</label>
                <select className="form-select" value={animationSpeed} onChange={e => setAnimationSpeed(e.target.value)}>
                  <option value="slow">🐢 Slow &amp; Smooth</option>
                  <option value="normal">▶️ Normal</option>
                  <option value="fast">⚡ Fast &amp; Dynamic</option>
                </select>
              </div>
              <div className="form-group">
                <label>Variations Per Quote</label>
                <select className="form-select" value={variationCount} onChange={e => setVariationCount(parseInt(e.target.value))}>
                  {[1,2,3,5,10].map(v => <option key={v} value={v}>{v} Video{v > 1 ? 's' : ''}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ justifyContent: 'center' }}>
                <div className={`toggle-group ${orderOfInsertion ? 'active' : ''}`} onClick={() => setOrderOfInsertion(!orderOfInsertion)}>
                  <div className="toggle-switch"></div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Keep Visuals in Upload Order</span>
                </div>
              </div>
            </div>

            {/* Animation Picker */}
            <div style={{ marginTop: '1rem' }}>
              <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                Select Animations to Use — pick up to 3 &nbsp;(selected: {allowedAnimations.length}/3)
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.5rem' }}>
                {ANIMATION_OPTIONS.map(anim => {
                  const isActive = allowedAnimations.includes(anim.id);
                  return (
                    <button key={anim.id} onClick={() => toggleAnimation(anim.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem',
                        borderRadius: '8px', border: `1px solid ${isActive ? 'var(--accent-purple)' : 'var(--border-light)'}`,
                        background: isActive ? 'rgba(139,92,246,0.12)' : 'var(--bg-tertiary)',
                        color: isActive ? '#c4b5fd' : 'var(--text-secondary)',
                        cursor: 'pointer', fontSize: '0.8rem', fontWeight: isActive ? 600 : 400,
                        transition: 'all 0.15s ease'
                      }}>
                      <span>{anim.icon}</span>
                      <span>{anim.name}</span>
                      {isActive && <CheckCircle2 size={12} style={{ marginLeft: 'auto', flexShrink: 0 }} />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Step 3: Voice & Timing Settings */}
          <div className="creator-card">
            <h2 className="card-title"><Mic size={18} style={{ color: 'var(--accent-emerald)' }} /> 3. Voice &amp; Timing</h2>
            {voiceoverEnabled && assets.length > 0 && (() => {
              const imageCount = assets.filter(a => a.type === 'image').length;
              const videoTotal = assets.filter(a => a.type === 'video').reduce((sum, a) => sum + (a.duration || 0), 0);
              const totalSlideTime = (imageCount * slideDuration) + videoTotal;
              if (totalSlideTime < 5) {
                return (
                  <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '8px', padding: '0.6rem 0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertCircle size={16} style={{ color: '#fbbf24', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.8rem', color: '#fde68a' }}>
                      Total slide time is only <strong>{totalSlideTime.toFixed(1)}s</strong>. If the voiceover is longer, the video will be cut short. Increase slide duration or add more assets.
                    </span>
                  </div>
                );
              }
              return null;
            })()}
            <div className="controls-grid">
              <div className="form-group">
                <label>Voiceover</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => setVoiceoverEnabled(true)}
                    className={`btn ${voiceoverEnabled ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem', gap: '0.4rem' }}>
                    <Mic size={14} /> On
                  </button>
                  <button onClick={() => setVoiceoverEnabled(false)}
                    className={`btn ${!voiceoverEnabled ? 'btn-accent' : 'btn-secondary'}`}
                    style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem', gap: '0.4rem' }}>
                    <MicOff size={14} /> Off
                  </button>
                </div>
              </div>

              {voiceoverEnabled && (
                <div className="form-group">
                  <label>Voice Style</label>
                  <select className="form-select" value={voiceStyle} onChange={e => setVoiceStyle(e.target.value)}>
                    <option value="deep-cinematic">🎙️ Deep Cinematic (Andrew)</option>
                    <option value="female-narrator">👩 Female Narrator (Aria)</option>
                  </select>
                </div>
              )}
              <div className="form-group">
                <label>Slide Duration: {slideDuration}s per image</label>
                <input type="range" min="1" max="15" step="0.5" value={slideDuration}
                  onChange={e => setSlideDuration(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-emerald)' }} />
                {(() => {
                  const imageCount = assets.filter(a => a.type === 'image').length;
                  const videoTotal = assets.filter(a => a.type === 'video').reduce((sum, a) => sum + (a.duration || 0), 0);
                  const totalLength = (imageCount * slideDuration) + videoTotal;
                  return (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Total: ~{totalLength.toFixed(1)}s
                      {imageCount > 0 && <> ({imageCount} image{imageCount !== 1 ? 's' : ''} × {slideDuration}s = {(imageCount * slideDuration).toFixed(1)}s)</>}
                      {videoTotal > 0 && <> + {videoTotal.toFixed(1)}s video</>}
                    </span>
                  );
                })()}
              </div>
              <div className="form-group">
                <label>Captions</label>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {[
                    { value: 'off', label: '🚫 Off' },
                    { value: 'top', label: '⬆ Top' },
                    { value: 'center', label: '⬛ Center' },
                    { value: 'bottom', label: '⬇ Bottom' }
                  ].map(pos => (
                    <button key={pos.value}
                      onClick={() => {
                        if (pos.value === 'off') { setCaptionsEnabled(false); }
                        else { setCaptionsEnabled(true); setCaptionPosition(pos.value); }
                      }}
                      className={`btn ${(pos.value === 'off' && !captionsEnabled) || (pos.value !== 'off' && captionsEnabled && captionPosition === pos.value) ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1, padding: '0.45rem', fontSize: '0.75rem' }}>
                      {pos.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Step 4: Bulk Dialogues Table */}
          <div className="creator-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h2 className="card-title" style={{ margin: 0 }}>
                <Sparkles size={18} style={{ color: 'var(--accent-emerald)' }} />
                4. Dialogue / Caption Queue (Max 20 rows)
              </h2>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input type="text" className="form-input"
                  style={{ width: '200px', padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                  placeholder="Topic for AI auto-fill..."
                  value={topicInput} onChange={e => setTopicInput(e.target.value)} />
                <button className="btn btn-primary" style={{ padding: '0.45rem 1rem', fontSize: '0.8rem' }}
                  onClick={generateQuotesFromAI} disabled={isGeneratingQuotes}>
                  {isGeneratingQuotes ? <RefreshCw size={12} className="spin" /> : <Sparkles size={12} />}
                  AI Fill
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <div className={`toggle-group ${sameTextThroughout ? 'active' : ''}`} onClick={() => setSameTextThroughout(!sameTextThroughout)}>
                <div className="toggle-switch"></div>
                <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Same caption throughout entire video</span>
              </div>
              {sameTextThroughout && (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem', marginLeft: '3.2rem' }}>
                  The first row's text will display for the full video duration
                </p>
              )}
            </div>

            <div className="table-container">
              <table className="bulk-table">
                <thead>
                  <tr>
                    <th style={{ width: '35px', textAlign: 'center' }}>#</th>
                    <th style={{ width: '130px' }}>Title (Optional)</th>
                    <th>Caption Text</th>
                    <th style={{ width: '70px' }}>Start (s)</th>
                    <th style={{ width: '110px' }}>Animation</th>
                    <th style={{ width: '90px' }}>Background</th>
                    <th style={{ width: '35px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row, i) => (
                    <tr key={i}>
                      <td className="row-index">{i + 1}</td>
                      <td><input type="text" placeholder={`Title ${i + 1}`} value={row.title} onChange={e => updateTableRow(i, 'title', e.target.value)} /></td>
                      <td><textarea rows={2} placeholder="Type dialogue / quote..." value={row.quote} onChange={e => updateTableRow(i, 'quote', e.target.value)} /></td>
                      <td>
                        <input type="number" min="0" step="0.5" value={row.startTime || 0}
                          onChange={e => updateTableRow(i, 'startTime', parseFloat(e.target.value) || 0)}
                          style={{ width: '100%', textAlign: 'center' }} />
                      </td>
                      <td>
                        <select value={row.textAnimation || 'none'} onChange={e => updateTableRow(i, 'textAnimation', e.target.value)}
                          style={{ width: '100%', background: 'transparent', border: '1px solid transparent', color: 'var(--text-primary)', padding: '0.4rem', borderRadius: '6px', fontSize: '0.8rem', outline: 'none' }}>
                          <option value="none">None</option>
                          <option value="typed">Typed</option>
                          <option value="blur-out">Blur Out</option>
                        </select>
                      </td>
                      <td>
                        <select value={row.textBackground || 'black'} onChange={e => updateTableRow(i, 'textBackground', e.target.value)}
                          style={{ width: '100%', background: 'transparent', border: '1px solid transparent', color: 'var(--text-primary)', padding: '0.4rem', borderRadius: '6px', fontSize: '0.8rem', outline: 'none' }}>
                          <option value="black">Black</option>
                          <option value="dark-gray">Dark Gray</option>
                          <option value="none">None</option>
                        </select>
                      </td>
                      <td><button className="delete-row-btn" onClick={() => deleteTableRow(i)}><Trash2 size={15} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="actions-row">
              <button className="btn btn-secondary" onClick={addTableRow}><Plus size={16} /> Add Row</button>
              <button className="btn btn-secondary" onClick={() => setTableRows([{ title: '', quote: '', startTime: 0, textAnimation: 'none', textBackground: 'black' }])}>Clear</button>
              <button className="btn btn-accent" style={{ marginLeft: 'auto' }}
                onClick={triggerBulkRender}
                disabled={isRendering || isUploading || assets.length === 0}>
                {isRendering ? <RefreshCw className="spin" size={16} /> : <Film size={16} />}
                Generate {totalOutputCount} Video{totalOutputCount !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="sidebar-panel">
          <div className="creator-card" style={{ marginBottom: 0 }}>
            <h2 className="card-title"><Play size={18} /> Instagram Post Preview (4:5)</h2>
            <div className="video-preview-wrapper">
              {selectedVideo ? (
                <video className="video-preview-player" src={`${API_BASE}${selectedVideo.url}`} controls autoPlay key={selectedVideo.filename} />
              ) : (
                <div className="preview-placeholder">
                  <span className="preview-placeholder-badge">1080×1350 vertical</span>
                  <p style={{ fontSize: '0.85rem' }}>Select a rendered video to preview</p>
                </div>
              )}
            </div>
            {selectedVideo && (
              <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedVideo.title}</p>
                  <span className={`style-badge style-${selectedVideo.stylePreset}`}>
                    Style {selectedVideo.stylePreset}: {STYLE_NAMES[selectedVideo.stylePreset]}
                  </span>
                </div>
                <button onClick={() => downloadVideo(`${API_BASE}${selectedVideo.url}`, selectedVideo.filename)} className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                  <Download size={14} /> Download
                </button>
              </div>
            )}
          </div>

          {jobs.length > 0 && (
            <div className="creator-card" style={{ marginBottom: 0 }}>
              <h2 className="card-title"><RefreshCw size={18} /> Render Queue</h2>
              <div className="queue-list">
                {jobs.map(job => (
                  <div key={job.id} className="queue-item">
                    <div className="queue-header">
                      <span style={{ fontWeight: 500, fontSize: '0.8rem' }}>#{job.id.substring(4)}</span>
                      <span className={`queue-status ${job.status}`}>
                        {job.status === 'running' ? `${job.progress}%` : job.status}
                      </span>
                    </div>
                    {job.status === 'running' && (
                      <div className="progress-bar-bg">
                        <div className="progress-bar-fill" style={{ width: `${job.progress}%` }}></div>
                      </div>
                    )}
                    {job.error && <p style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '0.25rem' }}>{job.error}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="creator-card" style={{ marginBottom: 0, flex: 1 }}>
            <h2 className="card-title"><Layers size={18} /> Completed Videos</h2>
            {completedVideos.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>No renders yet. Click Generate above!</p>
            ) : (
              <div className="outputs-list">
                {completedVideos.map(video => {
                  const tsMatch = video.filename.match(/^(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})/);
                  const displayTs = tsMatch ? `${tsMatch[1]} ${tsMatch[2].replace(/-/g, ':')}` : null;
                  return (
                    <div key={video.filename} className={`output-item ${selectedVideo?.filename === video.filename ? 'active' : ''}`} onClick={() => setSelectedVideo(video)}>
                      <div className="output-info">
                        <div className="output-title">{video.filename}</div>
                        {displayTs && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--accent-cyber)', marginBottom: '0.15rem' }}>🕐 {displayTs}</div>
                        )}
                        <div className="output-subtitle">{video.quote}</div>
                        <span className={`style-badge style-${video.stylePreset}`}>{STYLE_NAMES[video.stylePreset]}</span>
                      </div>
                      <div className="output-actions" onClick={e => e.stopPropagation()}>
                        <button className="icon-btn" onClick={() => setSelectedVideo(video)} title="Play"><Play size={12} /></button>
                        {video.editorMeta && <button className="icon-btn" onClick={() => setEditorVideo(video)} title="Edit"><Pencil size={12} /></button>}
                        <button className="icon-btn" onClick={() => downloadVideo(`${API_BASE}${video.url}`, video.filename)} title="Download"><Download size={12} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {showDeletePrompt && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 150, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="creator-card" style={{ maxWidth: '420px', margin: 0, textAlign: 'center' }}>
            <AlertCircle size={32} style={{ color: '#fbbf24', marginBottom: '0.75rem' }} />
            <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: '0.5rem' }}>Video Limit Reached</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              You have {completedVideos.length} saved videos (max 20). Delete old videos to make room for new ones?
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setShowDeletePrompt(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => {
                setCompletedVideos([]);
                setSelectedVideo(null);
                setShowDeletePrompt(false);
              }}>Delete All &amp; Continue</button>
              <button className="btn btn-accent" onClick={() => {
                const keep = completedVideos.slice(0, 10);
                setCompletedVideos(keep);
                if (selectedVideo && !keep.find(v => v.filename === selectedVideo.filename)) setSelectedVideo(null);
                setShowDeletePrompt(false);
              }}>Keep 10 Newest</button>
            </div>
          </div>
        </div>
      )}

      {editorVideo && (
        <VideoEditor
          video={editorVideo}
          onClose={() => setEditorVideo(null)}
          onExportComplete={(newVideo) => {
            setCompletedVideos(prev => [newVideo, ...prev]);
            setSelectedVideo(newVideo);
          }}
        />
      )}

      <style dangerouslySetInnerHTML={{__html: `.spin { animation: spin 1s linear infinite; } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}} />
    </div>
  );
}
