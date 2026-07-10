// ============================================================
// DecibelCut — useAudioEngine Hook
// Orchestrates file loading, silence detection, processing
// ============================================================

import { useCallback, useRef } from 'react';
import { useAudioStore } from '../store/audioStore';
import { useUIStore } from '../store/uiStore';
import { decodeAudioFile, audioBufferToUrl } from '../services/audioEngine';
import { detectSilence } from '../services/silenceDetector';
import { processAudio } from '../services/audioProcessor';
import { exportAudio } from '../services/exportService';
import type { ExportConfig } from '../types/processing.types';

export function useAudioEngine() {
  const audioStore = useAudioStore();
  const addToast = useUIStore((s) => s.addToast);
  const processingRef = useRef(false);

  const loadFile = useCallback(
    async (file: File) => {
      try {
        audioStore.setStatus('loading');
        audioStore.setLoadProgress(0);

        const { buffer, info } = await decodeAudioFile(file, (p) =>
          audioStore.setLoadProgress(p)
        );

        const url = URL.createObjectURL(file);
        audioStore.setFile(info, buffer, url);

        addToast({
          type: 'success',
          title: 'File loaded',
          message: `${info.name} — ${(info.duration / 60).toFixed(1)} min`,
        });
      } catch (err) {
        audioStore.setStatus('idle');
        addToast({
          type: 'error',
          title: 'Failed to load file',
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    },
    [audioStore, addToast]
  );

  const detectSilenceRegions = useCallback(async () => {
    const { audioBuffer, config } = audioStore;
    if (!audioBuffer) return;

    try {
      audioStore.setStatus('analyzing');
      audioStore.setDetectionProgress(0);

      // Run detection (synchronous but wrapped for progress)
      const result = detectSilence(audioBuffer, config, (p) =>
        audioStore.setDetectionProgress(p)
      );

      audioStore.setSilenceRegions(result.regions);
      audioStore.setStatus('ready');

      addToast({
        type: 'success',
        title: 'Silence detected',
        message: `Found ${result.regions.length} silent region${result.regions.length !== 1 ? 's' : ''}`,
      });
    } catch (err) {
      audioStore.setStatus('ready');
      addToast({
        type: 'error',
        title: 'Detection failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, [audioStore, addToast]);

  const processAndExport = useCallback(
    async (exportConfig: ExportConfig) => {
      const { audioBuffer, activeRegions, config } = audioStore;
      if (!audioBuffer || processingRef.current) return;

      processingRef.current = true;

      try {
        audioStore.setStatus('processing');
        audioStore.setProcessingProgress({
          stage: 'processing',
          percent: 0,
          message: 'Processing audio…',
        });

        // Step 1: Process
        const processed = await processAudio(
          audioBuffer,
          activeRegions,
          config,
          (p) =>
            audioStore.setProcessingProgress({
              stage: 'processing',
              percent: Math.round(p * 0.5),
              message: 'Removing silence…',
            })
        );

        const processedUrl = await audioBufferToUrl(processed.buffer);
        audioStore.setProcessedAudio(processed, processedUrl);

        // Compute statistics
        const stats = {
          originalDuration: processed.originalDuration,
          finalDuration: processed.processedDuration,
          timeSaved: processed.silenceRemoved,
          silenceRemoved: processed.silenceRemoved,
          numberOfCuts: processed.cutsApplied,
          averageSilenceLength:
            processed.cutsApplied > 0
              ? processed.silenceRemoved / processed.cutsApplied
              : 0,
          largestRemovedGap: processed.regionsRemoved.reduce(
            (max, r) => Math.max(max, r.end - r.start),
            0
          ),
          percentageReduction:
            processed.originalDuration > 0
              ? (processed.silenceRemoved / processed.originalDuration) * 100
              : 0,
        };
        audioStore.setStatistics(stats);

        audioStore.setProcessingProgress({
          stage: 'encoding',
          percent: 50,
          message: 'Encoding output…',
        });

        // Step 2: Export
        await exportAudio(processed, exportConfig, (progress) => {
          audioStore.setProcessingProgress({
            stage: 'encoding',
            percent: 50 + Math.round(progress.percent * 0.5),
            message: progress.message,
          });
        });

        addToast({ type: 'success', title: 'Export complete!', message: exportConfig.filename });
      } catch (err) {
        audioStore.setStatus('complete');
        addToast({
          type: 'error',
          title: 'Processing failed',
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      } finally {
        processingRef.current = false;
        audioStore.setProcessingProgress(null);
      }
    },
    [audioStore, addToast]
  );

  const applyProcessing = useCallback(async () => {
    const { audioBuffer, activeRegions, config } = audioStore;
    if (!audioBuffer) return;

    processingRef.current = true;
    try {
      audioStore.setStatus('processing');
      const processed = await processAudio(audioBuffer, activeRegions, config, (p) => {
        audioStore.setProcessingProgress({
          stage: 'processing',
          percent: p,
          message: 'Removing silence…',
        });
      });

      const url = await audioBufferToUrl(processed.buffer);
      audioStore.setProcessedAudio(processed, url);

      const stats = {
        originalDuration: processed.originalDuration,
        finalDuration: processed.processedDuration,
        timeSaved: processed.silenceRemoved,
        silenceRemoved: processed.silenceRemoved,
        numberOfCuts: processed.cutsApplied,
        averageSilenceLength:
          processed.cutsApplied > 0 ? processed.silenceRemoved / processed.cutsApplied : 0,
        largestRemovedGap: processed.regionsRemoved.reduce(
          (max, r) => Math.max(max, r.end - r.start),
          0
        ),
        percentageReduction:
          processed.originalDuration > 0
            ? (processed.silenceRemoved / processed.originalDuration) * 100
            : 0,
      };
      audioStore.setStatistics(stats);

      addToast({
        type: 'success',
        title: 'Processing complete',
        message: `Removed ${processed.cutsApplied} silent region(s)`,
      });
    } catch (err) {
      audioStore.setStatus('ready');
      addToast({
        type: 'error',
        title: 'Processing failed',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      processingRef.current = false;
      audioStore.setProcessingProgress(null);
    }
  }, [audioStore, addToast]);

  return {
    loadFile,
    detectSilenceRegions,
    processAndExport,
    applyProcessing,
  };
}
