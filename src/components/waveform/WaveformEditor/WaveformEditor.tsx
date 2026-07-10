import React, { useEffect, useRef, useCallback, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js';
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.js';
import HoverPlugin from 'wavesurfer.js/dist/plugins/hover.js';
import styles from './WaveformEditor.module.css';
import { useAudioStore } from '../../../store/audioStore';
import { useUIStore } from '../../../store/uiStore';
import { formatDurationMs } from '../../../utils/formatters';
import { clamp } from '../../../utils/math';

interface WaveformEditorProps {
  onSeek: (time: number) => void;
  playbackTime: number;
}

export const WaveformEditor: React.FC<WaveformEditorProps> = ({
  onSeek,
  playbackTime,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const regionsPluginRef = useRef<RegionsPlugin | null>(null);
  const isSeekingRef = useRef(false);

  const audioUrl = useAudioStore((s) => s.processedUrl ?? s.audioUrl);
  const activeRegions = useAudioStore((s) => s.activeRegions);
  const deleteRegion = useAudioStore((s) => s.deleteRegion);
  const selectRegion = useAudioStore((s) => s.selectRegion);
  const selectedRegionId = useAudioStore((s) => s.selectedRegionId);
  const zoom = useUIStore((s) => s.zoom);
  const setZoom = useUIStore((s) => s.setZoom);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Initialize WaveSurfer
  useEffect(() => {
    if (!containerRef.current) return;

    const regionsPlugin = RegionsPlugin.create();
    const timelinePlugin = TimelinePlugin.create({
      height: 20,
      timeInterval: 1,
      primaryLabelInterval: 5,
      style: {
        fontSize: '10px',
        color: 'var(--color-text-tertiary)',
      },
    });
    const hoverPlugin = HoverPlugin.create({
      lineColor: 'var(--color-accent-light)',
      lineWidth: 1,
      labelBackground: 'var(--color-bg-elevated)',
      labelColor: 'var(--color-text-primary)',
      labelSize: '11px',
    });

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: 'var(--color-waveform)',
      progressColor: 'var(--color-waveform-progress)',
      cursorColor: 'var(--color-waveform-cursor)',
      cursorWidth: 2,
      height: 140,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true,
      plugins: [regionsPlugin, timelinePlugin, hoverPlugin],
    });

    wavesurferRef.current = ws;
    regionsPluginRef.current = regionsPlugin;

    ws.on('timeupdate', (t) => {
      if (!isSeekingRef.current) setCurrentTime(t);
    });

    ws.on('ready', (dur) => {
      setDuration(dur);
    });

    ws.on('click', () => {
      // Emit seek event
      const t = ws.getCurrentTime();
      onSeek(t);
    });

    // Region interactions
    regionsPlugin.on('region-clicked', (region, e) => {
      e.stopPropagation();
      selectRegion(region.id);
    });

    return () => {
      ws.destroy();
      wavesurferRef.current = null;
    };
  }, []);

  // Load audio URL
  useEffect(() => {
    if (audioUrl && wavesurferRef.current) {
      wavesurferRef.current.load(audioUrl);
    }
  }, [audioUrl]);

  // Sync playback time from parent
  useEffect(() => {
    if (!wavesurferRef.current || isSeekingRef.current) return;
    const dur = wavesurferRef.current.getDuration();
    if (dur > 0) {
      wavesurferRef.current.seekTo(clamp(playbackTime / dur, 0, 1));
    }
  }, [playbackTime]);

  // Update regions overlay
  useEffect(() => {
    const rp = regionsPluginRef.current;
    if (!rp) return;

    // Clear existing regions
    rp.clearRegions();

    // Add new regions
    for (const region of activeRegions) {
      rp.addRegion({
        id: region.id,
        start: region.start,
        end: region.end,
        color:
          region.id === selectedRegionId
            ? 'rgba(124, 111, 247, 0.4)'
            : 'rgba(248, 113, 113, 0.3)',
        drag: false,
        resize: false,
      });
    }
  }, [activeRegions, selectedRegionId]);

  // Zoom
  useEffect(() => {
    const ws = wavesurferRef.current;
    if (ws && ws.getDecodedData()) {
      try {
        ws.zoom(zoom);
      } catch (err) {
        console.warn('Wavesurfer zoom error:', err);
      }
    }
  }, [zoom, duration]);

  const handleZoomIn = () => setZoom(clamp(zoom * 1.5, 1, 500));
  const handleZoomOut = () => setZoom(clamp(zoom / 1.5, 1, 500));
  const handleZoomFit = () => setZoom(1);

  const handleDeleteSelected = useCallback(() => {
    if (selectedRegionId) {
      deleteRegion(selectedRegionId);
    }
  }, [selectedRegionId, deleteRegion]);

  const isEmpty = !audioUrl;

  return (
    <div className={styles.root}>
      {/* Controls bar */}
      <div className={styles.controls}>
        <div className={styles.timeDisplay}>
          <span className={styles.currentTime}>{formatDurationMs(currentTime)}</span>
          <span className={styles.separator}>/</span>
          <span className={styles.totalTime}>{formatDurationMs(duration)}</span>
        </div>

        <div className={styles.zoomControls}>
          <button className={styles.zoomBtn} onClick={handleZoomOut} title="Zoom out (Ctrl+-)">
            −
          </button>
          <span className={styles.zoomLevel}>{zoom.toFixed(0)}×</span>
          <button className={styles.zoomBtn} onClick={handleZoomIn} title="Zoom in (Ctrl+=)">
            +
          </button>
          <button className={styles.zoomBtn} onClick={handleZoomFit} title="Fit (Ctrl+0)">
            Fit
          </button>
        </div>

        {selectedRegionId && (
          <button className={styles.deleteBtn} onClick={handleDeleteSelected}>
            Delete selected region
          </button>
        )}
      </div>

      {/* Waveform container */}
      <div className={styles.waveformWrap}>
        {isEmpty && (
          <div className={styles.emptyState}>
            <p>Load a file to see the waveform</p>
          </div>
        )}
        <div
          ref={containerRef}
          className={[styles.waveform, isEmpty ? styles.hidden : ''].filter(Boolean).join(' ')}
        />
      </div>

      {/* Region legend */}
      {activeRegions.length > 0 && (
        <div className={styles.legend}>
          <span className={styles.legendDot} style={{ background: 'rgba(248, 113, 113, 0.8)' }} />
          <span className={styles.legendLabel}>
            {activeRegions.length} silence region{activeRegions.length !== 1 ? 's' : ''} detected
          </span>
          {selectedRegionId && (
            <span className={styles.legendHint}>— press Delete to remove selected</span>
          )}
        </div>
      )}
    </div>
  );
};
