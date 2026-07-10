# DecibelCut 🎙️✂️
> **Ultimate Browser-Based Audio/Video Editor & AI Podcast Studio**

DecibelCut is a professional-grade, local-first browser application designed for creators, podcasters, and video editors. By leveraging high-performance client-side audio engines, DSP (Digital Signal Processing), and WebAssembly-powered media processors, DecibelCut brings desktop-class audio and video editing features straight to the web browser without any server-side upload latency or subscription-gated processing limits.

---

## 🚀 Key Features

### 1. 🎚️ Browser DAW & Multi-Track Studio
* **Multi-Track Editing**: Arrange and layer speech tracks, backing music, intros, and sound effects inside an interactive visual timeline.
* **Direct Audio Recording**: Record high-fidelity audio directly from your browser with configurable capture parameters including:
  * Hardware Echo Cancellation
  * Intelligent Noise Suppression
  * Auto Gain Control (AGC)
* **Real-time Visualizer**: View live mic frequency response via canvas-rendered visualizers.
* **Local Projects Library**: Local project files and audio assets are stored client-side using a fast, persistent IndexedDB storage engine.

### 2. 🪄 AI Podcast Copilot
* **One-Click Filler Word Removal**: Highlight and automate the deletion of filler words like "um", "ah", "like", and unnecessary pauses.
* **Auto Transcription & Text Syncing**: View dynamic transcripts synchronized with timeline playheads.
* **Creator Deliverables**: Instantly generate automated show notes, structured episode summaries, and YouTube/Spotify chapters.

### 3. ✂️ Smart Silence Detection & Decibel Cutter
* **Optimized Scan Engine**: Uses zero-allocation array scanning to instantly parse large channel-averaged Float32 audio tracks in memory.
* **Interactive Thresholds**: Adjust volume thresholds (dBFS), minimum silence duration, and custom padding buffers (pre/post) to find and cleanly trim dead space.
* **Non-destructive Waveform Regions**: Visualize and verify silent regions on a custom WaveSurfer.js canvas before applying cuts.

### 4. 🎚️ DSP Master & Creator Presets
* **Platform Preset Matching**: Instantly optimize audio loudness and EQ profiles targeting standard streaming requirements:
  * YouTube (-14 LUFS)
  * Spotify (-14 LUFS)
  * TikTok / Reels (-15 LUFS)
  * Podcasts (-16 LUFS)
* **Advanced DSP Chain**: Toggle and tune background noise gates, dynamic range compressors, parametric EQ filters, and vocal enhancers.
* **Loudness Normalization**: Normalize volume outputs dynamically using standard audio filters.

### 5. 🎞️ Video Audio Extractor
* **Client-Side Demuxing**: Extract high-quality audio tracks directly from `.mp4`, `.mov`, `.avi`, and `.mkv` files in the browser using WebAssembly.
* **Batch Pipeline**: Process multiple video files concurrently with active progress queues.
* **ZIP Archive Packaging**: Package and download multiple extracted audio tracks in a single, compressed JSZip file.

---

## 🛠️ Technology Stack

* **Frontend Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) (for strong typing and robust state control)
* **Build System**: [Vite 8](https://vite.dev/) (blazing-fast hot module replacement)
* **Audio Visualizations**: [WaveSurfer.js](https://wavesurfer.xyz/) (interactive timeline and audio wave canvas rendering)
* **Media Processing**: [@ffmpeg/ffmpeg](https://github.com/ffmpegwasm/ffmpeg.wasm) (WebAssembly port of FFmpeg for client-side demuxing, trimming, and encoding)
* **State Management**: [Zustand](https://github.com/pmndrs/zustand) (minimalist and reactive global store)
* **Persistence Layer**: [idb](https://github.com/jakearchibald/idb) (IndexedDB wrapper for project tracking, large audio file caching, and library asset storage)
* **Archive Packaging**: [JSZip](https://stuk.github.io/jszip/) (in-memory zip archival generation)
* **Icons**: [Lucide React](https://lucide.dev/) (consistent and clean modern vector iconography)
* **Linting & Quality**: [Oxlint](https://oxc.rs/) (ultra-fast linter for pristine code style)

---

## 📂 Project Structure

```text
decible-cut/
├── public/                 # Static assets, logos, and web workers
├── src/
│   ├── assets/             # Images and global icons
│   ├── components/         # Reusable UI parts (ads, layout, playback, processing, upload)
│   ├── config/             # App configs
│   ├── hooks/              # Custom React hooks
│   ├── pages/              # Primary page/route views:
│   │   ├── LandingPage.tsx           # Product homepage & interactive simulator
│   │   ├── PodcastCreatorStudioPage  # The Multi-Track Browser DAW workspace
│   │   ├── CreatorToolsPage.tsx      # Platform presets & advanced DSP console
│   │   └── VideoAudioPage.tsx        # Batch audio extractor from video files
│   ├── services/           # Underlying audio/video engines:
│   │   ├── audioEngine.ts            # Web Audio API decode/play utils
│   │   ├── audioProcessor.ts         # DSP filters, compressor, and gain mixers
│   │   ├── ffmpegService.ts          # FFmpeg WebAssembly bindings
│   │   ├── silenceDetector.ts        # Fast Float32Array silence detection
│   │   ├── podcastStudioService.ts   # Multi-track rendering & local DB
│   │   └── videoService.ts           # WebAssembly video processing pipelines
│   ├── store/              # Zustand global stores (audio, batch, settings, UI)
│   ├── styles/             # Global variables and design system tokens
│   ├── types/              # TypeScript typings
│   ├── utils/              # Math utilities, formatters, and constants
│   ├── App.tsx             # Main App shell
│   ├── main.tsx            # App entrypoint
│   └── router.tsx          # React Router route registry
├── package.json            # Script commands and project dependencies
├── tsconfig.json           # TypeScript configuration
└── vite.config.ts          # Vite bundle configuration
```

---

## 🚀 Getting Started

### 📋 Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed (version 18+ is recommended).

### 🛠️ Installation
1. Clone this repository to your local machine:
   ```bash
   git clone https://github.com/[your-username]/decible-cut.git
   cd decible-cut
   ```
2. Install the package dependencies:
   ```bash
   npm install
   ```

### 💻 Running Locally
To launch the development server with Hot Module Replacement (HMR):
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:5173` (or the port specified in your console).

### 🏗️ Production Build
To compile the TypeScript project and build optimized static assets:
```bash
npm run build
```
You can preview the production bundle locally using:
```bash
npm run preview
```

---

## 💡 How it Works Under the Hood

### Client-Side Decibel Scanner (`silenceDetector.ts`)
Instead of heavy server-side processing, DecibelCut decodes audio data into a browser `AudioBuffer` and calculates decibel levels (dBFS) across sliding analysis windows. It computes Root Mean Square (RMS) amplitudes on channel-averaged samples directly:
$$RMS = \sqrt{\frac{1}{N}\sum_{i=1}^{N} x_i^2}$$
$$dBFS = 20 \log_{10}(RMS)$$
Windows falling below the custom threshold are grouped into silent regions, keeping padded boundaries intact to prevent cutting off words.

### Multi-Track DAW Renderer (`podcastStudioService.ts`)
Tracks are blended using Web Audio API offline nodes. Each track clip is positioned relative to the timeline, offset values are mapped, and a mixed buffer is passed to `@ffmpeg/ffmpeg` to normalize loudness and encode the final output in the client's browser.
