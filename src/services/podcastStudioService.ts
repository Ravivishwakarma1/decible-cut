// ============================================================
// DecibelCut — Podcast Studio Service
// Multi-track rendering, IndexedDB persistence, Recording & Library
// ============================================================

import { openDB, type IDBPDatabase } from 'idb';
import { audioBufferToWav } from './audioEngine';
import { loadFFmpeg } from './ffmpegService';
import type { ExportProgress } from '../types/processing.types';

// DB schemas
const DB_NAME = 'decibelcut-podcast-studio';
const DB_VERSION = 1;
const PROJECTS_STORE = 'projects';
const LIBRARY_STORE = 'intro-outro-library';
const AUDIO_FILES_STORE = 'audio-files'; // Stores raw audio files binary blobs

export interface PodcastClip {
  id: string;
  name: string;
  duration: number;        // seconds
  startOffset: number;     // start position in timeline (seconds)
  audioFileId: string;     // references key in AUDIO_FILES_STORE
}

export interface PodcastTrack {
  id: string;
  name: string;
  type: 'intro' | 'outro' | 'voice' | 'music' | 'sfx';
  volume: number;          // 0.0 - 1.0
  muted: boolean;
  soloed: boolean;
  clips: PodcastClip[];
}

export interface PodcastMetadata {
  title: string;
  podcastName: string;
  author: string;
  description: string;
  category: string;
  language: string;
  copyright: string;
  releaseYear: number;
  episodeNumber: number;
  season: number;
  tags: string;
  artworkUrl?: string;     // base64 data URL
}

export interface PodcastProject {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
  metadata: PodcastMetadata;
  tracks: PodcastTrack[];
}

export interface LibraryAsset {
  id: string;
  name: string;
  type: 'intro' | 'outro' | 'transition' | 'music' | 'sfx';
  duration: number;
  audioFileId: string;
  createdAt: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getStudioDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
          db.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(LIBRARY_STORE)) {
          db.createObjectStore(LIBRARY_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(AUDIO_FILES_STORE)) {
          db.createObjectStore(AUDIO_FILES_STORE);
        }
      },
    });
  }
  return dbPromise;
}

// ---- Project Management ----

export async function getAllProjects(): Promise<PodcastProject[]> {
  const db = await getStudioDB();
  return db.getAll(PROJECTS_STORE);
}

export async function saveProject(project: PodcastProject): Promise<void> {
  const db = await getStudioDB();
  const updated = { ...project, updatedAt: Date.now() };
  await db.put(PROJECTS_STORE, updated);
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getStudioDB();
  
  // Find project to clean up its audio files
  const project = await db.get(PROJECTS_STORE, id) as PodcastProject | undefined;
  if (project) {
    const fileIds: string[] = [];
    project.tracks.forEach(track => {
      track.clips.forEach(clip => {
        fileIds.push(clip.audioFileId);
      });
    });
    
    // Delete files
    const tx = db.transaction(AUDIO_FILES_STORE, 'readwrite');
    for (const fId of fileIds) {
      await tx.store.delete(fId);
    }
    await tx.done;
  }
  
  await db.delete(PROJECTS_STORE, id);
}

export async function saveAudioFile(id: string, file: Blob): Promise<void> {
  const db = await getStudioDB();
  await db.put(AUDIO_FILES_STORE, file, id);
}

export async function getAudioFile(id: string): Promise<Blob | null> {
  const db = await getStudioDB();
  const file = await db.get(AUDIO_FILES_STORE, id);
  return file ?? null;
}

// ---- Library Assets ----

export async function getLibraryAssets(): Promise<LibraryAsset[]> {
  const db = await getStudioDB();
  return db.getAll(LIBRARY_STORE);
}

export async function addLibraryAsset(asset: LibraryAsset, file: Blob): Promise<void> {
  const db = await getStudioDB();
  await db.put(AUDIO_FILES_STORE, file, asset.audioFileId);
  await db.put(LIBRARY_STORE, asset);
}

export async function deleteLibraryAsset(asset: LibraryAsset): Promise<void> {
  const db = await getStudioDB();
  await db.delete(LIBRARY_STORE, asset.id);
  await db.delete(AUDIO_FILES_STORE, asset.audioFileId);
}

// ---- Multi-Track Mixer & Off-line Render ----

/**
 * Mixes multiple tracks client-side using OfflineAudioContext.
 * Decodes files from DB stores on the fly.
 */
export async function renderMultiTrackPodcast(
  project: PodcastProject,
  audioContext: AudioContext,
  onProgress?: (percent: number) => void
): Promise<AudioBuffer> {
  const db = await getStudioDB();
  
  // 1. Gather all files and decode them
  interface ActiveSource {
    clip: PodcastClip;
    buffer: AudioBuffer;
    volume: number;
  }
  
  const activeSources: ActiveSource[] = [];
  let maxDuration = 1; // minimum 1 second duration
  
  const tracksToMix = project.tracks.filter(t => !t.muted);
  const isAnySoloed = tracksToMix.some(t => t.soloed);
  const activeTracks = isAnySoloed ? tracksToMix.filter(t => t.soloed) : tracksToMix;
  
  onProgress?.(10);
  
  let decodedCount = 0;
  let totalClips = 0;
  activeTracks.forEach(t => totalClips += t.clips.length);

  for (const track of activeTracks) {
    for (const clip of track.clips) {
      try {
        const blob = await db.get(AUDIO_FILES_STORE, clip.audioFileId) as Blob | undefined;
        if (!blob) continue;
        
        const arrayBuffer = await blob.arrayBuffer();
        // Create an isolated AudioBuffer to avoid state sharing issues
        const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        activeSources.push({
          clip,
          buffer: decodedBuffer,
          volume: track.volume
        });
        
        const clipEnd = clip.startOffset + clip.duration;
        if (clipEnd > maxDuration) {
          maxDuration = clipEnd;
        }
      } catch (err) {
        console.error('Failed to decode clip', clip.name, err);
      } finally {
        decodedCount++;
        onProgress?.(10 + Math.round((decodedCount / Math.max(1, totalClips)) * 40));
      }
    }
  }

  // 2. Perform offline rendering
  onProgress?.(55);
  
  // OfflineAudioContext can render at CD quality: 44.1kHz stereo
  const sampleRate = 44100;
  const numChannels = 2;
  const offlineCtx = new OfflineAudioContext(
    numChannels,
    Math.ceil(maxDuration * sampleRate),
    sampleRate
  );

  activeSources.forEach(({ clip, buffer, volume }) => {
    const sourceNode = offlineCtx.createBufferSource();
    sourceNode.buffer = buffer;

    const gainNode = offlineCtx.createGain();
    gainNode.gain.setValueAtTime(volume, 0);

    sourceNode.connect(gainNode);
    gainNode.connect(offlineCtx.destination);

    // Schedule playback at startOffset
    sourceNode.start(clip.startOffset);
  });

  onProgress?.(70);
  const mixedBuffer = await offlineCtx.startRendering();
  
  onProgress?.(100);
  return mixedBuffer;
}

// ---- Cloud Mocking Integration ----

export interface CloudFile {
  id: string;
  name: string;
  size: number;
  modified: string;
  type: 'folder' | 'audio' | 'image' | 'video';
  url?: string;
}

export const MOCK_CLOUD_FILES: Record<string, CloudFile[]> = {
  gdrive: [
    { id: 'gd_1', name: 'Interviews', type: 'folder', size: 0, modified: '2026-06-15' },
    { id: 'gd_2', name: 'podcast_intro_music_v2.mp3', type: 'audio', size: 4500000, modified: '2026-06-20' },
    { id: 'gd_3', name: 'corporate_bg_loop.wav', type: 'audio', size: 12000000, modified: '2026-06-21' },
    { id: 'gd_4', name: 'Episode_25_raw_mic.m4a', type: 'audio', size: 35000000, modified: '2026-06-28' },
  ],
  dropbox: [
    { id: 'db_1', name: 'Sound FX Pack', type: 'folder', size: 0, modified: '2026-05-10' },
    { id: 'db_2', name: 'applause_sfx.wav', type: 'audio', size: 850000, modified: '2026-06-12' },
    { id: 'db_3', name: 'synthwave_background.flac', type: 'audio', size: 18000000, modified: '2026-06-19' },
  ],
  onedrive: [
    { id: 'od_1', name: 'Podcasting Shared', type: 'folder', size: 0, modified: '2026-03-04' },
    { id: 'od_2', name: 'outro_voiceover_commercial.wav', type: 'audio', size: 8000000, modified: '2026-06-22' },
    { id: 'od_3', name: 'DecibelCut_Logo_Artwork.png', type: 'image', size: 2400000, modified: '2026-06-25' },
  ]
};

// ---- Mock AI Engine (Transcript & Summaries) ----

export interface MockAIResults {
  transcript: string;
  summary: string;
  showNotes: string;
  chapters: Array<{ time: string; title: string }>;
  fillerWordsRemovedCount: number;
}

export function generateMockAIContent(projectName: string): MockAIResults {
  const textProject = projectName.replace(/_/g, ' ');
  return {
    transcript: `[00:00] [Host]: Welcome back to another episode of the ${textProject} show! Uh, today we are going to dive deep into Web Audio APIs and client-side processing. Let's start with, like, a quick intro.
[00:25] [Host]: Now, many creators ask, "How do we, um, remove noise without uploading files?" Well, the answer is WebAssembly. WebAssembly enables us to compile, you know, C-based filters like FFmpeg and run them directly in the sandbox.
[01:10] [Guest]: Yes, that's exactly right. For instance, when we run a low-cut EQ at, say, 80 Hertz, it clears up all the rumble. Let me demonstrate how that feels...
[02:00] [Host]: Like, wow! That is a night and day difference. Thank you for sharing that. It makes the podcast sound so much cleaner.
[02:40] [Host]: Excellent. That brings us to the end of this session. Make sure to subscribe, and we'll catch you, like, next time!`,
    
    summary: `In this episode of "${textProject}", the host introduces the concepts of client-side audio processing using the Web Audio API and WebAssembly. A guest joins to demonstrate the power of high-pass EQ filters and local DSP computations in removing background rumble. They emphasize privacy, highlighting that files are processed entirely inside the browser sandboxed environment.`,
    
    showNotes: `### Episode Summary:
Learn how Web Audio API and WebAssembly (FFmpeg WASM) are revolutionizing modern browser editing workflows by enabling 100% local, privacy-first audio mastering.

### Key Takeaways:
1. **WebAssembly Power**: Compile native C/C++ libraries to run at native speeds in browsers.
2. **Local Equalization**: Applying high-pass filters at 80Hz removes muddy bass frequencies and enhances voice intelligibility.
3. **No-Cloud Security**: Processing local files ensures absolute confidentiality of raw interview recordings.

### Links Mentioned:
* [DecibelCut App](https://decibelcut.com)
* [Web Audio API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
* [FFmpeg WebAssembly](https://ffmpeg.org)`,
    
    chapters: [
      { time: '00:00', title: 'Introduction to Web Audio API' },
      { time: '00:25', title: 'Why WebAssembly and Local Processing Matter' },
      { time: '01:10', title: 'Applying Voice Enhancement Filters (EQ & Low-Cut)' },
      { time: '02:00', title: 'Live Comparison & Sound Evaluation' },
      { time: '02:40', title: 'Episode Outro & Subscriptions' }
    ],
    
    fillerWordsRemovedCount: 8
  };
}

/**
 * Normalizes mixed audio buffer loudness using FFmpeg's loudnorm filter
 */
export async function normalizeLoudnessAndEncode(
  buffer: AudioBuffer,
  platformPreset: 'spotify' | 'apple' | 'youtube' | 'amazon' | 'rss',
  qualityPreset: 'draft' | 'standard' | 'high' | 'studio',
  format: 'mp3' | 'wav' | 'flac' | 'aac' | 'm4a',
  onProgress?: (progress: ExportProgress) => void
): Promise<Blob> {
  onProgress?.({ status: 'preparing', percent: 10, message: 'Creating PCM raw mix…' });
  const wavData = audioBufferToWav(buffer);
  
  onProgress?.({ status: 'preparing', percent: 25, message: 'Loading mastering cores…' });
  const ffmpeg = await loadFFmpeg((p) => {
    onProgress?.({
      status: 'preparing',
      percent: 25 + Math.round(p * 0.15),
      message: 'Loading encoder cores…',
    });
  });

  const inputName = `mixed_${Date.now()}.wav`;
  const outputName = `mastered_${Date.now()}.${format}`;
  
  await ffmpeg.writeFile(inputName, new Uint8Array(wavData));

  // Determine target LUFS loudness limit
  let targetLoudness = -16;
  if (platformPreset === 'spotify' || platformPreset === 'youtube' || platformPreset === 'amazon') {
    targetLoudness = -14;
  } else if (platformPreset === 'apple' || platformPreset === 'rss') {
    targetLoudness = -16;
  }

  // Determine bitrate based on quality presets
  let bitrate = 192;
  if (qualityPreset === 'draft') bitrate = 128;
  else if (qualityPreset === 'standard') bitrate = 192;
  else if (qualityPreset === 'high') bitrate = 256;
  else if (qualityPreset === 'studio') bitrate = 320;

  onProgress?.({ status: 'encoding', percent: 45, message: 'Writing session virtual tracks…' });

  // Compile FFmpeg command
  const args = ['-i', inputName, '-vn'];
  
  // Add loudness normalization filter
  args.push('-filter:a', `loudnorm=I=${targetLoudness}:TP=-1.5:LRA=11`);
  
  // Add codecs & bitrates
  switch (format) {
    case 'mp3':
      args.push('-codec:a', 'libmp3lame', '-b:a', `${bitrate}k`);
      break;
    case 'wav':
      args.push('-codec:a', 'pcm_s16le');
      break;
    case 'flac':
      args.push('-codec:a', 'flac');
      break;
    case 'aac':
    case 'm4a':
      args.push('-codec:a', 'aac', '-b:a', `${bitrate}k`);
      break;
  }

  args.push('-y', outputName);

  onProgress?.({ status: 'encoding', percent: 60, message: 'Mastering multi-track project…' });

  const logHandler = (data: unknown) => {
    const msg = (data as { message?: string })?.message ?? '';
    if (msg.includes('time=')) {
      onProgress?.({ status: 'encoding', percent: 80, message: `Mastering to ${format.toUpperCase()} (${bitrate}kbps)…` });
    }
  };
  ffmpeg.on('log', logHandler);

  const exitCode = await ffmpeg.exec(args);
  ffmpeg.off('log', logHandler);

  if (exitCode !== 0) {
    await ffmpeg.deleteFile(inputName).catch(() => null);
    throw new Error(`Mastering failed with exit code ${exitCode}`);
  }

  onProgress?.({ status: 'encoding', percent: 90, message: 'Packing master…' });
  const data = await ffmpeg.readFile(outputName);

  // Cleanup
  await ffmpeg.deleteFile(inputName).catch(() => null);
  await ffmpeg.deleteFile(outputName).catch(() => null);

  const mimeTypes: Record<string, string> = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    flac: 'audio/flac',
    aac: 'audio/aac',
    m4a: 'audio/mp4',
  };

  onProgress?.({ status: 'complete', percent: 100, message: 'Podcast export ready!' });

  return new Blob([data as unknown as ArrayBuffer], { type: mimeTypes[format] ?? 'audio/mpeg' });
}
