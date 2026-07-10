// ============================================================
// DecibelCut — Settings Store (Zustand + persist)
// ============================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { Theme } from '../types/ui.types';
import type { PresetId } from '../types/processing.types';

interface SettingsState {
  theme: Theme;
  defaultPreset: PresetId;
  defaultExportFormat: 'mp3' | 'wav' | 'flac';
  defaultBitrate: number;
  autoSaveSession: boolean;
  showKeyboardHints: boolean;
  waveformBarWidth: number;
  waveformBarGap: number;
  adConsent: 'granted' | 'denied' | 'undecided';

  setTheme: (theme: Theme) => void;
  setDefaultPreset: (preset: PresetId) => void;
  setDefaultExportFormat: (format: 'mp3' | 'wav' | 'flac') => void;
  setDefaultBitrate: (bitrate: number) => void;
  setAutoSaveSession: (value: boolean) => void;
  setShowKeyboardHints: (value: boolean) => void;
  setWaveformBarWidth: (value: number) => void;
  setWaveformBarGap: (value: number) => void;
  setAdConsent: (consent: 'granted' | 'denied') => void;
  resetToDefaults: () => void;
}

const defaults = {
  theme: 'dark' as Theme,
  defaultPreset: 'natural-podcast' as PresetId,
  defaultExportFormat: 'mp3' as const,
  defaultBitrate: 192,
  autoSaveSession: true,
  showKeyboardHints: true,
  waveformBarWidth: 2,
  waveformBarGap: 1,
  adConsent: 'undecided' as 'granted' | 'denied' | 'undecided',
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    immer((set) => ({
      ...defaults,

      setTheme: (theme) => set((state) => { state.theme = theme; }),
      setDefaultPreset: (preset) => set((state) => { state.defaultPreset = preset; }),
      setDefaultExportFormat: (format) => set((state) => { state.defaultExportFormat = format; }),
      setDefaultBitrate: (bitrate) => set((state) => { state.defaultBitrate = bitrate; }),
      setAutoSaveSession: (value) => set((state) => { state.autoSaveSession = value; }),
      setShowKeyboardHints: (value) => set((state) => { state.showKeyboardHints = value; }),
      setWaveformBarWidth: (value) => set((state) => { state.waveformBarWidth = value; }),
      setWaveformBarGap: (value) => set((state) => { state.waveformBarGap = value; }),
      setAdConsent: (consent) => set((state) => { state.adConsent = consent; }),
      resetToDefaults: () => set(() => ({ ...defaults })),
    })),
    {
      name: 'decibelcut-settings',
    }
  )
);
