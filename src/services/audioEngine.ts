// ============================================================
// DecibelCut — Audio Engine
// Handles decoding audio files via Web Audio API
// ============================================================

import type { AudioFileInfo } from '../types/audio.types';
import { SUPPORTED_EXTENSIONS, SUPPORTED_FORMATS } from '../types/audio.types';
import { MAX_FILE_SIZE_BYTES } from '../utils/constants';

let sharedAudioContext: AudioContext | null = null;

/**
 * Get or create a shared AudioContext
 */
export function getAudioContext(): AudioContext {
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new AudioContext();
  }
  if (sharedAudioContext.state === 'suspended') {
    sharedAudioContext.resume();
  }
  return sharedAudioContext;
}

/**
 * Close and release the shared AudioContext
 */
export function closeAudioContext(): void {
  if (sharedAudioContext) {
    sharedAudioContext.close();
    sharedAudioContext = null;
  }
}

/**
 * Validate that a file is an accepted audio format
 */
export function validateAudioFile(file: File): { valid: boolean; error?: string } {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `Unsupported format ".${ext}". Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`,
    };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File too large. Maximum size is ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB`,
    };
  }
  return { valid: true };
}

/**
 * Decode an audio file and extract metadata
 */
export async function decodeAudioFile(
  file: File,
  onProgress?: (percent: number) => void
): Promise<{ buffer: AudioBuffer; info: AudioFileInfo }> {
  const validation = validateAudioFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  onProgress?.(10);

  const arrayBuffer = await file.arrayBuffer();
  onProgress?.(40);

  const ctx = getAudioContext();

  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
  } catch {
    throw new Error(
      'Failed to decode audio. The file may be corrupted or use an unsupported codec.'
    );
  }

  onProgress?.(90);

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const mimeType = SUPPORTED_FORMATS[ext] ?? 'audio/mpeg';

  // Estimate bitrate from file size and duration
  const bitrate =
    audioBuffer.duration > 0
      ? Math.round((file.size * 8) / audioBuffer.duration / 1000)
      : undefined;

  const info: AudioFileInfo = {
    name: file.name,
    size: file.size,
    duration: audioBuffer.duration,
    sampleRate: audioBuffer.sampleRate,
    channels: audioBuffer.numberOfChannels,
    bitrate,
    format: ext.toUpperCase(),
    mimeType,
    file,
  };

  onProgress?.(100);

  return { buffer: audioBuffer, info };
}

/**
 * Convert AudioBuffer to a Blob URL for WaveSurfer playback
 */
export async function audioBufferToUrl(buffer: AudioBuffer): Promise<string> {
  const offlineCtx = new OfflineAudioContext(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );
  const source = offlineCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(offlineCtx.destination);
  source.start();
  const rendered = await offlineCtx.startRendering();
  const wav = audioBufferToWav(rendered);
  const blob = new Blob([wav], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

/**
 * Encode AudioBuffer to raw WAV ArrayBuffer (no external deps)
 */
export function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = buffer.length * blockAlign;

  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave channels
  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channelData.push(buffer.getChannelData(ch));
  }

  const samples = new Int16Array(arrayBuffer, 44);
  const length = buffer.length;
  let offset = 0;

  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = channelData[ch][i];
      const s = sample < -1 ? -1 : sample > 1 ? 1 : sample;
      samples[offset++] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
  }

  return arrayBuffer;
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
