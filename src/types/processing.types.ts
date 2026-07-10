// ============================================================
// DecibelCut — Processing Types
// ============================================================

export type PresetId = 'tight-music' | 'natural-podcast' | 'audiobook' | 'custom';

export interface SilenceDetectionConfig {
  threshold: number;          // dBFS, e.g. -40
  minSilenceDuration: number; // seconds, e.g. 1.5
  paddingBefore: number;      // seconds added before each cut
  paddingAfter: number;       // seconds added after each cut
  crossfadeDuration: number;  // seconds for fade-in/out at each cut
}

export interface Preset {
  id: PresetId;
  name: string;
  description: string;
  config: SilenceDetectionConfig;
}

export type ProcessingStatus =
  | 'idle'
  | 'loading'
  | 'analyzing'
  | 'ready'
  | 'processing'
  | 'complete'
  | 'error';

export interface ProcessingProgress {
  stage: 'analyzing' | 'processing' | 'encoding';
  percent: number;
  message: string;
}

export interface ProcessingStatistics {
  originalDuration: number;
  finalDuration: number;
  timeSaved: number;
  silenceRemoved: number;
  numberOfCuts: number;
  averageSilenceLength: number;
  largestRemovedGap: number;
  percentageReduction: number;
}

export interface ExportConfig {
  format: 'mp3' | 'wav' | 'flac';
  bitrate?: number;            // kbps for mp3
  filename: string;
  preserveMetadata: boolean;
}

export type ExportStatus = 'idle' | 'preparing' | 'encoding' | 'complete' | 'error';

export interface ExportProgress {
  status: ExportStatus;
  percent: number;
  message: string;
  downloadUrl?: string;
  filename?: string;
}

// ---- Batch ----

export type BatchItemStatus =
  | 'queued'
  | 'analyzing'
  | 'ready'
  | 'processing'
  | 'complete'
  | 'error'
  | 'cancelled';

export interface BatchItem {
  id: string;
  file: File;
  status: BatchItemStatus;
  progress: number;           // 0-100
  error?: string;
  result?: {
    downloadUrl: string;
    filename: string;
    timeSaved: number;
    percentageReduction: number;
  };
}

// ---- History / Undo-Redo ----

export type EditAction =
  | { type: 'DELETE_REGION'; regionId: string }
  | { type: 'RESTORE_REGION'; regionId: string }
  | { type: 'DETECT_SILENCE'; regions: string[] }
  | { type: 'CLEAR_REGIONS' };

export interface HistoryEntry {
  id: string;
  action: EditAction;
  timestamp: number;
  description: string;
}
