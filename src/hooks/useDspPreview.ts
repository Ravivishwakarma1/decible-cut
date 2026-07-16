import { useEffect, useRef } from 'react';
import { DspPreviewEngine } from '../services/dspPreviewEngine';
import type { CreatorDSPConfig } from '../services/creatorToolsService';

export function useDspPreview(
  audioElement: HTMLAudioElement | null,
  dspConfig: CreatorDSPConfig | null,
  duration: number,
  currentTime: number,
  enabled: boolean = true
) {
  const engineRef = useRef<DspPreviewEngine | null>(null);

  useEffect(() => {
    if (!audioElement || !enabled || !dspConfig) {
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
      return;
    }

    if (!engineRef.current) {
      engineRef.current = new DspPreviewEngine(audioElement);
    }

    engineRef.current.update(dspConfig, duration);
  }, [audioElement, dspConfig, duration, enabled]);

  useEffect(() => {
    if (engineRef.current && enabled) {
      engineRef.current.updateFades(currentTime);
    }
  }, [currentTime, enabled]);

  useEffect(() => {
    return () => {
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, []);
}
