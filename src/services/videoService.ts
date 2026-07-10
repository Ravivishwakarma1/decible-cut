// ============================================================
// DecibelCut — Video Processing Service
// Clientside extraction of audio from video using FFmpeg WASM
// ============================================================

import { loadFFmpeg } from './ffmpegService';
import type { ExportProgress } from '../types/processing.types';

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  videoCodec: string;
  audioCodec: string;
}

export interface VideoExtractionConfig {
  format: 'mp3' | 'wav' | 'flac' | 'aac' | 'ogg' | 'm4a';
  bitrate?: number; // kbps (e.g., 192)
  sampleRate?: number; // Hz (e.g., 44100)
  channels?: number; // 1 = mono, 2 = stereo
  qualityPreset: 'fast' | 'balanced' | 'best';
  normalize: boolean;
  fadeIn: boolean;
  fadeOut: boolean;
  preserveMetadata: boolean;
  trim: {
    enabled: boolean;
    start: number; // seconds
    end: number; // seconds
  };
}

/**
 * Get video duration, resolution and codecs using browser APIs and signatures
 */
export async function extractVideoMetadata(file: File): Promise<VideoMetadata> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  
  // Basic codec mappings based on standard container formats
  const codecMap: Record<string, { video: string; audio: string }> = {
    mp4: { video: 'H.264 / AVC', audio: 'AAC' },
    webm: { video: 'VP9 / VP8', audio: 'Opus / Vorbis' },
    mov: { video: 'H.264 / ProRes', audio: 'AAC / PCM' },
    mkv: { video: 'H.264 / H.265', audio: 'AAC / AC3' },
    avi: { video: 'MPEG-4 / DivX', audio: 'MP3 / PCM' },
    wmv: { video: 'VC-1 / WMV', audio: 'WMA' },
    flv: { video: 'Sorenson H.263', audio: 'MP3 / AAC' },
    m4v: { video: 'H.264', audio: 'AAC' },
    ts: { video: 'MPEG-2 / H.264', audio: 'AAC / MP3' },
  };

  const detectedCodecs = codecMap[ext] ?? { video: 'Unknown Video', audio: 'Unknown Audio' };

  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    
    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;
    
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        videoCodec: detectedCodecs.video,
        audioCodec: detectedCodecs.audio,
      });
    };

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        duration: 0,
        width: 0,
        height: 0,
        videoCodec: detectedCodecs.video,
        audioCodec: detectedCodecs.audio,
      });
    };
  });
}

/**
 * Extract audio track from video file entirely client-side
 */
export async function extractAudioFromVideo(
  file: File,
  config: VideoExtractionConfig,
  onProgress?: (progress: ExportProgress) => void
): Promise<Blob> {
  onProgress?.({ status: 'preparing', percent: 0, message: 'Initializing FFmpeg WASM…' });

  const videoMeta = await extractVideoMetadata(file);
  const totalDuration = config.trim.enabled
    ? (config.trim.end - config.trim.start)
    : videoMeta.duration;

  const ffmpeg = await loadFFmpeg((p) => {
    onProgress?.({
      status: 'preparing',
      percent: Math.round(p * 0.25),
      message: 'Loading WebAssembly cores…',
    });
  });

  const inputName = `input_${Date.now()}.${file.name.split('.').pop()?.toLowerCase() || 'mp4'}`;
  const outputName = `output_${Date.now()}.${config.format}`;

  onProgress?.({ status: 'encoding', percent: 25, message: 'Reading video file…' });

  // Write video file to FFmpeg virtual file system
  const buffer = await file.arrayBuffer();
  await ffmpeg.writeFile(inputName, new Uint8Array(buffer));

  onProgress?.({ status: 'encoding', percent: 40, message: 'Processing extraction settings…' });

  // Build FFmpeg command arguments
  const args: string[] = [];

  // Trimming parameters (placed before input for faster seeking if possible, or after input for accuracy)
  if (config.trim.enabled) {
    args.push('-ss', config.trim.start.toFixed(3));
    args.push('-to', config.trim.end.toFixed(3));
  }

  args.push('-i', inputName);

  // Audio extraction: disable video stream
  args.push('-vn');

  // Map metadata
  if (config.preserveMetadata) {
    args.push('-map_metadata', '0');
  }

  // Audio Filters (fade, normalize)
  const filters: string[] = [];

  if (config.normalize) {
    // Standard volume normalization filter
    filters.push('loudnorm=I=-16:TP=-1.5:LRA=11');
  }

  if (config.fadeIn) {
    const startOffset = config.trim.enabled ? 0 : 0;
    filters.push(`afade=t=in:ss=${startOffset}:d=2`);
  }

  if (config.fadeOut && totalDuration && totalDuration > 2) {
    const fadeOutStart = totalDuration - 2;
    filters.push(`afade=t=out:st=${fadeOutStart.toFixed(3)}:d=2`);
  }

  if (filters.length > 0) {
    args.push('-filter:a', filters.join(','));
  }

  // Bitrate, Channels & Sample Rate
  if (config.channels) {
    args.push('-ac', config.channels.toString());
  }
  if (config.sampleRate) {
    args.push('-ar', config.sampleRate.toString());
  }

  // Format and Codec Specific parameters
  switch (config.format) {
    case 'mp3':
      args.push('-codec:a', 'libmp3lame');
      if (config.bitrate) {
        args.push('-b:a', `${config.bitrate}k`);
      }
      // Quality presets
      if (config.qualityPreset === 'best') {
        args.push('-q:a', '0'); // highest VBR quality
      }
      break;
    case 'wav':
      args.push('-codec:a', 'pcm_s16le'); // standard 16-bit PCM WAV
      break;
    case 'flac':
      args.push('-codec:a', 'flac');
      break;
    case 'aac':
    case 'm4a':
      args.push('-codec:a', 'aac');
      if (config.bitrate) {
        args.push('-b:a', `${config.bitrate}k`);
      }
      break;
    case 'ogg':
      args.push('-codec:a', 'libvorbis');
      if (config.bitrate) {
        args.push('-b:a', `${config.bitrate}k`);
      }
      break;
  }

  args.push('-y', outputName);

  onProgress?.({ status: 'encoding', percent: 50, message: 'Extracting audio track…' });

  // Track FFmpeg logs for progress tracking
  const logHandler = (data: unknown) => {
    const msg = (data as { message?: string })?.message ?? '';
    const timeMatch = msg.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
    if (timeMatch && totalDuration) {
      const hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      const seconds = parseFloat(`${timeMatch[3]}.${timeMatch[4]}`);
      const elapsed = hours * 3600 + minutes * 60 + seconds;
      
      const pct = Math.min(88, 50 + Math.round((elapsed / totalDuration) * 38));
      onProgress?.({
        status: 'encoding',
        percent: pct,
        message: `Extracting audio track (${Math.round((elapsed / totalDuration) * 100)}%)…`
      });
    } else if (msg.includes('time=')) {
      onProgress?.({ status: 'encoding', percent: 75, message: 'Encoding audio format…' });
    }
  };
  ffmpeg.on('log', logHandler);

  const exitCode = await ffmpeg.exec(args);
  ffmpeg.off('log', logHandler);

  if (exitCode !== 0) {
    await ffmpeg.deleteFile(inputName).catch(() => null);
    throw new Error(`Extraction failed with exit code ${exitCode}`);
  }

  onProgress?.({ status: 'encoding', percent: 90, message: 'Reading extracted track…' });

  const data = await ffmpeg.readFile(outputName);

  // Clean virtual file system to free browser memory
  await ffmpeg.deleteFile(inputName).catch(() => null);
  await ffmpeg.deleteFile(outputName).catch(() => null);

  const mimeTypes: Record<string, string> = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    flac: 'audio/flac',
    aac: 'audio/aac',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',
  };

  onProgress?.({ status: 'encoding', percent: 100, message: 'Finalizing…' });

  return new Blob([data as unknown as ArrayBuffer], { type: mimeTypes[config.format] ?? 'audio/mpeg' });
}
