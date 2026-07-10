import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play, Pause, Square, SkipBack, SkipForward,
  Volume2, Repeat, Gauge,
} from 'lucide-react';
import styles from './PlaybackControls.module.css';
import { useAudioStore } from '../../../store/audioStore';
import { getAudioContext } from '../../../services/audioEngine';
import { formatDuration } from '../../../utils/formatters';
import { clamp } from '../../../utils/math';

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SKIP_AMOUNT = 5; // seconds

interface PlaybackControlsProps {
  onTimeUpdate?: (time: number) => void;
}

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({ onTimeUpdate }) => {
  const audioUrl = useAudioStore((s) => s.processedUrl ?? s.audioUrl);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [isLooping, setIsLooping] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Create audio element
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      onTimeUpdate?.(audio.currentTime);
    };

    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => { setIsPlaying(false); };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.pause();
      audio.src = '';
    };
  }, []);

  // Update source
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audioUrl) {
      audio.src = audioUrl;
      audio.load();
      setCurrentTime(0);
      setIsPlaying(false);
    } else {
      audio.src = '';
      setCurrentTime(0);
      setDuration(0);
      setIsPlaying(false);
    }
  }, [audioUrl]);

  // Sync settings
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
      audioRef.current.playbackRate = speed;
      audioRef.current.loop = isLooping;
    }
  }, [volume, speed, isLooping, isMuted]);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    // Resume AudioContext (needed for first interaction)
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();

    if (isPlaying) {
      audio.pause();
    } else {
      await audio.play();
    }
  }, [audioUrl, isPlaying]);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setCurrentTime(0);
    setIsPlaying(false);
  }, []);

  const skipForward = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = clamp(audio.currentTime + SKIP_AMOUNT, 0, audio.duration);
  }, []);

  const skipBackward = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = clamp(audio.currentTime - SKIP_AMOUNT, 0, audio.duration);
  }, []);

  const seek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const t = parseFloat(e.target.value);
    audio.currentTime = t;
    setCurrentTime(t);
  }, []);

  const cycleSpeed = () => {
    const idx = PLAYBACK_SPEEDS.indexOf(speed);
    const next = PLAYBACK_SPEEDS[(idx + 1) % PLAYBACK_SPEEDS.length];
    setSpeed(next);
  };

  const disabled = !audioUrl;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={styles.root}>
      {/* Progress / seek bar */}
      <div className={styles.seekBar}>
        <span className={styles.time}>{formatDuration(currentTime)}</span>
        <div className={styles.seekTrack}>
          <div className={styles.seekFill} style={{ width: `${progress}%` }} />
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.01}
            value={currentTime}
            onChange={seek}
            disabled={disabled}
            className={styles.seekInput}
            aria-label="Seek"
          />
        </div>
        <span className={styles.time}>{formatDuration(duration)}</span>
      </div>

      {/* Controls row */}
      <div className={styles.controls}>
        {/* Left: volume */}
        <div className={styles.volumeGroup}>
          <button
            className={styles.iconBtn}
            onClick={() => setIsMuted(!isMuted)}
            disabled={disabled}
            title="Toggle mute"
          >
            <Volume2 size={16} />
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={isMuted ? 0 : volume}
            onChange={(e) => { setVolume(parseFloat(e.target.value)); setIsMuted(false); }}
            disabled={disabled}
            className={styles.volumeSlider}
            aria-label="Volume"
          />
        </div>

        {/* Center: playback buttons */}
        <div className={styles.playbackGroup}>
          <button
            className={styles.iconBtn}
            onClick={skipBackward}
            disabled={disabled}
            title="Skip back 5s (←)"
          >
            <SkipBack size={18} />
          </button>

          <button
            className={styles.playBtn}
            onClick={togglePlay}
            disabled={disabled}
            title="Play / Pause (Space)"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={22} /> : <Play size={22} />}
          </button>

          <button
            className={styles.iconBtn}
            onClick={stop}
            disabled={disabled}
            title="Stop (Esc)"
          >
            <Square size={16} />
          </button>

          <button
            className={styles.iconBtn}
            onClick={skipForward}
            disabled={disabled}
            title="Skip forward 5s (→)"
          >
            <SkipForward size={18} />
          </button>
        </div>

        {/* Right: speed + loop */}
        <div className={styles.rightGroup}>
          <button
            className={[styles.iconBtn, styles.speedBtn].join(' ')}
            onClick={cycleSpeed}
            disabled={disabled}
            title="Playback speed"
          >
            <Gauge size={15} />
            <span>{speed}×</span>
          </button>

          <button
            className={[styles.iconBtn, isLooping ? styles.active : ''].join(' ')}
            onClick={() => setIsLooping(!isLooping)}
            disabled={disabled}
            title="Loop"
          >
            <Repeat size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
