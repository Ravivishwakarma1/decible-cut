import React, { useState, useEffect } from 'react';
import styles from './Sidebar.module.css';
import { useAudioStore } from '../../../store/audioStore';
import { useUIStore } from '../../../store/uiStore';
import { SilenceControls } from '../../processing/SilenceControls';
import { Statistics } from '../../processing/Statistics';
import {
  formatDuration, formatFileSize, formatSampleRate,
  formatChannels, formatBitrate,
} from '../../../utils/formatters';
import {
  Sliders, BarChart3, FileAudio,
  ChevronDown, ChevronRight,
} from 'lucide-react';

type SidebarTab = 'controls' | 'stats';

export const Sidebar: React.FC = () => {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const fileInfo = useAudioStore((s) => s.fileInfo);
  const status = useAudioStore((s) => s.status);
  const [activeTab, setActiveTab] = useState<SidebarTab>('controls');
  const [fileInfoExpanded, setFileInfoExpanded] = useState(true);

  // Auto-switch tabs based on processing status
  useEffect(() => {
    if (status === 'complete') {
      setActiveTab('stats');
    } else if (status === 'ready') {
      setActiveTab('controls');
    }
  }, [status]);

  if (collapsed) return null;

  return (
    <aside className={styles.sidebar}>
      {/* File Info section */}
      <div className={styles.section}>
        <button
          className={styles.sectionHeader}
          onClick={() => setFileInfoExpanded(!fileInfoExpanded)}
          aria-expanded={fileInfoExpanded}
        >
          <FileAudio size={14} />
          <span>File Info</span>
          {fileInfoExpanded ? <ChevronDown size={14} className={styles.chevron} /> : <ChevronRight size={14} className={styles.chevron} />}
        </button>

        {fileInfoExpanded && (
          <div className={styles.fileInfo}>
            {fileInfo ? (
              <div className={styles.fileGrid}>
                <div className={styles.fileRow}>
                  <span className={styles.fileKey}>Name</span>
                  <span className={styles.fileVal} title={fileInfo.name}>
                    {fileInfo.name.length > 22
                      ? fileInfo.name.slice(0, 20) + '…'
                      : fileInfo.name}
                  </span>
                </div>
                <div className={styles.fileRow}>
                  <span className={styles.fileKey}>Duration</span>
                  <span className={styles.fileVal}>{formatDuration(fileInfo.duration)}</span>
                </div>
                <div className={styles.fileRow}>
                  <span className={styles.fileKey}>Size</span>
                  <span className={styles.fileVal}>{formatFileSize(fileInfo.size)}</span>
                </div>
                <div className={styles.fileRow}>
                  <span className={styles.fileKey}>Sample Rate</span>
                  <span className={styles.fileVal}>{formatSampleRate(fileInfo.sampleRate)}</span>
                </div>
                <div className={styles.fileRow}>
                  <span className={styles.fileKey}>Channels</span>
                  <span className={styles.fileVal}>{formatChannels(fileInfo.channels)}</span>
                </div>
                {fileInfo.bitrate && (
                  <div className={styles.fileRow}>
                    <span className={styles.fileKey}>Bitrate</span>
                    <span className={styles.fileVal}>{formatBitrate(fileInfo.bitrate)}</span>
                  </div>
                )}
                <div className={styles.fileRow}>
                  <span className={styles.fileKey}>Format</span>
                  <span className={styles.fileVal}>{fileInfo.format}</span>
                </div>
              </div>
            ) : (
              <p className={styles.noFile}>No file loaded</p>
            )}
          </div>
        )}
      </div>

      {/* Tabs: Controls / Statistics */}
      <div className={styles.tabs}>
        <button
          className={[styles.tab, activeTab === 'controls' ? styles.tabActive : ''].join(' ')}
          onClick={() => setActiveTab('controls')}
        >
          <Sliders size={14} />
          Controls
        </button>
        <button
          className={[styles.tab, activeTab === 'stats' ? styles.tabActive : ''].join(' ')}
          onClick={() => setActiveTab('stats')}
        >
          <BarChart3 size={14} />
          Statistics
        </button>
      </div>

      {/* Tab Content */}
      <div className={styles.tabContent}>
        {activeTab === 'controls' && <SilenceControls />}
        {activeTab === 'stats' && <Statistics />}
      </div>
    </aside>
  );
};
