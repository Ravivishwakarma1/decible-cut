// ============================================================
// DecibelCut — useSession Hook
// Auto-save and restore editing session
// ============================================================

import { useEffect, useRef } from 'react';
import { useAudioStore } from '../store/audioStore';
import { useUIStore } from '../store/uiStore';
import { useSettingsStore } from '../store/settingsStore';
import { saveSession } from '../services/sessionService';

const SAVE_DEBOUNCE_MS = 2000;

export function useSession() {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveSession = useSettingsStore((s) => s.autoSaveSession);
  const fileInfo = useAudioStore((s) => s.fileInfo);
  const config = useAudioStore((s) => s.config);
  const activePresetId = useAudioStore((s) => s.activePresetId);
  const activeRegions = useAudioStore((s) => s.activeRegions);
  const zoom = useUIStore((s) => s.zoom);
  const scrollLeft = useUIStore((s) => s.scrollLeft);

  useEffect(() => {
    if (!autoSaveSession || !fileInfo) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(() => {
      saveSession({
        timestamp: Date.now(),
        fileName: fileInfo.name,
        fileSize: fileInfo.size,
        config,
        presetId: activePresetId,
        activeRegions,
        zoom,
        scrollLeft,
      });
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [autoSaveSession, fileInfo, config, activePresetId, activeRegions, zoom, scrollLeft]);
}
