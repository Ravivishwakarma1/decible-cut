// ============================================================
// DecibelCut — UI Store (Zustand)
// Manages theme, panels, toasts, modals
// ============================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { Theme, ToastMessage, ResizablePanel } from '../types/ui.types';
import { generateId } from '../utils/math';

interface UIState {
  theme: Theme;
  sidebarCollapsed: boolean;
  batchPanelOpen: boolean;
  panels: ResizablePanel[];
  toasts: ToastMessage[];
  isExportPanelOpen: boolean;
  isSettingsPanelOpen: boolean;
  isKeyboardShortcutsOpen: boolean;
  isAboutOpen: boolean;
  zoom: number;        // waveform zoom level 1-500
  scrollLeft: number;  // waveform scroll position in pixels

  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  toggleBatchPanel: () => void;
  setExportPanelOpen: (open: boolean) => void;
  setSettingsPanelOpen: (open: boolean) => void;
  setKeyboardShortcutsOpen: (open: boolean) => void;
  setAboutOpen: (open: boolean) => void;
  setZoom: (zoom: number) => void;
  setScrollLeft: (left: number) => void;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    immer((set) => ({
      theme: 'dark',
      sidebarCollapsed: false,
      batchPanelOpen: false,
      panels: [],
      toasts: [],
      isExportPanelOpen: false,
      isSettingsPanelOpen: false,
      isKeyboardShortcutsOpen: false,
      isAboutOpen: false,
      zoom: 1,
      scrollLeft: 0,

      setTheme: (theme) => set((state) => { state.theme = theme; }),
      toggleSidebar: () => set((state) => { state.sidebarCollapsed = !state.sidebarCollapsed; }),
      toggleBatchPanel: () => set((state) => { state.batchPanelOpen = !state.batchPanelOpen; }),
      setExportPanelOpen: (open) => set((state) => { state.isExportPanelOpen = open; }),
      setSettingsPanelOpen: (open) => set((state) => { state.isSettingsPanelOpen = open; }),
      setKeyboardShortcutsOpen: (open) => set((state) => { state.isKeyboardShortcutsOpen = open; }),
      setAboutOpen: (open) => set((state) => { state.isAboutOpen = open; }),
      setZoom: (zoom) => set((state) => { state.zoom = zoom; }),
      setScrollLeft: (left) => set((state) => { state.scrollLeft = left; }),

      addToast: (toast) =>
        set((state) => {
          const id = generateId();
          state.toasts.push({ ...toast, id });
          // Auto-remove after duration
          if (toast.duration !== 0) {
            const duration = toast.duration ?? 4000;
            setTimeout(() => {
              set((s) => { s.toasts = s.toasts.filter((t) => t.id !== id); });
            }, duration);
          }
        }),

      removeToast: (id) =>
        set((state) => { state.toasts = state.toasts.filter((t) => t.id !== id); }),

      clearToasts: () => set((state) => { state.toasts = []; }),
    })),
    {
      name: 'decibelcut-ui',
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);
