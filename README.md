# ReelsFlow — Bulk Video Creator

A full-stack app for generating short-form vertical videos (Reels, Shorts, TikToks) in bulk. Upload visuals and music, write dialogue, pick a style, and batch-render polished clips with animated subtitles and AI voiceover.

## Features

- **Drag & drop** images, videos, and background music
- **10 subtitle styles** — Hormozi Pop, Cinematic Drama, Cyberpunk Neon, and more
- **10 animation presets** — Ken Burns, slides, glitch, echo pull, etc.
- **AI voiceover** via Edge TTS (male/female voices)
- **AI quote generation** powered by Google Gemini
- **Background music trimming** with per-variation section control
- **Batch rendering** — generate multiple variations per quote in one click

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [FFmpeg](https://ffmpeg.org/) installed and on your PATH
- A [Google Gemini API key](https://aistudio.google.com/apikey) (for AI quote generation)

## Getting Started

The quickest way to start both the server and client:

```powershell
.\run.ps1
```

Or start them manually:

```bash
# Terminal 1 — backend
cd server
npm install
npm start        # http://localhost:5000

# Terminal 2 — frontend
cd client
npm install
npm run dev      # http://localhost:5173
```

Open the client URL in your browser, enter your Gemini API key in the settings bar, and start creating.

## Project Structure

```
├── run.ps1          # Launcher script (starts both server & client)
├── server/
│   └── server.js    # Express API — upload, TTS, FFmpeg rendering
└── client/
    └── src/
        └── App.jsx  # React UI (Vite + Lucide icons)
```

## License

MIT
