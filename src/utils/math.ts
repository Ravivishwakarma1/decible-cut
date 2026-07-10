// ============================================================
// DecibelCut — Utility: Math / DSP
// ============================================================

/**
 * Convert linear amplitude to dBFS
 */
export function linearToDbfs(amplitude: number): number {
  if (amplitude <= 0) return -Infinity;
  return 20 * Math.log10(amplitude);
}

/**
 * Convert dBFS to linear amplitude
 */
export function dbfsToLinear(dbfs: number): number {
  return Math.pow(10, dbfs / 20);
}

/**
 * Calculate RMS of a float32 sample array
 */
export function calculateRms(samples: Float32Array | number[]): number {
  let sum = 0;
  const len = samples.length;
  if (len === 0) return 0;
  for (let i = 0; i < len; i++) {
    sum += (samples as Float32Array)[i] * (samples as Float32Array)[i];
  }
  return Math.sqrt(sum / len);
}

/**
 * Calculate dBFS of a float32 sample array
 */
export function calculateDbfs(samples: Float32Array | number[]): number {
  return linearToDbfs(calculateRms(samples));
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Apply a linear fade envelope to a Float32Array segment
 * @param samples — the samples to modify in place
 * @param fadeInSamples — number of samples for fade in
 * @param fadeOutSamples — number of samples for fade out
 */
export function applyFade(
  samples: Float32Array,
  fadeInSamples: number,
  fadeOutSamples: number
): void {
  const len = samples.length;
  for (let i = 0; i < Math.min(fadeInSamples, len); i++) {
    samples[i] *= i / fadeInSamples;
  }
  for (let i = 0; i < Math.min(fadeOutSamples, len); i++) {
    const idx = len - 1 - i;
    if (idx >= 0) {
      samples[idx] *= i / fadeOutSamples;
    }
  }
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Round to N decimal places
 */
export function round(value: number, decimals = 2): number {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

/**
 * Convert seconds to sample count
 */
export function secondsToSamples(seconds: number, sampleRate: number): number {
  return Math.round(seconds * sampleRate);
}

/**
 * Convert sample count to seconds
 */
export function samplesToSeconds(samples: number, sampleRate: number): number {
  return samples / sampleRate;
}
