import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './TopBar.module.css';
import { useAudioStore } from '../../../store/audioStore';
import { useUIStore } from '../../../store/uiStore';
import { Button } from '../../ui/Button';
import {
  Undo2, Redo2, Download, Keyboard, Settings,
  PanelLeft, X,
} from 'lucide-react';
import { truncateFilename } from '../../../utils/formatters';

export const TopBar: React.FC = () => {
  const navigate = useNavigate();
  const fileInfo = useAudioStore((s) => s.fileInfo);
  const clearFile = useAudioStore((s) => s.clearFile);
  const undo = useAudioStore((s) => s.undo);
  const redo = useAudioStore((s) => s.redo);
  const history = useAudioStore((s) => s.history);
  const historyIndex = useAudioStore((s) => s.historyIndex);
  const status = useAudioStore((s) => s.status);

  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const setExportOpen = useUIStore((s) => s.setExportPanelOpen);
  const setKeyboardOpen = useUIStore((s) => s.setKeyboardShortcutsOpen);

  const canUndo = historyIndex >= 0;
  const canRedo = historyIndex < history.length - 1;
  const hasFile = !!fileInfo;

  return (
    <header className={styles.topbar}>
      {/* Left */}
      <div className={styles.left}>
        <button
          className={styles.sidebarToggle}
          onClick={toggleSidebar}
          title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
          aria-label="Toggle sidebar"
        >
          <PanelLeft size={18} />
        </button>

        <button className={styles.logo} onClick={() => navigate('/')} title="Go to home">
          <div className={styles.logoMark}>
            <span className={styles.logoIcon}>⚡</span>
          </div>
          <span className={styles.logoText}>
            Decibel<span className={styles.logoCut}>Cut</span>
          </span>
        </button>

        {fileInfo && (
          <div className={styles.fileChip}>
            <span className={styles.fileName}>
              {truncateFilename(fileInfo.name, 28)}
            </span>
            <span className={styles.fileStatus}>
              {status === 'analyzing' && '● Analyzing…'}
              {status === 'processing' && '● Processing…'}
              {status === 'complete' && '✓ Processed'}
              {(status === 'ready' || status === 'idle') && '● Ready'}
            </span>
            <button
              className={styles.clearBtn}
              onClick={clearFile}
              title="Close file"
              aria-label="Close file"
            >
              <X size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Right */}
      <div className={styles.right}>
        <div className={styles.historyBtns}>
          <button
            className={styles.iconBtn}
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
          >
            <Undo2 size={16} />
          </button>
          <button
            className={styles.iconBtn}
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
            aria-label="Redo"
          >
            <Redo2 size={16} />
          </button>
        </div>

        <button
          className={styles.iconBtn}
          onClick={() => setKeyboardOpen(true)}
          title="Keyboard shortcuts"
        >
          <Keyboard size={16} />
        </button>

        <button
          className={styles.iconBtn}
          onClick={() => navigate('/settings')}
          title="Settings"
        >
          <Settings size={16} />
        </button>

        <Button
          variant="primary"
          size="sm"
          leftIcon={<Download size={14} />}
          disabled={!hasFile}
          onClick={() => setExportOpen(true)}
        >
          Export
        </Button>
      </div>
    </header>
  );
};
