import React, { useState, useCallback } from 'react';
import styles from './AppPage.module.css';
import { TopBar } from '../components/layout/TopBar';
import { Sidebar } from '../components/layout/Sidebar';
import { WaveformEditor } from '../components/waveform/WaveformEditor';
import { TranscriptEditor } from '../components/processing/TranscriptEditor/TranscriptEditor';
import { PlaybackControls } from '../components/playback/PlaybackControls';
import { FileDropzone } from '../components/upload/FileDropzone';
import { ExportPanel } from '../components/export/ExportPanel';
import { ToastContainer } from '../components/ui/Toast';
import { KeyboardShortcutsModal } from '../components/ui/KeyboardShortcutsModal/KeyboardShortcutsModal';
import { useAudioStore } from '../store/audioStore';
import { useUIStore } from '../store/uiStore';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useSession } from '../hooks/useSession';
import { useSEO } from '../hooks/useSEO';

export const AppPage: React.FC = () => {
  useSEO({
    title: 'Audio Silence Remover App | DecibelCut',
    description: 'Intelligently scan audio files and remove silent gaps and dead air automatically. All processing runs locally in your browser.'
  });

  const fileInfo = useAudioStore((s) => s.fileInfo);
  const deleteRegion = useAudioStore((s) => s.deleteRegion);
  const selectedRegionId = useAudioStore((s) => s.selectedRegionId);
  const undo = useAudioStore((s) => s.undo);
  const redo = useAudioStore((s) => s.redo);

  const setZoom = useUIStore((s) => s.setZoom);
  const zoom = useUIStore((s) => s.zoom);
  const setExportOpen = useUIStore((s) => s.setExportPanelOpen);

  const [playbackTime, setPlaybackTime] = useState(0);
  const [editorTab, setEditorTab] = useState<'waveform' | 'transcript'>('waveform');

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
              {/* Tab Selector */}
              <div style={{ display: 'flex', gap: '8px', padding: '12px 16px 0 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.1)' }}>
                <button
                  type="button"
                  style={{
                    padding: '8px 16px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: editorTab === 'waveform' ? '2px solid var(--color-accent)' : '2px solid transparent',
                    color: editorTab === 'waveform' ? 'var(--color-accent)' : 'var(--color-text-muted)',
                    transition: 'all 0.2s',
                    outline: 'none'
                  }}
                  onClick={() => setEditorTab('waveform')}
                >
                  📈 Waveform Timeline
                </button>
                <button
                  type="button"
                  style={{
                    padding: '8px 16px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: editorTab === 'transcript' ? '2px solid var(--color-accent)' : '2px solid transparent',
                    color: editorTab === 'transcript' ? 'var(--color-accent)' : 'var(--color-text-muted)',
                    transition: 'all 0.2s',
                    outline: 'none'
                  }}
                  onClick={() => setEditorTab('transcript')}
                >
                  📝 Transcript Editor
                </button>
              </div>

              {editorTab === 'waveform' ? (
                <div className={styles.waveformSection}>
                  <WaveformEditor
                    onSeek={setPlaybackTime}
                    playbackTime={playbackTime}
                  />
                </div>
              ) : (
                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  <TranscriptEditor />
                </div>
              )}
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
