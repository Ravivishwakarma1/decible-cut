// ============================================================
// DecibelCut — Batch Store (Zustand)
// ============================================================

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { BatchItem, BatchItemStatus, ExportConfig } from '../types/processing.types';
import { generateId } from '../utils/math';

interface BatchState {
  items: BatchItem[];
  isRunning: boolean;
  exportConfig: Partial<ExportConfig>;

  addItems: (files: File[]) => void;
  removeItem: (id: string) => void;
  clearCompleted: () => void;
  clearAll: () => void;
  updateItemStatus: (id: string, status: BatchItemStatus, progress?: number) => void;
  updateItemError: (id: string, error: string) => void;
  updateItemResult: (id: string, result: BatchItem['result']) => void;
  moveItem: (fromIndex: number, toIndex: number) => void;
  setRunning: (running: boolean) => void;
  setExportConfig: (config: Partial<ExportConfig>) => void;
}

export const useBatchStore = create<BatchState>()(
  immer((set) => ({
    items: [],
    isRunning: false,
    exportConfig: { format: 'mp3', bitrate: 192 },

    addItems: (files) =>
      set((state) => {
        for (const file of files) {
          state.items.push({
            id: generateId(),
            file,
            status: 'queued',
            progress: 0,
          });
        }
      }),

    removeItem: (id) =>
      set((state) => {
        state.items = state.items.filter((i) => i.id !== id);
      }),

    clearCompleted: () =>
      set((state) => {
        state.items = state.items.filter(
          (i) => i.status !== 'complete' && i.status !== 'error'
        );
      }),

    clearAll: () => set((state) => { state.items = []; }),

    updateItemStatus: (id, status, progress) =>
      set((state) => {
        const item = state.items.find((i) => i.id === id);
        if (item) {
          item.status = status;
          if (progress !== undefined) item.progress = progress;
        }
      }),

    updateItemError: (id, error) =>
      set((state) => {
        const item = state.items.find((i) => i.id === id);
        if (item) {
          item.status = 'error';
          item.error = error;
          item.progress = 0;
        }
      }),

    updateItemResult: (id, result) =>
      set((state) => {
        const item = state.items.find((i) => i.id === id);
        if (item) {
          item.status = 'complete';
          item.progress = 100;
          item.result = result;
        }
      }),

    moveItem: (fromIndex, toIndex) =>
      set((state) => {
        const [item] = state.items.splice(fromIndex, 1);
        state.items.splice(toIndex, 0, item);
      }),

    setRunning: (running) => set((state) => { state.isRunning = running; }),

    setExportConfig: (config) =>
      set((state) => { Object.assign(state.exportConfig, config); }),
  }))
);
