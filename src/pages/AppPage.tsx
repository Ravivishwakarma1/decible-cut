import React, { useState, useCallback } from 'react';
import styles from './AppPage.module.css';
import { TopBar } from '../components/layout/TopBar';
import { Sidebar } from '../components/layout/Sidebar';
import { WaveformEditor } from '../components/waveform/WaveformEditor';
import { PlaybackControls } from '../components/playback/PlaybackControls';
import { FileDropzone } from '../components/upload/FileDropzone';
import { ExportPanel } from '../components/export/ExportPanel';
import { ToastContainer } from '../components/ui/Toast';
import { KeyboardShortcutsModal } from '../components/ui/KeyboardShortcutsModal/KeyboardShortcutsModal';
import { useAudioStore } from '../store/audioStore';
import { useUIStore } from '../store/uiStore';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useSession } from '../hooks/useSession';

export const AppPage: React.FC = () => {
  const fileInfo = useAudioStore((s) => s.fileInfo);
  const deleteRegion = useAudioStore((s) => s.deleteRegion);
  const selectedRegionId = useAudioStore((s) => s.selectedRegionId);
  const undo = useAudioStore((s) => s.undo);
  const redo = useAudioStore((s) => s.redo);

  const setZoom = useUIStore((s) => s.setZoom);
  const zoom = useUIStore((s) => s.zoom);
  const setExportOpen = useUIStore((s) => s.setExportPanelOpen);

  const [playbackTime, setPlaybackTime] = useState(0);

  // Auto-save session
  useSession();

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onDeleteRegion: useCallback(() => {
      if (selectedRegionId) deleteRegion(selectedRegionId);
    }, [selectedRegionId, deleteRegion]),
    onUndo: undo,
    onRedo: redo,
    onZoomIn: () => setZoom(Math.min(zoom * 1.5, 500)),
    onZoomOut: () => setZoom(Math.max(zoom / 1.5, 1)),
    onZoomFit: () => setZoom(1),
    onExport: () => setExportOpen(true),
  });

  const hasFile = !!fileInfo;

  return (
    <div className={styles.root}>
      <TopBar />

      <div className={styles.body}>
        <Sidebar />

        <main className={styles.main}>
          {hasFile ? (
            <div className={styles.editorArea}>
              {/* Waveform */}
              <div className={styles.waveformSection}>
                <WaveformEditor
                  onSeek={setPlaybackTime}
                  playbackTime={playbackTime}
                />
              </div>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyContent}>
                <div className={styles.emptyIcon}>🎧</div>
                <h2 className={styles.emptyTitle}>Drop your audio file here</h2>
                <p className={styles.emptySubtitle}>
                  DecibelCut will automatically detect and remove silence
                </p>
                <div className={styles.dropzoneWrapper}>
                  <FileDropzone />
                </div>
                <div className={styles.formatsList}>
                  <span className={styles.formatsLabel}>Supported formats:</span>
                  {['MP3', 'WAV', 'FLAC', 'AAC', 'OGG', 'M4A'].map((f) => (
                    <span key={f} className={styles.formatBadge}>{f}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Bottom playback bar */}
      <PlaybackControls onTimeUpdate={setPlaybackTime} />

      {/* Modals */}
      <ExportPanel />
      <KeyboardShortcutsModal />

      {/* Toasts */}
      <ToastContainer />
    </div>
  );
};
