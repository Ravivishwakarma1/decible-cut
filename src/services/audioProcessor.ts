// ============================================================
// DecibelCut — Audio Processor
// Stitches non-silent segments with crossfades
// ============================================================

import type { AudioRegion, ProcessedAudio } from '../types/audio.types';
import type { SilenceDetectionConfig } from '../types/processing.types';
import { applyFade, secondsToSamples } from '../utils/math';
import { getAudioContext } from './audioEngine';

/**
 * Process an AudioBuffer by removing the given silent regions
 * and stitching the remaining segments together with crossfades.
 */
export async function processAudio(
  buffer: AudioBuffer,
  silenceRegions: AudioRegion[],
  config: SilenceDetectionConfig,
  onProgress?: (percent: number) => void
): Promise<ProcessedAudio> {
  if (silenceRegions.length === 0) {
    return {
      buffer,
      originalDuration: buffer.duration,
      processedDuration: buffer.duration,
      cutsApplied: 0,
      regionsRemoved: [],
      silenceRemoved: 0,
    };
  }

  const sampleRate = buffer.sampleRate;
  const numChannels = buffer.numberOfChannels;
  const crossfadeSamples = secondsToSamples(config.crossfadeDuration, sampleRate);

  // Sort and deduplicate/merge overlapping regions
  const sorted = [...silenceRegions].sort((a, b) => a.start - b.start);
  const merged = mergeRegions(sorted);

  onProgress?.(20);

  // Build keep segments (the non-silent parts)
  const keepSegments: Array<{ start: number; end: number }> = [];
  let cursor = 0;

  for (const region of merged) {
    if (region.start > cursor) {
      keepSegments.push({ start: cursor, end: region.start });
    }
    cursor = region.end;
  }

  // Add the last segment after the final silence
  if (cursor < buffer.duration) {
    keepSegments.push({ start: cursor, end: buffer.duration });
  }

  onProgress?.(40);

  // Calculate total output length
  let totalOutputSamples = 0;
  for (const seg of keepSegments) {
    const segSamples = secondsToSamples(seg.end - seg.start, sampleRate);
    totalOutputSamples += Math.max(0, segSamples);
  }

  const ctx = getAudioContext();
  const outputBuffer = ctx.createBuffer(numChannels, totalOutputSamples, sampleRate);

  onProgress?.(50);

  // Copy and fade each segment
  let outputOffset = 0;
  const totalSegments = keepSegments.length;

  for (let s = 0; s < totalSegments; s++) {
    const seg = keepSegments[s];
    const startSample = secondsToSamples(seg.start, sampleRate);
    const endSample = secondsToSamples(seg.end, sampleRate);
    const segLen = endSample - startSample;

    if (segLen <= 0) continue;

    for (let ch = 0; ch < numChannels; ch++) {
      const inputData = buffer.getChannelData(ch);
      const outputData = outputBuffer.getChannelData(ch);

      // Copy segment samples
      const segment = new Float32Array(segLen);
      for (let i = 0; i < segLen; i++) {
        segment[i] = inputData[startSample + i] ?? 0;
      }

      // Apply fade-in if not the first segment
      const fadeIn = s > 0 ? Math.min(crossfadeSamples, Math.floor(segLen / 4)) : 0;
      // Apply fade-out if not the last segment
      const fadeOut =
        s < totalSegments - 1 ? Math.min(crossfadeSamples, Math.floor(segLen / 4)) : 0;

      applyFade(segment, fadeIn, fadeOut);

      // Write to output
      for (let i = 0; i < segLen && outputOffset + i < totalOutputSamples; i++) {
        outputData[outputOffset + i] = segment[i];
      }
    }

    outputOffset += segLen;

    onProgress?.(50 + Math.round((s / totalSegments) * 45));
  }

  onProgress?.(100);

  const silenceRemoved = merged.reduce((sum, r) => sum + (r.end - r.start), 0);

  return {
    buffer: outputBuffer,
    originalDuration: buffer.duration,
    processedDuration: outputBuffer.duration,
    cutsApplied: merged.length,
    regionsRemoved: merged,
    silenceRemoved,
  };
}

/**
 * Merge overlapping regions
 */
function mergeRegions(sorted: AudioRegion[]): AudioRegion[] {
  if (sorted.length === 0) return [];
  const merged: AudioRegion[] = [{ ...sorted[0] }];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const curr = sorted[i];
    if (curr.start <= last.end) {
      last.end = Math.max(last.end, curr.end);
    } else {
      merged.push({ ...curr });
    }
  }

  return merged;
}
