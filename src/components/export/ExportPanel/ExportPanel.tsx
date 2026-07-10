import React, { useState } from 'react';
import styles from './ExportPanel.module.css';
import { Button } from '../../ui/Button';
import { useAudioStore } from '../../../store/audioStore';
import { useAudioEngine } from '../../../hooks/useAudioEngine';
import { useUIStore } from '../../../store/uiStore';
import { EXPORT_FORMATS, MP3_BITRATES } from '../../../utils/constants';
import { Download, X } from 'lucide-react';
import type { ExportConfig } from '../../../types/processing.types';

export const ExportPanel: React.FC = () => {
  const isOpen = useUIStore((s) => s.isExportPanelOpen);
  const setOpen = useUIStore((s) => s.setExportPanelOpen);
  const fileInfo = useAudioStore((s) => s.fileInfo);
  const status = useAudioStore((s) => s.status);
  const processingProgress = useAudioStore((s) => s.processingProgress);
  const { processAndExport } = useAudioEngine();
  const activeRegions = useAudioStore((s) => s.activeRegions);

  const [format, setFormat] = useState<'mp3' | 'wav' | 'flac'>('mp3');
  const [bitrate, setBitrate] = useState(192);
  const [filename, setFilename] = useState('');

  const derivedFilename =
    filename ||
    (fileInfo ? fileInfo.name.replace(/\.[^.]+$/, '') + '_decibelcut' : 'output');

  const isProcessing = status === 'processing';

  const handleExport = async () => {
    const exportConfig: ExportConfig = {
      format,
      bitrate: format === 'mp3' ? bitrate : undefined,
      filename: derivedFilename,
      preserveMetadata: true,
    };
    await processAndExport(exportConfig);
    setOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className={styles.panel} role="dialog" aria-modal="true" aria-label="Export audio">
        {/* Header */}
        <div className={styles.header}>
          <h3 className={styles.title}>Export Audio</h3>
          <button className={styles.closeBtn} onClick={() => setOpen(false)} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {/* Format */}
          <div className={styles.field}>
            <label className={styles.label}>Format</label>
            <div className={styles.formatBtns}>
              {EXPORT_FORMATS.map((f) => (
                <button
                  key={f}
                  className={[styles.formatBtn, format === f ? styles.formatActive : '']
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => setFormat(f)}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
            <p className={styles.hint}>
              {format === 'mp3' && 'Lossy — small file size, great for sharing'}
              {format === 'wav' && 'Lossless — highest quality, large file size'}
              {format === 'flac' && 'Lossless — compressed, smaller than WAV'}
            </p>
          </div>

          {/* Bitrate (MP3 only) */}
          {format === 'mp3' && (
            <div className={styles.field}>
              <label className={styles.label}>Bitrate</label>
              <div className={styles.bitrateGroup}>
                {MP3_BITRATES.map((b) => (
                  <button
                    key={b}
                    className={[styles.bitrateBtn, bitrate === b ? styles.bitrateActive : '']
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => setBitrate(b)}
                  >
                    {b} kbps
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Filename */}
          <div className={styles.field}>
            <label className={styles.label}>File Name</label>
            <div className={styles.filenameRow}>
              <input
                type="text"
                className={styles.filenameInput}
                placeholder={derivedFilename}
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
              />
              <span className={styles.ext}>.{format}</span>
            </div>
          </div>

          {/* Info */}
          <div className={styles.infoBox}>
            <p>
              <strong>{activeRegions.length}</strong> silent region
              {activeRegions.length !== 1 ? 's' : ''} will be removed during export.
            </p>
          </div>

          {/* Progress */}
          {isProcessing && processingProgress && (
            <div className={styles.progressWrap}>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${processingProgress.percent}%` }}
                />
              </div>
              <p className={styles.progressMsg}>{processingProgress.message}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="lg"
            leftIcon={<Download size={18} />}
            onClick={handleExport}
            isLoading={isProcessing}
            disabled={!fileInfo || isProcessing}
          >
            {isProcessing ? 'Processing…' : 'Export & Download'}
          </Button>
        </div>
      </div>
    </div>
  );
};
