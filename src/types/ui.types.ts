// ============================================================
// DecibelCut — UI Types
// ============================================================

export type Theme = 'dark' | 'light' | 'system';

export type PanelId = 'sidebar' | 'batch' | 'settings';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;  // ms, 0 = persistent
}

export interface KeyboardShortcut {
  id: string;
  label: string;
  keys: string[];     // e.g. ['Space'], ['Ctrl', 'Z']
  category: 'Playback' | 'Edit' | 'Navigation' | 'General';
}

export interface ModalState {
  id: string;
  isOpen: boolean;
  data?: unknown;
}

export type SidebarSection = 'file-info' | 'presets' | 'silence-controls' | 'statistics';

export interface ResizablePanel {
  id: PanelId;
  width: number;
  minWidth: number;
  maxWidth: number;
  isCollapsed: boolean;
}
