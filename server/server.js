import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { AudioService } from './services/audioService.js';
import { VideoService } from './services/videoService.js';
import { GeminiService } from './services/geminiService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

/**
 * Builds a filesystem-safe "YYYY-MM-DD_HH-mm-ss" timestamp for naming output files.
 */
function buildTimestamp() {
  const d = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Ensure required directories exist
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const OUTPUTS_DIR = path.join(__dirname, 'outputs');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(OUTPUTS_DIR)) fs.mkdirSync(OUTPUTS_DIR, { recursive: true });

// Expose outputs directory statically
app.use('/outputs', express.static(OUTPUTS_DIR));
app.use('/uploads', express.static(UPLOADS_DIR));

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Instantiate Services
const audioService = new AudioService();
const videoService = new VideoService();

// Local store for job progress
const jobsStore = new Map();

/**
 * Endpoint to upload files in bulk (images, videos, music).
 */
app.post('/api/upload', upload.array('files'), (req, res) => {
  try {
    const uploadedFiles = req.files.map(file => {
      const ext = path.extname(file.originalname).toLowerCase();
      let type = 'other';
      if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) {
        type = 'image';
      } else if (['.mp4', '.mov', '.avi', '.mkv'].includes(ext)) {
        type = 'video';
      } else if (['.mp3', '.wav', '.ogg', '.m4a'].includes(ext)) {
        type = 'music';
      }

      return {
        id: file.filename,
        originalName: file.originalname,
        filename: file.filename,
        path: `/uploads/${file.filename}`,
        localPath: file.path,
        type
      };
    });

    res.json({ success: true, files: uploadedFiles });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Helper to get lists of uploaded media.
 */
app.get('/api/media', (req, res) => {
  try {
    const files = fs.readdirSync(UPLOADS_DIR);
    const media = files.map(file => {
      const ext = path.extname(file).toLowerCase();
      let type = 'other';
      if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) {
        type = 'image';
      } else if (['.mp4', '.mov', '.avi', '.mkv'].includes(ext)) {
        type = 'video';
      } else if (['.mp3', '.wav', '.ogg', '.m4a'].includes(ext)) {
        type = 'music';
      }

      return {
        id: file,
        filename: file,
        path: `/uploads/${file}`,
        localPath: path.join(UPLOADS_DIR, file),
        type
      };
    });

    res.json({
      images: media.filter(m => m.type === 'image'),
      videos: media.filter(m => m.type === 'video'),
      music: media.filter(m => m.type === 'music')
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Endpoint to auto-generate hooks/quotes using Gemini API.
 */
app.post('/api/generate-quotes', async (req, res) => {
  const { topic, count } = req.body;
  const apiKey = req.headers['x-gemini-api-key'] || process.env.GEMINI_API_KEY;

  if (!topic) {
    return res.status(400).json({ error: 'Topic is required.' });
  }
  if (!apiKey) {
    return res.status(400).json({ error: 'Gemini API key is required. Please set it in Settings.' });
  }

  try {
    const gemini = new GeminiService(apiKey);
    const quotes = await gemini.generateQuotes(topic, count || 5);
    res.json({ success: true, quotes });
  } catch (error) {
    console.error('Error generating quotes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Endpoint to trigger bulk video generation.
 */
app.post('/api/generate-bulk', async (req, res) => {
  const {
    assets,            // Array of local filenames of images/videos
    musicTrack,        // Filename of music file (optional)
    voiceStyle,        // 'deep-cinematic' or 'female-narrator'
    stylePreset,       // 1 to 10 or 'random'
    orderOfInsertion,  // true (strict order) or false (shuffled)
    variationCount,    // Number of variation videos to generate per row (1 to 10)
    tableRows,         // Array of { title, quote }
    voiceoverEnabled,  // boolean - whether to generate TTS
    slideDuration,     // seconds per slide when no voiceover
    musicVolume,       // 0.0 to 1.0 background music volume
    animationSpeed,    // 'slow', 'normal', 'fast'
    allowedAnimations, // array of animation indices (0-9), max 3
    musicSections,     // array of { start: number, end: number }
    sameTextThroughout, // boolean - use first row's text for entire video
    captionPosition,   // 'top', 'center', 'bottom'
    captionsEnabled,   // boolean - whether to show captions
    videoAudioSettings // { [filename]: { useOriginalAudio: bool, volume: 0-1 } }
  } = req.body;

  if (!assets || assets.length === 0) {
    return res.status(400).json({ error: 'At least one visual asset (image or video) must be uploaded.' });
  }
  if (!tableRows || tableRows.length === 0) {
    return res.status(400).json({ error: 'Quotes/dialogues table cannot be empty.' });
  }

  const jobId = 'job_' + Date.now();
  const rowsToProcess = tableRows.slice(0, 20);
  const videosCount = variationCount || 1;

  jobsStore.set(jobId, {
    id: jobId,
    status: 'running',
    progress: 0,
    totalVideos: videosCount,
    videos: [],
    error: null
  });

  processBulkRenderingJob(jobId, {
    assets,
    musicTrack,
    voiceStyle,
    stylePreset,
    orderOfInsertion,
    variationCount: variationCount || 1,
    rowsToProcess,
    voiceoverEnabled: voiceoverEnabled !== false, // default true
    slideDuration: slideDuration || 3,
    musicVolume: musicVolume !== undefined ? musicVolume : 0.15,
    animationSpeed: animationSpeed || 'normal',
    allowedAnimations: allowedAnimations || [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    musicSections: musicSections || [],
    sameTextThroughout: !!sameTextThroughout,
    captionPosition: captionPosition || 'bottom',
    captionsEnabled: captionsEnabled !== false,
    videoAudioSettings: videoAudioSettings || {}
  });

  res.json({ success: true, jobId, totalVideos: videosCount });
});

/**
 * Endpoint to check job status.
 */
app.get('/api/status/:jobId', (req, res) => {
  const job = jobsStore.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json(job);
});

/**
 * Endpoint to re-render a single video with per-slide overrides (editor flow).
 */
app.post('/api/re-render', async (req, res) => {
  const {
    assets,
    slideOverrides,
    stylePreset,
    titleText,
    quoteText,
    voiceoverEnabled,
    voiceStyle,
    musicTrack,
    musicVolume,
    animationSpeed,
    musicStartTime,
    musicSectionDuration,
    sameTextThroughout,
    captionPosition,
    tableRows
  } = req.body;

  if (!assets || assets.length === 0) {
    return res.status(400).json({ error: 'At least one asset is required.' });
  }
  if (!slideOverrides || slideOverrides.length !== assets.length) {
    return res.status(400).json({ error: 'slideOverrides must match assets length.' });
  }

  const jobId = 'edit_' + Date.now();
  const outFilename = `${buildTimestamp()}_edited.mp4`;
  const localOutputPath = path.join(OUTPUTS_DIR, outFilename);
  const localAssetPaths = assets.map(filename => path.join(UPLOADS_DIR, filename));
  const localMusicPath = musicTrack ? path.join(UPLOADS_DIR, musicTrack) : null;

  try {
    let voiceoverResult = null;
    if (voiceoverEnabled && quoteText && quoteText.trim().length > 0) {
      const voiceoverFilename = `tts_${jobId}.mp3`;
      voiceoverResult = await audioService.generateVoiceover(
        quoteText,
        voiceStyle || 'deep-cinematic',
        OUTPUTS_DIR,
        voiceoverFilename
      );
    }

    await videoService.renderVideoWithOverrides({
      assets: localAssetPaths,
      slideOverrides,
      voiceoverPath: voiceoverResult ? voiceoverResult.audioPath : null,
      wordTimings: voiceoverResult ? voiceoverResult.words : [],
      musicPath: localMusicPath,
      stylePreset: parseInt(stylePreset) || 1,
      outputPath: localOutputPath,
      titleText: titleText || '',
      quoteText: quoteText || '',
      voiceoverEnabled: !!voiceoverResult,
      musicVolume: musicVolume !== undefined ? musicVolume : 0.15,
      animationSpeed: animationSpeed || 'normal',
      musicStartTime: parseFloat(musicStartTime) || 0,
      musicSectionDuration: parseFloat(musicSectionDuration) || 0,
      sameTextThroughout: !!sameTextThroughout,
      captionPosition: captionPosition || 'bottom',
      tableRows: tableRows || []
    });

    if (voiceoverResult && fs.existsSync(voiceoverResult.audioPath)) {
      try { fs.unlinkSync(voiceoverResult.audioPath); } catch (e) {}
    }

    res.json({
      success: true,
      video: {
        id: jobId,
        title: titleText || 'Edited Video',
        quote: quoteText || '',
        stylePreset: parseInt(stylePreset) || 1,
        filename: outFilename,
        url: `/outputs/${outFilename}`,
        editorMeta: {
          assets,
          slideDuration: slideOverrides[0]?.duration || 3,
          animationSpeed,
          allowedAnimations: slideOverrides.map(s => s.animation),
          voiceoverEnabled: !!voiceoverResult,
          voiceStyle: voiceStyle || 'deep-cinematic',
          musicTrack: musicTrack || null,
          musicVolume,
          orderOfInsertion: true,
          variationIndex: 0,
          sameTextThroughout: !!sameTextThroughout,
          captionPosition: captionPosition || 'bottom'
        }
      }
    });
  } catch (error) {
    console.error('[Server] Re-render failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Asynchronously processes the bulk video rendering list.
 */
async function processBulkRenderingJob(jobId, config) {
  const job = jobsStore.get(jobId);
  const {
    assets, musicTrack, voiceStyle, stylePreset, orderOfInsertion,
    variationCount, rowsToProcess, voiceoverEnabled, slideDuration,
    musicVolume, animationSpeed, allowedAnimations, musicSections,
    sameTextThroughout, captionPosition, captionsEnabled, videoAudioSettings
  } = config;
  
  const totalSteps = variationCount;
  let completedSteps = 0;

  try {
    const localAssetPaths = assets.map(filename => path.join(UPLOADS_DIR, filename));
    const localMusicPath = musicTrack ? path.join(UPLOADS_DIR, musicTrack) : null;

    // Combine all quote text for voiceover (join all rows)
    const allQuoteText = rowsToProcess.map(r => r.quote).filter(q => q && q.trim()).join('. ');
    const titleText = rowsToProcess[0]?.title || '';

    // Generate TTS Voiceover if enabled
    let voiceoverResult = null;
    if (voiceoverEnabled && allQuoteText.trim().length > 0) {
      const voiceoverFilename = `tts_${jobId}.mp3`;
      voiceoverResult = await audioService.generateVoiceover(
        allQuoteText,
        voiceStyle,
        OUTPUTS_DIR,
        voiceoverFilename
      );
    }

    for (let v = 0; v < variationCount; v++) {
      let activeStyle = stylePreset;
      if (stylePreset === 'random') {
        activeStyle = Math.floor(Math.random() * 10) + 1;
      } else {
        activeStyle = parseInt(stylePreset) || 1;
      }

      const outFilename = `${buildTimestamp()}_v${v + 1}.mp4`;
      const localOutputPath = path.join(OUTPUTS_DIR, outFilename);

      let musicStartTime = 0;
      let musicSectionDuration = 0;
      if (musicSections && musicSections.length > 0) {
        const section = musicSections[v % musicSections.length];
        if (section) {
          musicStartTime = parseFloat(section.start) || 0;
          const endVal = parseFloat(section.end) || 0;
          if (endVal > musicStartTime) {
            musicSectionDuration = endVal - musicStartTime;
          }
        }
      }

      console.log(`[Server] Rendering variation ${v}: style ${activeStyle}, voiceover: ${!!voiceoverResult}, captions: ${rowsToProcess.length}`);

      await videoService.renderVideo({
        assets: localAssetPaths,
        voiceoverPath: voiceoverResult ? voiceoverResult.audioPath : null,
        wordTimings: voiceoverResult ? voiceoverResult.words : [],
        musicPath: localMusicPath,
        stylePreset: activeStyle,
        orderOfInsertion,
        outputPath: localOutputPath,
        titleText,
        voiceoverEnabled: !!voiceoverResult,
        slideDuration,
        musicVolume,
        animationSpeed,
        allowedAnimations,
        tableRows: captionsEnabled ? rowsToProcess : [],
        variationIndex: v,
        sameTextThroughout,
        captionPosition,
        captionsEnabled,
        musicStartTime,
        musicSectionDuration,
        videoAudioSettings: videoAudioSettings || {}
      });

      completedSteps++;
      job.progress = Math.round((completedSteps / totalSteps) * 100);

      job.videos.push({
        id: `0_${v}`,
        title: titleText || `Video (Var ${v + 1})`,
        quote: allQuoteText,
        stylePreset: activeStyle,
        filename: outFilename,
        url: `/outputs/${outFilename}`,
        editorMeta: {
          assets: assets,
          slideDuration,
          animationSpeed,
          allowedAnimations,
          voiceoverEnabled: !!voiceoverResult,
          voiceStyle,
          musicTrack: musicTrack || null,
          musicVolume,
          orderOfInsertion,
          variationIndex: v,
          sameTextThroughout,
          captionPosition,
          tableRows: rowsToProcess
        }
      });

      jobsStore.set(jobId, { ...job });
    }

    // Cleanup TTS file
    if (voiceoverResult && fs.existsSync(voiceoverResult.audioPath)) {
      try { fs.unlinkSync(voiceoverResult.audioPath); } catch (e) {}
    }

    job.status = 'completed';
    job.progress = 100;
    jobsStore.set(jobId, { ...job });
    console.log(`[Server] Job ${jobId} finished rendering successfully.`);

  } catch (error) {
    console.error(`[Server] Job ${jobId} failed with error:`, error);
    job.status = 'failed';
    job.error = error.message;
    jobsStore.set(jobId, { ...job });
  }
}

// Start Server
app.listen(PORT, () => {
  console.log(`[Server] Server is running on http://localhost:${PORT}`);
});
