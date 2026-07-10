// ============================================================
// DecibelCut — Export Service
// Orchestrates the full export pipeline
// ============================================================

import type { ExportConfig, ExportProgress } from '../types/processing.types';
import type { ProcessedAudio } from '../types/audio.types';
import { audioBufferToWav } from './audioEngine';
import { encodeAudio } from './ffmpegService';

export async function exportAudio(
  processedAudio: ProcessedAudio,
  config: ExportConfig,
  onProgress?: (progress: ExportProgress) => void
): Promise<void> {
  onProgress?.({ status: 'preparing', percent: 0, message: 'Preparing audio data…' });

  // Step 1: Convert AudioBuffer → WAV ArrayBuffer
  const wavData = audioBufferToWav(processedAudio.buffer);
  onProgress?.({ status: 'preparing', percent: 20, message: 'Audio data ready' });

  // Step 2: Encode to target format
  let outputBlob: Blob;

  if (config.format === 'wav') {
    // WAV is already done — no re-encoding needed
    outputBlob = new Blob([wavData], { type: 'audio/wav' });
    onProgress?.({ status: 'encoding', percent: 80, message: 'Finalizing WAV…' });
  } else {
    outputBlob = await encodeAudio(wavData, config, (progress) => {
      // Map encoding 20→90% of total progress
      onProgress?.({
        ...progress,
        percent: 20 + Math.round(progress.percent * 0.7),
      });
    });
  }

  onProgress?.({ status: 'encoding', percent: 95, message: 'Creating download…' });

  // Step 3: Trigger download
  const url = URL.createObjectURL(outputBlob);
  const filename = sanitizeFilename(config.filename, config.format);
  triggerDownload(url, filename);

  // Cleanup after download is triggered
  setTimeout(() => URL.revokeObjectURL(url), 10_000);

  onProgress?.({
    status: 'complete',
    percent: 100,
    message: 'Export complete!',
    downloadUrl: url,
    filename,
  });
}

function triggerDownload(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function sanitizeFilename(name: string, format: string): string {
  // Remove or replace invalid characters
  const base = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
  // Remove existing extension if present
  const withoutExt = base.replace(/\.[^.]+$/, '');
  return `${withoutExt}.${format}`;
}
