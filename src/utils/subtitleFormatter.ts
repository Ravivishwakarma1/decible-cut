// ============================================================
// DecibelCut — Utility: Subtitle & Transcript Formatters
// ============================================================

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

/**
 * Format seconds into SRT timestamp (HH:MM:SS,mmm)
 */
function formatSrtTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '00:00:00,000';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

/**
 * Format seconds into VTT timestamp (HH:MM:SS.mmm)
 */
function formatVttTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '00:00:00.000';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

/**
 * Convert transcription segments to SRT format string
 */
export function convertToSRT(segments: TranscriptSegment[]): string {
  return segments.map((seg, idx) => {
    const num = idx + 1;
    const startStr = formatSrtTime(seg.start);
    const endStr = formatSrtTime(seg.end);
    const speakerPrefix = seg.speaker ? `${seg.speaker}: ` : '';
    return `${num}\n${startStr} --> ${endStr}\n${speakerPrefix}${seg.text}\n`;
  }).join('\n');
}

/**
 * Convert transcription segments to WebVTT format string
 */
export function convertToVTT(segments: TranscriptSegment[]): string {
  const body = segments.map((seg, idx) => {
    const num = idx + 1;
    const startStr = formatVttTime(seg.start);
    const endStr = formatVttTime(seg.end);
    const speakerPrefix = seg.speaker ? `${seg.speaker}: ` : '';
    return `${num}\n${startStr} --> ${endStr}\n${speakerPrefix}${seg.text}\n`;
  }).join('\n');
  return `WEBVTT\n\n${body}`;
}

/**
 * Convert transcription segments to CSV format string
 */
export function convertToCSV(segments: TranscriptSegment[]): string {
  const headers = '"Start Time","End Time","Speaker","Text"';
  const rows = segments.map((seg) => {
    const startStr = seg.start.toFixed(3);
    const endStr = seg.end.toFixed(3);
    const speaker = seg.speaker || 'Speaker 1';
    const escapedText = seg.text.replace(/"/g, '""');
    return `"${startStr}","${endStr}","${speaker}","${escapedText}"`;
  });
  return [headers, ...rows].join('\n');
}

/**
 * Convert transcription segments to plain paragraph text
 */
export function convertToTXT(segments: TranscriptSegment[]): string {
  return segments.map((seg) => {
    const speakerPrefix = seg.speaker ? `[${seg.speaker}] ` : '';
    return `${speakerPrefix}${seg.text}`;
  }).join('\n\n');
}
