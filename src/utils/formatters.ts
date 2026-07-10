// ============================================================
// DecibelCut — Utility: Formatters
// ============================================================

/**
 * Format seconds into HH:MM:SS or MM:SS
 */
export function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${pad(m)}:${pad(s)}`;
  }
  return `${m}:${pad(s)}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

/**
 * Format duration with milliseconds: MM:SS.mmm
 */
export function formatDurationMs(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00.000';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${m}:${pad(s)}.${ms.toString().padStart(3, '0')}`;
}

/**
 * Format bytes into human-readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}

/**
 * Format sample rate to readable string
 */
export function formatSampleRate(hz: number): string {
  if (hz >= 1000) {
    return `${(hz / 1000).toFixed(1)} kHz`;
  }
  return `${hz} Hz`;
}

/**
 * Format channel count to label
 */
export function formatChannels(n: number): string {
  if (n === 1) return 'Mono';
  if (n === 2) return 'Stereo';
  return `${n} ch`;
}

/**
 * Format dBFS value
 */
export function formatDbfs(value: number): string {
  return `${value.toFixed(1)} dBFS`;
}

/**
 * Format percentage
 */
export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format bitrate in kbps
 */
export function formatBitrate(kbps: number): string {
  return `${kbps} kbps`;
}

/**
 * Truncate filename to reasonable display length
 */
export function truncateFilename(name: string, maxLength = 30): string {
  if (name.length <= maxLength) return name;
  const ext = name.lastIndexOf('.') > 0 ? name.slice(name.lastIndexOf('.')) : '';
  const base = name.slice(0, name.lastIndexOf('.') > 0 ? name.lastIndexOf('.') : name.length);
  return `${base.slice(0, maxLength - ext.length - 3)}...${ext}`;
}
