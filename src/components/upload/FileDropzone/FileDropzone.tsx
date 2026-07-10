import React, { useRef, useState, useCallback } from 'react';
import { UploadCloud, Music } from 'lucide-react';
import styles from './FileDropzone.module.css';
import { validateAudioFile } from '../../../services/audioEngine';
import { useAudioEngine } from '../../../hooks/useAudioEngine';
import { SUPPORTED_EXTENSIONS } from '../../../types/audio.types';
import { useUIStore } from '../../../store/uiStore';

interface FileDropzoneProps {
  compact?: boolean;
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({ compact = false }) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { loadFile } = useAudioEngine();
  const addToast = useUIStore((s) => s.addToast);

  const handleFile = useCallback(
    async (file: File) => {
      const validation = validateAudioFile(file);
      if (!validation.valid) {
        addToast({ type: 'error', title: 'Invalid file', message: validation.error });
        return;
      }
      await loadFile(file);
    },
    [loadFile, addToast]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  return (
    <div
      className={[styles.dropzone, isDragging ? styles.dragging : '', compact ? styles.compact : '']
        .filter(Boolean)
        .join(' ')}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      aria-label="Upload audio file"
      onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={SUPPORTED_EXTENSIONS.map((e) => `.${e}`).join(',')}
        onChange={handleInputChange}
        className={styles.hiddenInput}
        aria-hidden="true"
      />

      <div className={styles.content}>
        <div className={styles.iconWrap}>
          {isDragging ? (
            <Music size={compact ? 28 : 40} className={styles.iconActive} />
          ) : (
            <UploadCloud size={compact ? 28 : 40} className={styles.icon} />
          )}
        </div>

        {!compact && (
          <>
            <h3 className={styles.title}>
              {isDragging ? 'Release to upload' : 'Drop your audio file here'}
            </h3>
            <p className={styles.subtitle}>
              or <span className={styles.link}>browse files</span>
            </p>
            <p className={styles.formats}>
              {SUPPORTED_EXTENSIONS.map((e) => e.toUpperCase()).join(' · ')}
            </p>
          </>
        )}

        {compact && (
          <span className={styles.compactLabel}>
            {isDragging ? 'Drop file' : 'Add file'}
          </span>
        )}
      </div>
    </div>
  );
};
