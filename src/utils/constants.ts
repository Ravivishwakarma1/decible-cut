// ============================================================
// DecibelCut — App Constants & Presets
// ============================================================

import type { Preset } from '../types/processing.types';
import type { KeyboardShortcut } from '../types/ui.types';

export const APP_NAME = 'DecibelCut';
export const APP_VERSION = '1.0.0';
export const APP_DESCRIPTION = 'Privacy-first audio silence remover';

// ---- File limits ----
export const MAX_FILE_SIZE_MB = 500;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// ---- Waveform ----
export const WAVEFORM_HEIGHT = 160;
export const WAVEFORM_COLOR = '#6c63ff';
export const WAVEFORM_PROGRESS_COLOR = '#a78bfa';
export const WAVEFORM_CURSOR_COLOR = '#ffffff';
export const SILENCE_REGION_COLOR = 'rgba(239, 68, 68, 0.35)';
export const SELECTION_REGION_COLOR = 'rgba(99, 102, 241, 0.35)';

// ---- Silence Detection ----
export const DEFAULT_THRESHOLD_DBFS = -40;
export const DEFAULT_MIN_SILENCE_DURATION = 1.5;  // seconds
export const DEFAULT_PADDING_BEFORE = 0.1;
export const DEFAULT_PADDING_AFTER = 0.1;
export const DEFAULT_CROSSFADE_DURATION = 0.03;
export const ANALYSIS_WINDOW_MS = 50;             // ms per RMS window

// ---- Presets ----
export const PRESETS: Preset[] = [
  {
    id: 'tight-music',
    name: 'Tight Music',
    description: 'Aggressively remove silence from music intros and outros',
    config: {
      threshold: -45,
      minSilenceDuration: 0.3,
      paddingBefore: 0.05,
      paddingAfter: 0.05,
      crossfadeDuration: 0.01,
    },
  },
  {
    id: 'natural-podcast',
    name: 'Natural Podcast',
    description: 'Preserve conversational pauses while removing long dead air',
    config: {
      threshold: -40,
      minSilenceDuration: 1.5,
      paddingBefore: 0.2,
      paddingAfter: 0.2,
      crossfadeDuration: 0.05,
    },
  },
  {
    id: 'audiobook',
    name: 'Audiobook',
    description: 'Remove paragraph gaps while maintaining natural pacing',
    config: {
      threshold: -38,
      minSilenceDuration: 0.8,
      paddingBefore: 0.15,
      paddingAfter: 0.15,
      crossfadeDuration: 0.03,
    },
  },
  {
    id: 'custom',
    name: 'Custom',
    description: 'Configure your own silence detection settings',
    config: {
      threshold: -40,
      minSilenceDuration: 1.5,
      paddingBefore: 0.1,
      paddingAfter: 0.1,
      crossfadeDuration: 0.03,
    },
  },
];

// ---- Keyboard Shortcuts ----
export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  { id: 'play-pause', label: 'Play / Pause', keys: ['Space'], category: 'Playback' },
  { id: 'stop', label: 'Stop', keys: ['Escape'], category: 'Playback' },
  { id: 'skip-forward', label: 'Skip Forward 5s', keys: ['ArrowRight'], category: 'Playback' },
  { id: 'skip-backward', label: 'Skip Backward 5s', keys: ['ArrowLeft'], category: 'Playback' },
  { id: 'zoom-in', label: 'Zoom In', keys: ['Ctrl', '='], category: 'Navigation' },
  { id: 'zoom-out', label: 'Zoom Out', keys: ['Ctrl', '-'], category: 'Navigation' },
  { id: 'zoom-fit', label: 'Fit to Window', keys: ['Ctrl', '0'], category: 'Navigation' },
  { id: 'undo', label: 'Undo', keys: ['Ctrl', 'Z'], category: 'Edit' },
  { id: 'redo', label: 'Redo', keys: ['Ctrl', 'Shift', 'Z'], category: 'Edit' },
  { id: 'delete-region', label: 'Delete Selection', keys: ['Delete'], category: 'Edit' },
  { id: 'detect-silence', label: 'Detect Silence', keys: ['Ctrl', 'D'], category: 'General' },
  { id: 'export', label: 'Export', keys: ['Ctrl', 'E'], category: 'General' },
  { id: 'open-file', label: 'Open File', keys: ['Ctrl', 'O'], category: 'General' },
];

// ---- Export ----
export const EXPORT_FORMATS = ['mp3', 'wav', 'flac'] as const;
export const MP3_BITRATES = [128, 192, 256, 320] as const;
export const DEFAULT_MP3_BITRATE = 192;

// ---- Session ----
export const SESSION_DB_NAME = 'decibelcut-session';
export const SESSION_DB_VERSION = 1;
export const SESSION_STORE_NAME = 'session';
export const SESSION_KEY = 'current';
