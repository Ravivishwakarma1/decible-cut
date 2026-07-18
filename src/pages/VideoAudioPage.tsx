import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './VideoAudioPage.module.css';
import { 
  extractVideoMetadata, 
  extractAudioFromVideo 
} from '../services/videoService';
import type { 
  VideoMetadata, 
  VideoExtractionConfig 
} from '../services/videoService';
import { 
  ArrowLeft, Upload, Video as VideoIcon, Volume2, 
  VolumeX, Play, Pause, Download, RefreshCw, 
  Trash2, FileDown, CheckCircle
} from 'lucide-react';
import WaveSurfer from 'wavesurfer.js';
import JSZip from 'jszip';
import { useSEO } from '../hooks/useSEO';
import { cutVideoSilences } from '../services/videoCutterService';
import { Slider } from '../components/ui/Slider';

interface QueueItem {
  id: string;
  file: File;
  name: string;
  size: number;
  metadata?: VideoMetadata;
  status: 'pending' | 'extracting' | 'completed' | 'failed';
  progress: number;
  resultBlob?: Blob;
  resultUrl?: string;
  error?: string;
}

export const VideoAudioPage: React.FC = () => {
  useSEO({
    title: 'Extract Audio from Video | DecibelCut',
    description: 'Convert and extract high-quality audio files from MP4, WebM, and other video formats directly in your browser.'
  });

  const navigate = useNavigate();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [activeQueueId, setActiveQueueId] = useState<string | null>(null);
  
  // Single or Batch mode active file metadata / state
  const activeItem = queue.find(item => item.id === activeQueueId) ?? queue[0];
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [zipUrl, setZipUrl] = useState<string | null>(null);
  const [activeVideoUrl, setActiveVideoUrl] = useState<string>('');

  // Track all URLs to clean up on unmount
  const queueUrlsRef = useRef<string[]>([]);
  const zipUrlRef = useRef<string | null>(null);

  useEffect(() => {
    queueUrlsRef.current = queue.map(q => q.resultUrl).filter(Boolean) as string[];
  }, [queue]);

  useEffect(() => {
    zipUrlRef.current = zipUrl;
  }, [zipUrl]);

  useEffect(() => {
    return () => {
      queueUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      if (zipUrlRef.current) URL.revokeObjectURL(zipUrlRef.current);
    };
  }, []);

  // Manage active video object URL creation and cleanup
  useEffect(() => {
    if (!activeItem?.file) {
      setActiveVideoUrl('');
      return;
    }
    const url = URL.createObjectURL(activeItem.file);
    setActiveVideoUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [activeItem?.id]);

  // Settings state
  const [config, setConfig] = useState<VideoExtractionConfig>({
    format: 'mp3',
    bitrate: 192,
    sampleRate: 44100,
    channels: 2,
    qualityPreset: 'balanced',
    normalize: false,
    fadeIn: false,
    fadeOut: false,
    preserveMetadata: true,
    trim: {
      enabled: false,
      start: 0,
      end: 0
    }
  });

  const [exportMode, setExportMode] = useState<'audio' | 'video'>('audio');
  const [silenceConfig, setSilenceConfig] = useState({
    threshold: -40,
    minSilenceDuration: 1.5,
    paddingBefore: 0.1,
    paddingAfter: 0.1,
    crossfadeDuration: 0.03
  });

  // Video player controls state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  // Trim slider drag states
  const trimTrackRef = useRef<HTMLDivElement>(null);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);

  // Output Player Waveform Ref
  const waveformRef = useRef<HTMLDivElement>(null);
  const waveSurferRef = useRef<WaveSurfer | null>(null);
  const [resultPlaying, setResultPlaying] = useState(false);

  // Auto-set duration and trim limits when video loads
  useEffect(() => {
    if (activeItem?.metadata) {
      const dur = activeItem.metadata.duration;
      setDuration(dur);
      // Only reset trim start/end if trim is disabled or bounds are invalid
      setTrimStart(0);
      setTrimEnd(dur);
    }
  }, [activeItem?.id, activeItem?.metadata]);

  // Video timeupdate hook
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      
      // Loop if playback goes outside trim bounds
      if (config.trim.enabled) {
        if (video.currentTime < trimStart) {
          video.currentTime = trimStart;
        }
        if (video.currentTime >= trimEnd) {
          video.currentTime = trimStart;
          if (!video.loop) {
            video.pause();
            setIsPlaying(false);
          }
        }
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      if (trimEnd === 0) setTrimEnd(video.duration);
    };

    const handlePause = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('pause', handlePause);
    video.addEventListener('play', handlePlay);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('play', handlePlay);
    };
  }, [activeItem?.id, config.trim.enabled, trimStart, trimEnd]);

  // Create wavesurfer player on download screen
  useEffect(() => {
    if (!waveformRef.current || !activeItem?.resultUrl) return;

    // Destroy existing wavesurfer
    if (waveSurferRef.current) {
      waveSurferRef.current.destroy();
    }

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: 'rgba(124, 111, 247, 0.3)',
      progressColor: '#7c6ff7',
      cursorColor: '#7c6ff7',
      barWidth: 2,
      barGap: 3,
      height: 80,
      cursorWidth: 1,
    });

    ws.load(activeItem.resultUrl);
    waveSurferRef.current = ws;

    ws.on('play', () => setResultPlaying(true));
    ws.on('pause', () => setResultPlaying(false));

    return () => {
      ws.destroy();
      waveSurferRef.current = null;
    };
  }, [activeItem?.id, activeItem?.resultUrl]);

  // Handle Drag & Drop events
  const [isDragActive, setIsDragActive] = useState(false);
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await addFilesToQueue(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await addFilesToQueue(Array.from(e.target.files));
    }
  };

  const addFilesToQueue = async (files: File[]) => {
    const videoFiles = files.filter(f => f.type.startsWith('video/') || f.name.match(/\.(mp4|mov|avi|mkv|webm|flv|m4v|ts|wmv)$/i));
    
    const newItems: QueueItem[] = [];
    for (const file of videoFiles) {
      const id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const newItem: QueueItem = {
        id,
        file,
        name: file.name,
        size: file.size,
        status: 'pending',
        progress: 0
      };
      
      newItems.push(newItem);
    }

    setQueue(prev => {
      const updated = [...prev, ...newItems];
      if (updated.length > 0 && !activeQueueId) {
        setActiveQueueId(updated[0].id);
      }
      return updated;
    });

    // Extract metadata asynchronously for each added file
    for (const item of newItems) {
      const meta = await extractVideoMetadata(item.file);
      setQueue(prev => prev.map(q => q.id === item.id ? { ...q, metadata: meta } : q));
    }
  };

  const removeQueueItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setQueue(prev => {
      const filtered = prev.filter(q => q.id !== id);
      if (activeQueueId === id) {
        setActiveQueueId(filtered.length > 0 ? filtered[0].id : null);
      }
      return filtered;
    });
  };

  // Video control triggers
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const time = parseFloat(e.target.value);
    video.currentTime = time;
    setCurrentTime(time);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const vol = parseFloat(e.target.value);
    video.volume = vol;
    setVolume(vol);
    setIsMuted(vol === 0);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  // Dual handle drag handler
  const handlePointerDown = (type: 'start' | 'end') => (e: React.PointerEvent) => {
    e.preventDefault();
    const track = trimTrackRef.current;
    if (!track) return;
    track.setPointerCapture(e.pointerId);

    const updateTrim = (clientX: number) => {
      const rect = track.getBoundingClientRect();
      let pct = (clientX - rect.left) / rect.width;
      pct = Math.max(0, Math.min(1, pct));
      const val = pct * duration;

      if (type === 'start') {
        setTrimStart(Math.min(val, trimEnd - 0.2));
        if (videoRef.current) videoRef.current.currentTime = Math.min(val, trimEnd - 0.2);
      } else {
        setTrimEnd(Math.max(val, trimStart + 0.2));
        if (videoRef.current) videoRef.current.currentTime = Math.max(val, trimStart + 0.2);
      }
    };

    const handlePointerMove = (moveEvt: PointerEvent) => {
      updateTrim(moveEvt.clientX);
    };

    const handlePointerUp = (upEvt: PointerEvent) => {
      track.releasePointerCapture(upEvt.pointerId);
      track.removeEventListener('pointermove', handlePointerMove);
      track.removeEventListener('pointerup', handlePointerUp);
    };

    track.addEventListener('pointermove', handlePointerMove);
    track.addEventListener('pointerup', handlePointerUp);
  };

  // Perform single & batch extraction
  const handleStartExtraction = async () => {
    if (queue.length === 0) return;
    
    setIsProcessing(true);
    setZipUrl(null);
    setProgressMessage('Preparing extraction pipeline…');

    const updatedConfig = {
      ...config,
      trim: {
        ...config.trim,
        start: trimStart,
        end: trimEnd
      }
    };

    const updatedQueue = [...queue];
    // Sequential batch processor
    for (let i = 0; i < updatedQueue.length; i++) {
      const item = updatedQueue[i];
      if (item.status === 'completed') continue;
      setQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'extracting', progress: 0 } : q));
      
      const isLargeFile = item.file.size > 50 * 1024 * 1024; // 50MB

      try {
        const resultBlob = exportMode === 'video'
          ? await cutVideoSilences(
              item.file,
              {
                silenceConfig,
                trim: {
                  enabled: config.trim.enabled,
                  start: trimStart,
                  end: trimEnd,
                },
              },
              (prog) => {
                setProgressMessage(`[${i + 1}/${queue.length}] ${prog.message}`);
                setQueue(prev => prev.map((q, idx) => idx === i ? { ...q, progress: prog.percent } : q));
                const baseProgress = (i / queue.length) * 100;
                const itemContribution = (prog.percent / queue.length);
                setOverallProgress(Math.round(baseProgress + itemContribution));
              }
            )
          : await extractAudioFromVideo(
              item.file,
              updatedConfig,
              (prog) => {
                // Re-map progress strings based on local vs server fallback simulator
                let displayMsg = prog.message;
                let percent = prog.percent;

                if (isLargeFile) {
                  if (percent <= 25) {
                    displayMsg = 'Uploading video file to secure processing server…';
                  } else if (percent <= 50) {
                    displayMsg = 'Analyzing track and extracting audio (Server)…';
                  } else if (percent <= 75) {
                    displayMsg = 'Transcoding to high-quality audio (Server)…';
                  } else if (percent <= 95) {
                    displayMsg = 'Downloading audio output stream…';
                  } else {
                    displayMsg = 'Finished cloud extraction successfully!';
                  }
                }

                setProgressMessage(`[${i + 1}/${queue.length}] ${displayMsg}`);
                
                // Item progress updates
                setQueue(prev => prev.map((q, idx) => idx === i ? { ...q, progress: percent } : q));
                
                // Overall progress calculator
                const baseProgress = (i / queue.length) * 100;
                const itemContribution = (percent / queue.length);
                setOverallProgress(Math.round(baseProgress + itemContribution));
              }
            );

        const resultUrl = URL.createObjectURL(resultBlob);
        updatedQueue[i] = { 
          ...item, 
          status: 'completed', 
          progress: 100, 
          resultBlob, 
          resultUrl 
        };
        setQueue(prev => prev.map((q, idx) => idx === i ? updatedQueue[i] : q));

      } catch (err) {
        console.error(err);
        updatedQueue[i] = { 
          ...item, 
          status: 'failed', 
          progress: 0, 
          error: err instanceof Error ? err.message : 'Processing failed' 
        };
        setQueue(prev => prev.map((q, idx) => idx === i ? updatedQueue[i] : q));
      }
    }

    // Zip compression trigger for multiple files
    const completedItems = updatedQueue.filter(q => q.status === 'completed' || q.resultBlob);
    if (queue.length > 1 && completedItems.length > 0) {
      setProgressMessage('Packing batch files into ZIP archive…');
      try {
        const zip = new JSZip();
        completedItems.forEach((item) => {
          const blob = item.resultBlob;
          if (blob) {
            const ext = exportMode === 'video' ? (item.file.name.split('.').pop() || 'mp4') : config.format;
            const suffix = exportMode === 'video' ? '_cut' : '';
            const outName = `${item.name.replace(/\.[^/.]+$/, '')}${suffix}.${ext}`;
            zip.file(outName, blob);
          }
        });
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        setZipUrl(URL.createObjectURL(zipBlob));
      } catch (zipErr) {
        console.error('ZIP generation error:', zipErr);
      }
    }

    setIsProcessing(false);
    setOverallProgress(100);
    setProgressMessage('Processing task finished!');
  };

  const handleDownloadSingle = (item: QueueItem) => {
    if (!item.resultUrl) return;
    const ext = exportMode === 'video' ? (item.file.name.split('.').pop() || 'mp4') : config.format;
    const suffix = exportMode === 'video' ? '_cut' : '';
    const name = `${item.name.replace(/\.[^/.]+$/, '')}${suffix}.${ext}`;
    const a = document.createElement('a');
    a.href = item.resultUrl;
    a.download = name;
    a.click();
  };

  const handleDownloadZip = () => {
    if (!zipUrl) return;
    const a = document.createElement('a');
    a.href = zipUrl;
    a.download = `DecibelCut_Extraction_${Date.now()}.zip`;
    a.click();
  };

  const resetPage = () => {
    // Revoke all created URLs
    queue.forEach(q => {
      if (q.resultUrl) URL.revokeObjectURL(q.resultUrl);
    });
    if (zipUrl) URL.revokeObjectURL(zipUrl);

    setQueue([]);
    setActiveQueueId(null);
    setIsProcessing(false);
    setOverallProgress(0);
    setProgressMessage('');
    setZipUrl(null);
    setTrimStart(0);
    setTrimEnd(0);
    setDuration(0);
    if (waveSurferRef.current) waveSurferRef.current.destroy();
  };

  const formatTime = (time: number) => {
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    const ms = Math.floor((time % 1) * 100);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Check if any files have finished processing
  const hasFinishedItems = queue.some(q => q.status === 'completed');

  return (
    <div className={styles.root}>
      {/* Header navbar */}
      <header className={styles.header}>
        <Link to="/" className={styles.logo}>
          <span className={styles.logoIcon}>⚡</span>
          <span>Decibel<strong>Cut</strong></span>
        </Link>
        <button className={styles.backBtn} onClick={() => navigate('/')}>
          <ArrowLeft size={16} /> Back to Home
        </button>
      </header>

      <main className={styles.main}>
        {/* Title Badge Area */}
        <div className={styles.titleArea}>
          <span className={styles.badge}>Toolbox</span>
          <h1 className={styles.title}>🎬 Extract Audio from Video</h1>
          <p className={styles.subtitle}>
            Extract high-fidelity audio tracks from video files locally. Supports MP4, WebM, MOV, and MKV. Process in batches with custom bitrate, range trimming, and enhancers.
          </p>
        </div>

        {/* 1. Upload state */}
        {queue.length === 0 && (
          <div className={styles.card}>
            <div 
              className={[styles.uploadZone, isDragActive ? styles.uploadZoneActive : ''].join(' ')}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => document.getElementById('video-uploader')?.click()}
            >
              <div className={styles.uploadIconWrap}>
                <Upload size={28} />
              </div>
              <div className={styles.uploadText}>
                <h3>Drag & drop video files here</h3>
                <p>or click to browse from your device</p>
              </div>
              <input 
                type="file" 
                id="video-uploader" 
                className={styles.fileInput} 
                multiple
                accept="video/*,.mkv"
                onChange={handleFileSelect}
              />
              <span className={styles.supportedFormats}>
                MP4, MOV, WEBM, MKV, AVI, FLV, M4V, TS (Max 500MB recommended)
              </span>
            </div>
          </div>
        )}

        {/* 2. Workspace state (Settings + Preview) */}
        {queue.length > 0 && !isProcessing && !hasFinishedItems && (
          <div className={styles.workspace}>
            
            {/* Left Column: Player & Queue */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className={styles.videoContainer}>
                <div className={styles.videoWrapper}>
                  {activeItem ? (
                    <video 
                      ref={videoRef} 
                      src={activeVideoUrl} 
                      className={styles.videoPlayer}
                    />
                  ) : (
                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                      Select a video from the queue to preview
                    </div>
                  )}
                </div>

                {/* Custom Controls */}
                <div className={styles.videoControls}>
                  <button className={styles.playBtn} onClick={togglePlay}>
                    {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                  </button>

                  <span className={styles.timeLabel}>
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>

                  <input 
                    type="range"
                    min={0}
                    max={duration || 100}
                    step={0.05}
                    value={currentTime}
                    onChange={handleSeekChange}
                    className={styles.seekSlider}
                  />

                  <div className={styles.volumeContainer}>
                    <button className={styles.volumeBtn} onClick={toggleMute}>
                      {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </button>
                    <input 
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className={styles.volumeSlider}
                    />
                  </div>
                </div>

                {/* Range Trim handles */}
                <div className={styles.trimContainer}>
                  <div className={styles.trimHeader}>
                    <span className={styles.trimLabel}>
                      <input 
                        type="checkbox" 
                        id="trim-enable"
                        className={styles.checkbox}
                        checked={config.trim.enabled}
                        onChange={(e) => setConfig(prev => ({ 
                          ...prev, 
                          trim: { ...prev.trim, enabled: e.target.checked } 
                        }))}
                      />
                      <label htmlFor="trim-enable">Enable Range Trimming</label>
                    </span>
                    <span>Trim Duration: {formatTime(config.trim.enabled ? (trimEnd - trimStart) : duration)}</span>
                  </div>

                  {config.trim.enabled && (
                    <>
                      <div className={styles.trimRangeInput} ref={trimTrackRef}>
                        <div className={styles.trimTrack} />
                        <div 
                          className={styles.trimRangeFill}
                          style={{
                            left: `${(trimStart / (duration || 1)) * 100}%`,
                            width: `${((trimEnd - trimStart) / (duration || 1)) * 100}%`
                          }}
                        />
                        <div 
                          className={styles.trimHandle}
                          style={{ left: `${(trimStart / (duration || 1)) * 100}%` }}
                          onPointerDown={handlePointerDown('start')}
                        />
                        <div 
                          className={styles.trimHandle}
                          style={{ left: `${(trimEnd / (duration || 1)) * 100}%` }}
                          onPointerDown={handlePointerDown('end')}
                        />
                      </div>

                      <div className={styles.trimTimes}>
                        <span>Start: {formatTime(trimStart)}</span>
                        <span>End: {formatTime(trimEnd)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Batch Queue panel */}
              {queue.length > 1 && (
                <div className={styles.queuePanel}>
                  <div className={styles.queueHeader}>
                    <span>Batch Files ({queue.length})</span>
                    <button 
                      style={{ background: 'transparent', border: 'none', color: 'var(--color-error)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}
                      onClick={resetPage}
                    >
                      <Trash2 size={14} /> Clear All
                    </button>
                  </div>
                  <div className={styles.queueList}>
                    {queue.map((item) => (
                      <div 
                        key={item.id} 
                        className={[styles.queueItem, item.id === activeQueueId ? styles.queueItemActive : ''].join(' ')}
                        style={{ cursor: 'pointer', borderLeft: item.id === activeQueueId ? '3px solid var(--color-accent)' : undefined }}
                        onClick={() => setActiveQueueId(item.id)}
                      >
                        <div className={styles.queueFileInfo}>
                          <span className={styles.queueFilename}>{item.name}</span>
                          <span className={styles.queueSize}>
                            {formatSize(item.size)}
                            {item.metadata && ` • ${item.metadata.width}x${item.metadata.height} • ${item.metadata.duration.toFixed(1)}s`}
                          </span>
                        </div>
                        <div className={styles.queueItemActions}>
                          <span className={`${styles.queueStatus} ${styles.statusPending}`}>Pending</span>
                          <button className={styles.removeQueueBtn} onClick={(e) => removeQueueItem(item.id, e)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Settings & Actions */}
            <div className={styles.settingsContainer}>
              <div className={styles.settingsHeader}>Processing Mode</div>
              
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                <button
                  type="button"
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    backgroundColor: exportMode === 'audio' ? 'var(--color-accent)' : 'rgba(255,255,255,0.05)',
                    color: '#fff',
                    border: 'none',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => setExportMode('audio')}
                >
                  🎧 Extract Audio
                </button>
                <button
                  type="button"
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    backgroundColor: exportMode === 'video' ? 'var(--color-accent)' : 'rgba(255,255,255,0.05)',
                    color: '#fff',
                    border: 'none',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => setExportMode('video')}
                >
                  🎬 Trim Video
                </button>
              </div>

              {exportMode === 'audio' ? (
                <>
                  <div className={styles.settingsHeader}>Extraction Parameters</div>

                  <div className={styles.formGrid}>
                    <div className={styles.formGroup}>
                      <label htmlFor="format-select">Format</label>
                      <select 
                        id="format-select" 
                        className={styles.select}
                        value={config.format}
                        onChange={(e) => setConfig(prev => ({ ...prev, format: e.target.value as VideoExtractionConfig['format'] }))}
                      >
                        <option value="mp3">MP3 (.mp3)</option>
                        <option value="wav">WAV (.wav)</option>
                        <option value="flac">FLAC (.flac)</option>
                        <option value="aac">AAC (.aac)</option>
                        <option value="ogg">OGG (.ogg)</option>
                        <option value="m4a">M4A (.m4a)</option>
                      </select>
                    </div>

                    <div className={styles.formGroup} style={{ opacity: config.format === 'wav' || config.format === 'flac' ? 0.5 : 1 }}>
                      <label htmlFor="bitrate-select">Bitrate</label>
                      <select 
                        id="bitrate-select" 
                        className={styles.select}
                        disabled={config.format === 'wav' || config.format === 'flac'}
                        value={config.bitrate}
                        onChange={(e) => setConfig(prev => ({ ...prev, bitrate: parseInt(e.target.value) }))}
                      >
                        <option value={96}>96 kbps (Fast/Low)</option>
                        <option value={128}>128 kbps (Standard)</option>
                        <option value={192}>192 kbps (Medium-High)</option>
                        <option value={256}>256 kbps (High)</option>
                        <option value={320}>320 kbps (Extreme/HD)</option>
                      </select>
                    </div>
                  </div>

                  <div className={styles.formGrid}>
                    <div className={styles.formGroup}>
                      <label htmlFor="samplerate-select">Sample Rate</label>
                      <select 
                        id="samplerate-select" 
                        className={styles.select}
                        value={config.sampleRate}
                        onChange={(e) => setConfig(prev => ({ ...prev, sampleRate: parseInt(e.target.value) }))}
                      >
                        <option value={22050}>22,050 Hz</option>
                        <option value={32000}>32,000 Hz</option>
                        <option value={44100}>44,100 Hz (CD)</option>
                        <option value={48000}>48,000 Hz (Studio)</option>
                      </select>
                    </div>

                    <div className={styles.formGroup}>
                      <label htmlFor="channels-select">Channels</label>
                      <select 
                        id="channels-select" 
                        className={styles.select}
                        value={config.channels}
                        onChange={(e) => setConfig(prev => ({ ...prev, channels: parseInt(e.target.value) }))}
                      >
                        <option value={1}>Mono</option>
                        <option value={2}>Stereo</option>
                      </select>
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="preset-select">Quality Preset</label>
                    <select 
                      id="preset-select" 
                      className={styles.select}
                      value={config.qualityPreset}
                      onChange={(e) => setConfig(prev => ({ ...prev, qualityPreset: e.target.value as VideoExtractionConfig['qualityPreset'] }))}
                    >
                      <option value="fast">Ultrafast Encoding</option>
                      <option value="balanced">Balanced Quality/Speed</option>
                      <option value="best">Best Audio Quality (Slower)</option>
                    </select>
                  </div>

                  <div className={styles.enhancements}>
                    <span className={styles.enhancementsTitle}>Audio Enhancements</span>
                    
                    <label className={styles.checkboxLabel}>
                      <input 
                        type="checkbox" 
                        className={styles.checkbox}
                        checked={config.normalize}
                        onChange={(e) => setConfig(prev => ({ ...prev, normalize: e.target.checked }))}
                      />
                      Volume Normalization (Equalizes volume levels)
                    </label>

                    <label className={styles.checkboxLabel}>
                      <input 
                        type="checkbox" 
                        className={styles.checkbox}
                        checked={config.fadeIn}
                        onChange={(e) => setConfig(prev => ({ ...prev, fadeIn: e.target.checked }))}
                      />
                      Apply 2s Fade-In (Smooth audio start)
                    </label>

                    <label className={styles.checkboxLabel}>
                      <input 
                        type="checkbox" 
                        className={styles.checkbox}
                        checked={config.fadeOut}
                        onChange={(e) => setConfig(prev => ({ ...prev, fadeOut: e.target.checked }))}
                      />
                      Apply 2s Fade-Out (Smooth audio end)
                    </label>

                    <label className={styles.checkboxLabel}>
                      <input 
                        type="checkbox" 
                        className={styles.checkbox}
                        checked={config.preserveMetadata}
                        onChange={(e) => setConfig(prev => ({ ...prev, preserveMetadata: e.target.checked }))}
                      />
                      Copy metadata tags & properties
                    </label>
                  </div>
                </>
              ) : (
                <>
                  <div className={styles.settingsHeader}>Silence Detection Settings</div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                    <Slider
                      label="Silence Threshold"
                      value={silenceConfig.threshold}
                      min={-70}
                      max={-10}
                      step={0.5}
                      displayValue={`${silenceConfig.threshold.toFixed(1)} dBFS`}
                      onChange={(v) => setSilenceConfig(prev => ({ ...prev, threshold: v }))}
                    />

                    <Slider
                      label="Min Silence Duration"
                      value={silenceConfig.minSilenceDuration}
                      min={0.1}
                      max={10}
                      step={0.1}
                      unit="s"
                      displayValue={`${silenceConfig.minSilenceDuration.toFixed(1)}s`}
                      onChange={(v) => setSilenceConfig(prev => ({ ...prev, minSilenceDuration: v }))}
                    />

                    <Slider
                      label="Padding Before Cut"
                      value={silenceConfig.paddingBefore}
                      min={0}
                      max={1}
                      step={0.01}
                      displayValue={`${(silenceConfig.paddingBefore * 1000).toFixed(0)}ms`}
                      onChange={(v) => setSilenceConfig(prev => ({ ...prev, paddingBefore: v }))}
                    />

                    <Slider
                      label="Padding After Cut"
                      value={silenceConfig.paddingAfter}
                      min={0}
                      max={1}
                      step={0.01}
                      displayValue={`${(silenceConfig.paddingAfter * 1000).toFixed(0)}ms`}
                      onChange={(v) => setSilenceConfig(prev => ({ ...prev, paddingAfter: v }))}
                    />
                  </div>
                </>
              )}

              {/* Action Trigger Button */}
              <button type="button" className={styles.extractBtn} onClick={handleStartExtraction}>
                <VideoIcon size={18} />
                {exportMode === 'video'
                  ? `Trim & Cut Video${queue.length > 1 ? 's' : ''}`
                  : `Extract Audio Track${queue.length > 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}

        {/* 3. Processing / Transcoding state */}
        {isProcessing && (
          <div className={styles.card}>
            <div className={styles.progressContainer}>
              <div className={styles.spinner} />
              
              <div className={styles.progressHeader}>
                <h3>Extracting Audio Tracks</h3>
                <p>{progressMessage}</p>
              </div>

              <div className={styles.progressBarOuter}>
                <div 
                  className={styles.progressBarInner}
                  style={{ width: `${overallProgress}%` }}
                />
              </div>

              <span className={styles.progressPercent}>{overallProgress}%</span>
              
              <button className={styles.cancelBtn} onClick={resetPage}>
                Abort Task
              </button>
            </div>
          </div>
        )}

        {/* 4. Complete / Download Results state */}
        {hasFinishedItems && !isProcessing && (
          <div className={styles.card}>
            <div className={styles.resultContainer}>
              <div className={styles.successIcon}>
                <CheckCircle size={36} />
              </div>
              
              <div className={styles.resultTitle}>
                <h3>Audio Extraction Complete!</h3>
                <p>Your tracks have been extracted locally and are ready to save.</p>
              </div>

              {/* Single File Mode Waveform View */}
              {queue.length === 1 && activeItem && activeItem.resultUrl && (
                <div className={waveformContainerClass(activeItem.id)}>
                  <div className={styles.waveform} ref={waveformRef} />
                  
                  <div className={styles.waveformControls}>
                    <button 
                      className={styles.playBtn}
                      onClick={() => waveSurferRef.current?.playPause()}
                    >
                      {resultPlaying ? <Pause size={14} /> : <Play size={14} />}
                    </button>
                    <div className={styles.resultMeta}>
                      <span className={styles.resultFilename}>{activeItem.name.replace(/\.[^/.]+$/, '')}.{config.format}</span>
                      <span className={styles.resultSpecs}>
                        {config.format.toUpperCase()} • {config.sampleRate}Hz • {config.channels === 2 ? 'Stereo' : 'Mono'}
                        {activeItem.resultBlob && ` • ${formatSize(activeItem.resultBlob.size)}`}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Batch Mode queue layout */}
              {queue.length > 1 && (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className={styles.queueHeader}>Extracted Files Queue</div>
                  <div className={styles.queueList} style={{ maxHeight: '250px' }}>
                    {queue.map((item) => (
                      <div 
                        key={item.id} 
                        className={styles.queueItem}
                        style={{ background: item.status === 'completed' ? 'rgba(52, 211, 153, 0.04)' : undefined }}
                      >
                        <div className={styles.queueFileInfo}>
                          <span className={styles.queueFilename} style={{ fontWeight: 600 }}>
                            {item.name.replace(/\.[^/.]+$/, '')}.{config.format}
                          </span>
                          <span className={styles.queueSize}>
                            {item.resultBlob ? formatSize(item.resultBlob.size) : '0 KB'} • Status: {item.status}
                          </span>
                        </div>
                        <div className={styles.queueItemActions}>
                          {item.status === 'completed' ? (
                            <button 
                              className={styles.removeQueueBtn} 
                              style={{ color: 'var(--color-accent-light)' }} 
                              onClick={() => handleDownloadSingle(item)}
                            >
                              <Download size={16} />
                            </button>
                          ) : (
                            <span style={{ color: 'var(--color-error)', fontSize: '0.72rem' }}>Failed</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions panel */}
              <div className={styles.resultActions}>
                {queue.length > 1 && zipUrl && (
                  <button className={styles.downloadBtn} onClick={handleDownloadZip}>
                    <FileDown size={18} /> Download All (.ZIP)
                  </button>
                )}
                {queue.length === 1 && activeItem && (
                  <button className={styles.downloadBtn} onClick={() => handleDownloadSingle(activeItem)}>
                    <Download size={18} /> Download Audio File
                  </button>
                )}
                <button className={styles.restartBtn} onClick={resetPage}>
                  <RefreshCw size={16} /> Extract Another
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

// Helper helper function for multiple waveform selection checks
const waveformContainerClass = (_itemId: string) => {
  return styles.waveformContainer;
};
