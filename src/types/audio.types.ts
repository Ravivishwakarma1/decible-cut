// ============================================================
// DecibelCut — Audio Types
// ============================================================

export interface AudioFileInfo {
  name: string;
  size: number;
  duration: number;       // seconds
  sampleRate: number;
  channels: number;
  bitrate?: number;       // kbps
  format: string;
  mimeType: string;
  file: File;
}

export interface AudioRegion {
  id: string;
  start: number;          // seconds
  end: number;            // seconds
  type: 'silence' | 'selection' | 'custom';
  color?: string;
  label?: string;
  locked?: boolean;
}

export interface SilenceRegion extends AudioRegion {
  type: 'silence';
  dbfsLevel: number;      // average dBFS in this region
}

export interface ProcessedAudio {
  buffer: AudioBuffer;
  originalDuration: number;
  processedDuration: number;
  cutsApplied: number;
  regionsRemoved: AudioRegion[];
  silenceRemoved: number; // seconds
}

export type AudioFormat = 'mp3' | 'wav' | 'flac';
export type AudioChannel = 'mono' | 'stereo';

export type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'stopped';

export interface PlaybackPosition {
  currentTime: number;    // seconds
  duration: number;       // seconds
  progress: number;       // 0-1
}

export interface WaveformPeaks {
  data: Float32Array;
  length: number;
  sampleRate: number;
}

export type SupportedMimeType =
  | 'audio/mpeg'
  | 'audio/wav'
  | 'audio/flac'
  | 'audio/aac'
  | 'audio/ogg'
  | 'audio/mp4'
  | 'audio/x-m4a'
  | 'audio/webm';

export const SUPPORTED_FORMATS: Record<string, SupportedMimeType> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  webm: 'audio/webm',
};

export const SUPPORTED_EXTENSIONS = Object.keys(SUPPORTED_FORMATS);
