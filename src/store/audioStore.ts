// ============================================================
// DecibelCut — Audio Store (Zustand)
// Central state for audio file, detection, and processing
// ============================================================

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { AudioFileInfo, AudioRegion, ProcessedAudio } from '../types/audio.types';
import type {
  ProcessingStatus,
  ProcessingProgress,
  ProcessingStatistics,
  SilenceDetectionConfig,
  PresetId,
} from '../types/processing.types';
import { PRESETS } from '../utils/constants';
import { generateId } from '../utils/math';
import type { HistoryEntry, EditAction } from '../types/processing.types';

interface AudioState {
  // File
  fileInfo: AudioFileInfo | null;
  audioBuffer: AudioBuffer | null;
  processedAudio: ProcessedAudio | null;
  audioUrl: string | null;           // blob url for WaveSurfer
  processedUrl: string | null;       // blob url after processing

  // Detection config
  activePresetId: PresetId;
  config: SilenceDetectionConfig;

  // Status
  status: ProcessingStatus;
  loadProgress: number;
  detectionProgress: number;
  processingProgress: ProcessingProgress | null;

  // Regions
  silenceRegions: AudioRegion[];     // detected silence
  activeRegions: AudioRegion[];      // regions currently shown (may be edited)
  selectedRegionId: string | null;

  // Statistics
  statistics: ProcessingStatistics | null;

  // History (undo/redo)
  history: HistoryEntry[];
  historyIndex: number;

  // Actions
  setFile: (info: AudioFileInfo, buffer: AudioBuffer, url: string) => void;
  clearFile: () => void;
  setConfig: (config: Partial<SilenceDetectionConfig>) => void;
  setPreset: (presetId: PresetId) => void;
  setStatus: (status: ProcessingStatus) => void;
  setLoadProgress: (p: number) => void;
  setDetectionProgress: (p: number) => void;
  setProcessingProgress: (p: ProcessingProgress | null) => void;
  setSilenceRegions: (regions: AudioRegion[]) => void;
  setActiveRegions: (regions: AudioRegion[]) => void;
  selectRegion: (id: string | null) => void;
  deleteRegion: (id: string) => void;
  addRegion: (region: Omit<AudioRegion, 'id'>) => void;
  setProcessedAudio: (audio: ProcessedAudio, url: string) => void;
  setStatistics: (stats: ProcessingStatistics) => void;
  pushHistory: (action: EditAction, description: string) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
}

const initialConfig = PRESETS.find((p) => p.id === 'natural-podcast')!.config;

export const useAudioStore = create<AudioState>()(
  immer((set, get) => ({
    fileInfo: null,
    audioBuffer: null,
    processedAudio: null,
    audioUrl: null,
    processedUrl: null,
    activePresetId: 'natural-podcast',
    config: initialConfig,
    status: 'idle',
    loadProgress: 0,
    detectionProgress: 0,
    processingProgress: null,
    silenceRegions: [],
    activeRegions: [],
    selectedRegionId: null,
    statistics: null,
    history: [],
    historyIndex: -1,

    setFile: (info, buffer, url) =>
      set((state) => {
        // Revoke old blob URL
        if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
        if (state.processedUrl) URL.revokeObjectURL(state.processedUrl);
        state.fileInfo = info;
        state.audioBuffer = buffer;
        state.audioUrl = url;
        state.processedAudio = null;
        state.processedUrl = null;
        state.silenceRegions = [];
        state.activeRegions = [];
        state.statistics = null;
        state.status = 'ready';
        state.history = [];
        state.historyIndex = -1;
      }),

    clearFile: () =>
      set((state) => {
        if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
        if (state.processedUrl) URL.revokeObjectURL(state.processedUrl);
        state.fileInfo = null;
        state.audioBuffer = null;
        state.audioUrl = null;
        state.processedAudio = null;
        state.processedUrl = null;
        state.silenceRegions = [];
        state.activeRegions = [];
        state.statistics = null;
        state.status = 'idle';
        state.history = [];
        state.historyIndex = -1;
      }),

    setConfig: (config) =>
      set((state) => {
        Object.assign(state.config, config);
        state.activePresetId = 'custom';
      }),

    setPreset: (presetId) =>
      set((state) => {
        const preset = PRESETS.find((p) => p.id === presetId);
        if (preset) {
          state.activePresetId = presetId;
          state.config = { ...preset.config };
        }
      }),

    setStatus: (status) => set((state) => { state.status = status; }),
    setLoadProgress: (p) => set((state) => { state.loadProgress = p; }),
    setDetectionProgress: (p) => set((state) => { state.detectionProgress = p; }),
    setProcessingProgress: (p) => set((state) => { state.processingProgress = p; }),

    setSilenceRegions: (regions) =>
      set((state) => {
        state.silenceRegions = regions;
        state.activeRegions = [...regions];
      }),

    setActiveRegions: (regions) => set((state) => { state.activeRegions = regions; }),

    selectRegion: (id) => set((state) => { state.selectedRegionId = id; }),

    deleteRegion: (id) =>
      set((state) => {
        state.activeRegions = state.activeRegions.filter((r) => r.id !== id);
        if (state.selectedRegionId === id) state.selectedRegionId = null;
        if (state.status === 'complete') {
          state.status = 'ready';
          state.processedAudio = null;
          if (state.processedUrl) URL.revokeObjectURL(state.processedUrl);
          state.processedUrl = null;
        }
      }),

    addRegion: (region) =>
      set((state) => {
        state.activeRegions.push({ ...region, id: generateId() });
        if (state.status === 'complete') {
          state.status = 'ready';
          state.processedAudio = null;
          if (state.processedUrl) URL.revokeObjectURL(state.processedUrl);
          state.processedUrl = null;
        }
      }),

    setProcessedAudio: (audio, url) =>
      set((state) => {
        if (state.processedUrl) URL.revokeObjectURL(state.processedUrl);
        state.processedAudio = audio;
        state.processedUrl = url;
        state.status = 'complete';
      }),

    setStatistics: (stats) => set((state) => { state.statistics = stats; }),

    pushHistory: (action, description) =>
      set((state) => {
        // Truncate forward history
        state.history = state.history.slice(0, state.historyIndex + 1);
        state.history.push({
          id: generateId(),
          action,
          timestamp: Date.now(),
          description,
        });
        state.historyIndex = state.history.length - 1;
      }),

    undo: () => {
      const { historyIndex, history } = get();
      if (historyIndex < 0) return;
      const entry = history[historyIndex];
      set((state) => { state.historyIndex--; });
      // Reverse the action
      if (entry.action.type === 'DELETE_REGION') {
        const regionId = (entry.action as { type: 'DELETE_REGION'; regionId: string }).regionId;
        const region = get().silenceRegions.find((r) => r.id === regionId);
        if (region) get().setActiveRegions([...get().activeRegions, region]);
      }
    },

    redo: () => {
      const { historyIndex, history } = get();
      if (historyIndex >= history.length - 1) return;
      const entry = history[historyIndex + 1];
      set((state) => { state.historyIndex++; });
      if (entry.action.type === 'DELETE_REGION') {
        const regionId = (entry.action as { type: 'DELETE_REGION'; regionId: string }).regionId;
        get().deleteRegion(regionId);
      }
    },

    reset: () =>
      set((state) => {
        state.status = 'idle';
        state.silenceRegions = [];
        state.activeRegions = [];
        state.statistics = null;
        state.processedAudio = null;
        if (state.processedUrl) URL.revokeObjectURL(state.processedUrl);
        state.processedUrl = null;
        state.history = [];
        state.historyIndex = -1;
      }),
  }))
);
