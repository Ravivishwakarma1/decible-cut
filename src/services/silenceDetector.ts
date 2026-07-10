// ============================================================
// DecibelCut — Silence Detector
// Optimized to avoid temporary array allocations during scanning
// ============================================================

import {
  secondsToSamples,
  samplesToSeconds,
  generateId,
} from '../utils/math';
import type { SilenceDetectionConfig } from '../types/processing.types';
import type { SilenceRegion } from '../types/audio.types';
import { ANALYSIS_WINDOW_MS } from '../utils/constants';

export interface SilenceAnalysisResult {
  regions: SilenceRegion[];
  totalSilenceDuration: number;
  averageSilenceDuration: number;
  largestGap: number;
}

/**
 * Calculate dBFS of a segment of a float32 array directly
 */
function calculateDbfsSegment(array: Float32Array, start: number, end: number): number {
  let sum = 0;
  const len = end - start;
  if (len <= 0) return -Infinity;
  for (let i = start; i < end; i++) {
    sum += array[i] * array[i];
  }
  const rms = Math.sqrt(sum / len);
  if (rms <= 0) return -Infinity;
  return 20 * Math.log10(rms);
}

/**
 * Analyze an AudioBuffer and find all silent regions.
 *
 * This function works on channel-averaged samples so it handles both
 * mono and stereo files correctly.
 */
export function detectSilence(
  buffer: AudioBuffer,
  config: SilenceDetectionConfig,
  onProgress?: (percent: number) => void
): SilenceAnalysisResult {
  const { threshold, minSilenceDuration, paddingBefore, paddingAfter } = config;
  const sampleRate = buffer.sampleRate;
  const totalSamples = buffer.length;
  const channels = buffer.numberOfChannels;

  // Build a mono average mix (optimized channel caching)
  const mono = new Float32Array(totalSamples);
  const channelDataArray: Float32Array[] = [];
  for (let ch = 0; ch < channels; ch++) {
    channelDataArray.push(buffer.getChannelData(ch));
  }

  if (channels === 1) {
    mono.set(channelDataArray[0]);
  } else if (channels === 2) {
    const left = channelDataArray[0];
    const right = channelDataArray[1];
    for (let i = 0; i < totalSamples; i++) {
      mono[i] = (left[i] + right[i]) * 0.5;
    }
  } else {
    for (let i = 0; i < totalSamples; i++) {
      let sum = 0;
      for (let ch = 0; ch < channels; ch++) {
        sum += channelDataArray[ch][i];
      }
      mono[i] = sum / channels;
    }
  }

  const windowSamples = secondsToSamples(ANALYSIS_WINDOW_MS / 1000, sampleRate);
  const minSilenceSamples = secondsToSamples(minSilenceDuration, sampleRate);
  const paddingBeforeSamples = secondsToSamples(paddingBefore, sampleRate);
  const paddingAfterSamples = secondsToSamples(paddingAfter, sampleRate);

  const silentWindows: boolean[] = [];
  const totalWindows = Math.ceil(totalSamples / windowSamples);

  // Classify each window as silent or not
  for (let w = 0; w < totalWindows; w++) {
    const start = w * windowSamples;
    const end = Math.min(start + windowSamples, totalSamples);
    
    // Direct segment calculations avoid slicing Float32Arrays 10000+ times
    const dbfs = calculateDbfsSegment(mono, start, end);
    silentWindows.push(dbfs < threshold);

    if (onProgress && w % 100 === 0) {
      onProgress(Math.round((w / totalWindows) * 80));
    }
  }

  // Group consecutive silent windows into regions
  const regions: SilenceRegion[] = [];
  let inSilence = false;
  let silenceStart = 0;

  for (let w = 0; w <= totalWindows; w++) {
    const isSilent = w < totalWindows && silentWindows[w];

    if (isSilent && !inSilence) {
      inSilence = true;
      silenceStart = w * windowSamples;
    } else if (!isSilent && inSilence) {
      inSilence = false;
      const silenceEnd = w * windowSamples;
      const silenceSamples = silenceEnd - silenceStart;

      if (silenceSamples >= minSilenceSamples) {
        // Apply padding (shrink the removed region by padding amounts)
        const paddedStart = silenceStart + paddingBeforeSamples;
        const paddedEnd = silenceEnd - paddingAfterSamples;

        if (paddedStart < paddedEnd) {
          const startSec = samplesToSeconds(paddedStart, sampleRate);
          const endSec = samplesToSeconds(paddedEnd, sampleRate);

          // Calculate average dBFS for this region
          const regionDbfs = calculateDbfsSegment(
            mono,
            Math.round(paddedStart),
            Math.round(paddedEnd)
          );

          regions.push({
            id: generateId(),
            start: startSec,
            end: endSec,
            type: 'silence',
            dbfsLevel: regionDbfs,
            color: 'rgba(239, 68, 68, 0.35)',
          });
        }
      }
    }
  }

  onProgress?.(100);

  const totalSilenceDuration = regions.reduce((sum, r) => sum + (r.end - r.start), 0);
  const averageSilenceDuration =
    regions.length > 0 ? totalSilenceDuration / regions.length : 0;
  const largestGap = regions.reduce((max, r) => Math.max(max, r.end - r.start), 0);

  return {
    regions,
    totalSilenceDuration,
    averageSilenceDuration,
    largestGap,
  };
}
