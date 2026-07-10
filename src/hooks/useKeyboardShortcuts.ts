// ============================================================
// DecibelCut — useKeyboardShortcuts Hook
// ============================================================

import { useEffect } from 'react';
import { useAudioStore } from '../store/audioStore';
import { useUIStore } from '../store/uiStore';

interface ShortcutHandlers {
  onPlayPause?: () => void;
  onStop?: () => void;
  onSkipForward?: () => void;
  onSkipBackward?: () => void;
  onDeleteRegion?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomFit?: () => void;
  onDetect?: () => void;
  onExport?: () => void;
  onOpenFile?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const undo = useAudioStore((s) => s.undo);
  const redo = useAudioStore((s) => s.redo);
  const setExportPanelOpen = useUIStore((s) => s.setExportPanelOpen);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // Don't fire shortcuts when inside an input/textarea/select
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      const ctrl = e.ctrlKey || e.metaKey;

      switch (true) {
        case e.code === 'Space' && !ctrl:
          e.preventDefault();
          handlers.onPlayPause?.();
          break;

        case e.code === 'Escape':
          e.preventDefault();
          handlers.onStop?.();
          break;

        case e.code === 'ArrowRight' && !ctrl:
          e.preventDefault();
          handlers.onSkipForward?.();
          break;

        case e.code === 'ArrowLeft' && !ctrl:
          e.preventDefault();
          handlers.onSkipBackward?.();
          break;

        case (e.code === 'Delete' || e.code === 'Backspace') && !ctrl:
          e.preventDefault();
          handlers.onDeleteRegion?.();
          break;

        case e.code === 'KeyZ' && ctrl && !e.shiftKey:
          e.preventDefault();
          handlers.onUndo?.() ?? undo();
          break;

        case e.code === 'KeyZ' && ctrl && e.shiftKey:
          e.preventDefault();
          handlers.onRedo?.() ?? redo();
          break;

        case e.code === 'Equal' && ctrl:
        case e.code === 'NumpadAdd' && ctrl:
          e.preventDefault();
          handlers.onZoomIn?.();
          break;

        case e.code === 'Minus' && ctrl:
        case e.code === 'NumpadSubtract' && ctrl:
          e.preventDefault();
          handlers.onZoomOut?.();
          break;

        case e.code === 'Digit0' && ctrl:
          e.preventDefault();
          handlers.onZoomFit?.();
          break;

        case e.code === 'KeyD' && ctrl:
          e.preventDefault();
          handlers.onDetect?.();
          break;

        case e.code === 'KeyE' && ctrl:
          e.preventDefault();
          handlers.onExport?.() ?? setExportPanelOpen(true);
          break;

        case e.code === 'KeyO' && ctrl:
          e.preventDefault();
          handlers.onOpenFile?.();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers, undo, redo, setExportPanelOpen]);
}
