import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RefreshCw, Volume2, ShieldCheck, Zap } from 'lucide-react';
import styles from './AudioComparison.module.css';

// Synthetic speech envelopes to render matching waveforms
const ORIGINAL_WAVE = [
  1, 1, 1, 1, 15, 30, 25, 45, 12, 50, 40, 60, 20, 35, 15, 45, 8, 30, 20, 10, 1, 1, // Speech 1
  3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, // Silence gap with noise
  12, 35, 25, 55, 18, 40, 30, 50, 10, 45, 35, 60, 15, 30, 20, 10, 1, 1, 1, 1 // Speech 2
];

const PROCESSED_WAVE = [
  1, 1, 1, 1, 15, 30, 25, 45, 12, 50, 40, 60, 20, 35, 15, 45, 8, 30, 20, 10, 1, 1, // Speech 1
  12, 35, 25, 55, 18, 40, 30, 50, 10, 45, 35, 60, 15, 30, 20, 10, 1, 1, 1, 1 // Speech 2 (Stitched directly)
];

export const AudioComparison: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTrack, setActiveTrack] = useState<'original' | 'processed'>('original');
  const [currentTime, setCurrentTime] = useState(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const buffersRef = useRef<{ original: AudioBuffer; processed: AudioBuffer } | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const elapsedTimeRef = useRef<number>(0); // how many seconds have elapsed on the current track
  const animationFrameRef = useRef<number | null>(null);

  // Initialize Audio Context and Buffers on user interaction
  const initAudio = () => {
    if (audioCtxRef.current) return;

    // Use standard AudioContext
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    audioCtxRef.current = ctx;

    const sampleRate = ctx.sampleRate;

    // Original buffer (8 seconds)
    const origDuration = 8;
    const origLength = sampleRate * origDuration;
    const originalBuffer = ctx.createBuffer(1, origLength, sampleRate);
    const origData = originalBuffer.getChannelData(0);

    // Processed buffer (5 seconds)
    const procDuration = 5;
    const procLength = sampleRate * procDuration;
    const processedBuffer = ctx.createBuffer(1, procLength, sampleRate);
    const procData = processedBuffer.getChannelData(0);

    // Synthesize Original: speech 1 (0.5s - 2.5s), gap (2.5s - 5.5s), speech 2 (5.5s - 7.5s)
    for (let i = 0; i < origLength; i++) {
      const t = i / sampleRate;
      // White noise background (hiss)
      const noise = (Math.random() * 2 - 1) * 0.025;
      
      let voice = 0;
      const isSpeech1 = t >= 0.5 && t <= 2.5;
      const isSpeech2 = t >= 5.5 && t <= 7.5;

      if (isSpeech1 || isSpeech2) {
        // Voice synth: sawtooth-like sum of sines
        const f0 = 120;
        const wave = Math.sin(2 * Math.PI * f0 * t) + 
                     0.5 * Math.sin(2 * Math.PI * f0 * 2 * t) + 
                     0.25 * Math.sin(2 * Math.PI * f0 * 3 * t);
        
        // Envelope at 4Hz to model syllable sounds
        const envelope = Math.max(0, Math.sin(2 * Math.PI * 3.5 * t));
        voice = wave * envelope * 0.12;
      }
      
      origData[i] = voice + noise;
    }

    // Synthesize Processed: speech 1 (0.5s - 2.5s), speech 2 (2.5s - 4.5s), seamless stitching
    for (let i = 0; i < procLength; i++) {
      const t = i / sampleRate;
      // Clean signal: near zero background noise
      const noise = (Math.random() * 2 - 1) * 0.0015;
      
      let voice = 0;
      const isSpeech1 = t >= 0.5 && t <= 2.5;
      const isSpeech2 = t >= 2.5 && t <= 4.5;

      if (isSpeech1) {
        const f0 = 120;
        const wave = Math.sin(2 * Math.PI * f0 * t) + 
                     0.5 * Math.sin(2 * Math.PI * f0 * 2 * t) + 
                     0.25 * Math.sin(2 * Math.PI * f0 * 3 * t);
        const envelope = Math.max(0, Math.sin(2 * Math.PI * 3.5 * t));
        voice = wave * envelope * 0.12;
      } else if (isSpeech2) {
        const tOrig = t + 3.0; // offset speech 2 to match original time
        const f0 = 120;
        const wave = Math.sin(2 * Math.PI * f0 * tOrig) + 
                     0.5 * Math.sin(2 * Math.PI * f0 * 2 * tOrig) + 
                     0.25 * Math.sin(2 * Math.PI * f0 * 3 * tOrig);
        const envelope = Math.max(0, Math.sin(2 * Math.PI * 3.5 * tOrig));
        voice = wave * envelope * 0.12;
      }
      
      procData[i] = voice + noise;
    }

    buffersRef.current = { original: originalBuffer, processed: processedBuffer };
  };

  // Start playback from specific offset
  const playNode = (offset: number) => {
    if (!audioCtxRef.current || !buffersRef.current) return;

    // Stop current if active
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch (e) {}
    }

    const ctx = audioCtxRef.current;
    
    // Resume context if suspended (browser security)
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const source = ctx.createBufferSource();
    const buffer = activeTrack === 'original' ? buffersRef.current.original : buffersRef.current.processed;
    source.buffer = buffer;
    source.connect(ctx.destination);
    
    // Save state
    sourceNodeRef.current = source;
    startTimeRef.current = ctx.currentTime - offset;
    elapsedTimeRef.current = offset;
    setCurrentTime(offset);

    // Play
    source.start(0, offset);

    // On ended event (if played till end)
    source.onended = () => {
      const trackDuration = activeTrack === 'original' ? 8 : 5;
      // If we finished naturally near the end
      if (ctx.currentTime - startTimeRef.current >= trackDuration - 0.1) {
        setIsPlaying(false);
        elapsedTimeRef.current = 0;
        setCurrentTime(0);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      }
    };

    // Start progress frame loop
    const updateProgress = () => {
      const duration = activeTrack === 'original' ? 8 : 5;
      const elapsed = ctx.currentTime - startTimeRef.current;
      
      if (elapsed <= duration) {
        setCurrentTime(elapsed);
        elapsedTimeRef.current = elapsed;
        animationFrameRef.current = requestAnimationFrame(updateProgress);
      }
    };
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(updateProgress);
  };

  // Toggle play/pause
  const handlePlayToggle = () => {
    initAudio();
    
    if (isPlaying) {
      // Pause
      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.stop();
        } catch (e) {}
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      setIsPlaying(false);
    } else {
      // Play from current elapsed time
      setIsPlaying(true);
      playNode(elapsedTimeRef.current);
    }
  };

  // Swap tracks seamlessly
  const handleTrackChange = (track: 'original' | 'processed') => {
    if (track === activeTrack) return;
    initAudio();

    // Map times between tracks:
    // Original (8s) has a 3s gap: 2.5s to 5.5s
    // Processed (5s) has this gap removed
    let newOffset = elapsedTimeRef.current;
    
    if (activeTrack === 'original' && track === 'processed') {
      // Splicing time mapping: Original -> Processed
      if (newOffset < 2.5) {
        // Before gap: same time
      } else if (newOffset >= 2.5 && newOffset <= 5.5) {
        // In the gap: snap to the splice point
        newOffset = 2.5;
      } else {
        // After gap: shift back by 3s
        newOffset = newOffset - 3.0;
      }
    } else if (activeTrack === 'processed' && track === 'original') {
      // Splicing time mapping: Processed -> Original
      if (newOffset < 2.5) {
        // Before splice: same time
      } else {
        // After splice: shift forward by 3s
        newOffset = newOffset + 3.0;
      }
    }

    // Cap offsets at track duration
    const targetDuration = track === 'original' ? 8 : 5;
    if (newOffset >= targetDuration) newOffset = 0;

    setActiveTrack(track);
    elapsedTimeRef.current = newOffset;
    setCurrentTime(newOffset);

    // If currently playing, restart source seamlessly with new buffer at new offset
    if (isPlaying) {
      // We must defer slightly or invoke immediately so audio context catches up
      setTimeout(() => {
        playNode(newOffset);
      }, 0);
    }
  };

  const handleReset = () => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch (e) {}
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setIsPlaying(false);
    elapsedTimeRef.current = 0;
    setCurrentTime(0);
  };

  // Clear animation frames on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.stop();
        } catch (e) {}
      }
    };
  }, []);

  const origDuration = 8;
  const procDuration = 5;
  const activeDuration = activeTrack === 'original' ? origDuration : procDuration;
  const percentComplete = (currentTime / activeDuration) * 100;

  return (
    <section className={styles.section} id="demo">
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.badge}>Live Demo</span>
          <h2 className={styles.sectionTitle}>Hear the raw difference</h2>
          <p className={styles.sectionSubtitle}>
            Listen to original audio with ambient noise and dead air, then hear how DecibelCut removes gaps and cleans the signal client-side.
          </p>
        </div>

        <div className={styles.playerContainer}>
          {/* Main Controls */}
          <div className={styles.controlsBar}>
            <button 
              onClick={handlePlayToggle} 
              className={styles.playBtn}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
              <span>{isPlaying ? "Pause Demo" : "Play Demo"}</span>
            </button>

            <button 
              onClick={handleReset} 
              className={styles.resetBtn} 
              title="Reset player"
              aria-label="Reset player"
            >
              <RefreshCw size={16} />
            </button>

            {/* Track Selector Tabs */}
            <div className={styles.tabs}>
              <button
                className={[styles.tab, activeTrack === 'original' ? styles.tabActive : ''].join(' ')}
                onClick={() => handleTrackChange('original')}
              >
                <div className={styles.tabDot} />
                <span>Original (Noisy & Gaps)</span>
              </button>
              <button
                className={[styles.tab, activeTrack === 'processed' ? styles.tabActive : '', styles.tabClean].join(' ')}
                onClick={() => handleTrackChange('processed')}
              >
                <Zap size={14} className={styles.tabIcon} />
                <span>DecibelCut (Processed)</span>
              </button>
            </div>
          </div>

          {/* Interactive Stacked Visualizers */}
          <div className={styles.visualizerArea}>
            
            {/* Top Waveform: Original (8s) */}
            <div 
              className={[
                styles.waveformRow, 
                activeTrack === 'original' ? styles.rowActive : styles.rowInactive
              ].join(' ')}
              onClick={() => handleTrackChange('original')}
            >
              <div className={styles.rowLabel}>
                <Volume2 size={14} />
                <span>Original Recording (8.0s)</span>
              </div>
              <div className={styles.waveformContainer}>
                {/* Visual highlight container for silent dead air */}
                <div className={styles.silenceZone} style={{ left: '30%', width: '40%' }}>
                  <span className={styles.silenceTag}>Dead Air Gap (3.0s)</span>
                </div>
                
                {/* Waveform bars */}
                <div className={styles.bars}>
                  {ORIGINAL_WAVE.map((h, i) => {
                    const barPercent = (i / ORIGINAL_WAVE.length) * 100;
                    const isPassed = activeTrack === 'original' && barPercent <= percentComplete;
                    return (
                      <div 
                        key={i} 
                        className={[
                          styles.bar,
                          isPassed ? styles.barPassed : '',
                          i >= 22 && i < 46 ? styles.barSilence : ''
                        ].join(' ')}
                        style={{ height: `${h}%` }}
                      />
                    );
                  })}
                </div>
                {/* Playhead */}
                {activeTrack === 'original' && (
                  <div className={styles.playhead} style={{ left: `${percentComplete}%` }} />
                )}
              </div>
            </div>

            {/* Bottom Waveform: Processed (5s) */}
            <div 
              className={[
                styles.waveformRow, 
                activeTrack === 'processed' ? styles.rowActive : styles.rowInactive
              ].join(' ')}
              onClick={() => handleTrackChange('processed')}
            >
              <div className={styles.rowLabel}>
                <ShieldCheck size={14} className={styles.successIcon} />
                <span>DecibelCut Cleaned (5.0s)</span>
                <span className={styles.cutStats}>-37% Dead Air removed</span>
              </div>
              <div className={styles.waveformContainer}>
                {/* Splice Indicator Line */}
                <div className={styles.spliceLine} style={{ left: '50%' }}>
                  <span className={styles.spliceTag}>Stitched Gap</span>
                </div>

                {/* Waveform bars */}
                <div className={styles.bars}>
                  {PROCESSED_WAVE.map((h, i) => {
                    const barPercent = (i / PROCESSED_WAVE.length) * 100;
                    const isPassed = activeTrack === 'processed' && barPercent <= percentComplete;
                    return (
                      <div 
                        key={i} 
                        className={[
                          styles.bar,
                          styles.barCleanColor,
                          isPassed ? styles.barPassedClean : ''
                        ].join(' ')}
                        style={{ height: `${h}%` }}
                      />
                    );
                  })}
                </div>
                {/* Playhead */}
                {activeTrack === 'processed' && (
                  <div className={styles.playhead} style={{ left: `${percentComplete}%` }} />
                )}
              </div>
            </div>

          </div>

          {/* Help Info Footer inside player */}
          <div className={styles.playerFooter}>
            <span className={styles.footerNote}>
              💡 <strong>Instant Swap:</strong> Toggle tracks while playing to compare background noise cancellation.
            </span>
            <span className={styles.timeCounter}>
              {currentTime.toFixed(1)}s / {activeDuration.toFixed(1)}s
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
