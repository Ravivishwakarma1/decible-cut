// ============================================================
// DecibelCut — Video Cutter Service
// Trims silences and merges video segments client-side via FFmpeg WASM
// ============================================================

import { loadFFmpeg } from './ffmpegService';
import { decodeAudioFile } from './audioEngine';
import { detectSilence } from './silenceDetector';
import type { AudioRegion } from '../types/audio.types';
import type { SilenceDetectionConfig, ExportProgress } from '../types/processing.types';

export interface VideoCutConfig {
  silenceConfig: SilenceDetectionConfig;
  trim: {
    enabled: boolean;
    start: number;
    end: number;
  };
}

/**
 * Scans a video file's audio track for silence and slices/concatenates
 * the video file client-side using FFmpeg WebAssembly.
 */
export async function cutVideoSilences(
  videoFile: File,
  config: VideoCutConfig,
  onProgress?: (progress: ExportProgress) => void
): Promise<Blob> {
  onProgress?.({ status: 'preparing', percent: 5, message: 'Decoding audio track from video…' });

  // 1. Decode audio track from video file using browser Web Audio API
  let audioBuffer;
  try {
    const decoded = await decodeAudioFile(videoFile, (pct) => {
      onProgress?.({
        status: 'preparing',
        percent: 5 + Math.round(pct * 0.25), // 5% to 30%
        message: `Extracting video audio trace (${pct}%)…`,
      });
    });
    audioBuffer = decoded.buffer;
  } catch (err) {
    throw new Error(`Failed to decode audio from video: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 2. Scan audio track for silent regions
  onProgress?.({ status: 'preparing', percent: 35, message: 'Scanning for silent regions…' });
  const silenceResults = detectSilence(audioBuffer, config.silenceConfig);
  const silenceRegions = silenceResults.regions;

  // 3. Compute keep segments
  const startLimit = config.trim.enabled ? config.trim.start : 0;
  const endLimit = config.trim.enabled ? config.trim.end : audioBuffer.duration;

  // Filter and merge overlapping silent regions
  const sorted = [...silenceRegions].sort((a, b) => a.start - b.start);
  const mergedSilences: AudioRegion[] = [];
  for (const r of sorted) {
    if (r.end <= startLimit || r.start >= endLimit) continue; // Out of bounds
    const clampedStart = Math.max(startLimit, r.start);
    const clampedEnd = Math.min(endLimit, r.end);

    if (mergedSilences.length === 0) {
      mergedSilences.push({ ...r, start: clampedStart, end: clampedEnd });
    } else {
      const last = mergedSilences[mergedSilences.length - 1];
      if (clampedStart <= last.end) {
        last.end = Math.max(last.end, clampedEnd);
      } else {
        mergedSilences.push({ ...r, start: clampedStart, end: clampedEnd });
      }
    }
  }

  // Determine keep segments
  const keepSegments: Array<{ start: number; end: number }> = [];
  let cursor = startLimit;
  for (const r of mergedSilences) {
    if (r.start > cursor) {
      keepSegments.push({ start: cursor, end: r.start });
    }
    cursor = r.end;
  }
  if (cursor < endLimit) {
    keepSegments.push({ start: cursor, end: endLimit });
  }

  if (keepSegments.length === 0) {
    throw new Error('Entire video is marked as silence based on your settings. Adjust the threshold.');
  }

  // 4. Load FFmpeg WASM
  onProgress?.({ status: 'preparing', percent: 45, message: 'Loading audio/video modules…' });
  const ffmpeg = await loadFFmpeg((p) => {
    onProgress?.({
      status: 'preparing',
      percent: 45 + Math.round(p * 0.1), // 45% to 55%
      message: 'Loading WebAssembly cores…',
    });
  });

  const ext = videoFile.name.split('.').pop()?.toLowerCase() || 'mp4';
  const inputName = `input_${Date.now()}.${ext}`;
  const outputName = `output_${Date.now()}.${ext}`;

  onProgress?.({ status: 'encoding', percent: 55, message: 'Reading video metadata…' });
  const videoBytes = new Uint8Array(await videoFile.arrayBuffer());
  await ffmpeg.writeFile(inputName, videoBytes);

  // 5. Slice video segments
  onProgress?.({ status: 'encoding', percent: 60, message: 'Slicing video frame boundaries…' });

  const tempFiles: string[] = [];
  for (let i = 0; i < keepSegments.length; i++) {
    const seg = keepSegments[i];
    const segName = `part_${i}_${Date.now()}.${ext}`;
    tempFiles.push(segName);

    const sliceArgs = [
      '-ss',
      seg.start.toFixed(3),
      '-to',
      seg.end.toFixed(3),
      '-i',
      inputName,
      '-c',
      'copy',
      '-map',
      '0',
      '-y',
      segName,
    ];

    onProgress?.({
      status: 'encoding',
      percent: 60 + Math.round((i / keepSegments.length) * 20), // 60% to 80%
      message: `Extracting video segment ${i + 1} of ${keepSegments.length}…`,
    });

    const code = await ffmpeg.exec(sliceArgs);
    if (code !== 0) {
      // Clean up on failure
      await ffmpeg.deleteFile(inputName).catch(() => null);
      for (const f of tempFiles) await ffmpeg.deleteFile(f).catch(() => null);
      throw new Error(`Failed to slice video segment ${i} (exit code ${code})`);
    }
  }

  // 6. Concatenate segments
  onProgress?.({ status: 'encoding', percent: 80, message: 'Re-stitching clean video feed…' });

  let finalBlob: Blob;
  if (tempFiles.length === 1) {
    // Only one segment, read it directly
    const data = await ffmpeg.readFile(tempFiles[0]);
    finalBlob = new Blob([data as unknown as ArrayBuffer], { type: `video/${ext === 'mov' ? 'quicktime' : ext}` });
  } else {
    // Multiple segments, write a concat list file
    const concatText = tempFiles.map((f) => `file '${f}'`).join('\n');
    const concatFileName = `concat_${Date.now()}.txt`;
    await ffmpeg.writeFile(concatFileName, new TextEncoder().encode(concatText));

    const concatArgs = ['-f', 'concat', '-safe', '0', '-i', concatFileName, '-c', 'copy', '-y', outputName];

    const code = await ffmpeg.exec(concatArgs);
    if (code !== 0) {
      // Clean up
      await ffmpeg.deleteFile(inputName).catch(() => null);
      await ffmpeg.deleteFile(concatFileName).catch(() => null);
      for (const f of tempFiles) await ffmpeg.deleteFile(f).catch(() => null);
      throw new Error(`Failed to concatenate video segments (exit code ${code})`);
    }

    const data = await ffmpeg.readFile(outputName);
    finalBlob = new Blob([data as unknown as ArrayBuffer], { type: `video/${ext === 'mov' ? 'quicktime' : ext}` });

    // Clean concat file and output file from FS
    await ffmpeg.deleteFile(concatFileName).catch(() => null);
    await ffmpeg.deleteFile(outputName).catch(() => null);
  }

  // Cleanup all other temp files
  await ffmpeg.deleteFile(inputName).catch(() => null);
  for (const f of tempFiles) await ffmpeg.deleteFile(f).catch(() => null);

  onProgress?.({ status: 'complete', percent: 100, message: 'Video trim complete!' });

  return finalBlob;
}
