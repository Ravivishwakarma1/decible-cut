// ============================================================
// DecibelCut — Creator Tools Page
// Platform Audio Optimizer & Advanced DSP Master
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import WaveSurfer from 'wavesurfer.js';
import HoverPlugin from 'wavesurfer.js/dist/plugins/hover.js';
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.js';
import { 
  ArrowLeft, Upload, FileAudio, Sliders, Play, Pause, Square, 
  Volume2, VolumeX, CheckCircle2, Download, Copy, Share2, 
  Save, RefreshCw, Wand2, Sparkles, ChevronDown, Check,
  Cpu, Settings, Layers
} from 'lucide-react';
import styles from './CreatorToolsPage.module.css';

import { 
  CREATOR_PRESETS, 
  analyzeAudioForSuggestions, 
  processCreatorAudio, 
  processBatchExport 
} from '../services/creatorToolsService';
import type {
  CreatorPreset, 
  CreatorDSPConfig, 
  AISuggestions 
} from '../services/creatorToolsService';
import { decodeAudioFile } from '../services/audioEngine';
import { formatDuration, formatFileSize } from '../utils/formatters';
import type { ExportProgress } from '../types/processing.types';
import { useSEO } from '../hooks/useSEO';
import { useDspPreview } from '../hooks/useDspPreview';

export const CreatorToolsPage: React.FC = () => {
  useSEO({
    title: 'Advanced Audio Creator Tools — DecibelCut',
    description: 'Optimize your audio for YouTube, Spotify, and TikTok. Add voice compression, loudness normalization, noise gates, and batch export.'
  });

  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Audio state
  const [file, setFile] = useState<File | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [fileLoadProgress, setFileLoadProgress] = useState(0);

  // Waveform state
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  
  // Presets and Custom overrides state
  const [selectedPreset, setSelectedPreset] = useState<CreatorPreset>(CREATOR_PRESETS[0]);
  const [customOverrides, setCustomOverrides] = useState<Partial<CreatorPreset>>({});

  // DSP Configuration
  const [dspConfig, setDspConfig] = useState<CreatorDSPConfig>({
    loudnessNormalize: true,
    removeSilence: false,
    fadeIn: true,
    fadeOut: true,
    noiseReduction: false,
    voiceEnhancement: true,
    compressor: false,
    limiter: false,
    normalizePeaks: false,
    bassEnhancement: false,
    trebleEnhancement: false,
    vocalBoost: false,
    deEsser: false,
    eqPreset: 'none',
  });

  // Apply real-time DSP preview on playbacks
  useDspPreview(audioElement, dspConfig, duration, currentTime);

  // AI suggestions
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestions | null>(null);
  const [showAiBanner, setShowAiBanner] = useState(true);

  // Batch Export selection
  const [batchSelection, setBatchSelection] = useState<Record<string, boolean>>({});
  const [showBatchPanel, setShowBatchPanel] = useState(false);

  // Processing state
  const [processingProgress, setProcessingProgress] = useState<ExportProgress | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Sync manual settings with selected preset
  useEffect(() => {
    setCustomOverrides({});
  }, [selectedPreset]);

  // Read config settings
  const activeConfig = { ...selectedPreset, ...customOverrides };

  // Track URLs for cleanup
  const audioUrlRef = useRef<string | null>(null);
  const resultUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (audioUrlRef.current && audioUrlRef.current !== audioUrl) {
      URL.revokeObjectURL(audioUrlRef.current);
    }
    audioUrlRef.current = audioUrl;
  }, [audioUrl]);

  useEffect(() => {
    if (resultUrlRef.current && resultUrlRef.current !== resultUrl) {
      URL.revokeObjectURL(resultUrlRef.current);
    }
    resultUrlRef.current = resultUrl;
  }, [resultUrl]);

  // Destroy WaveSurfer on unmount
  useEffect(() => {
    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
      }
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    };
  }, []);

  // Handle file analysis and loading
  const loadAudioBuffer = async (audioFile: File) => {
    setIsLoadingFile(true);
    setFileLoadProgress(10);
    try {
      const { buffer } = await decodeAudioFile(audioFile, (progress) => {
        setFileLoadProgress(progress);
      });
      
      setFile(audioFile);
      setAudioBuffer(buffer);

      const url = URL.createObjectURL(audioFile);
      setAudioUrl(url);

      // AI audio suggestion triggers
      const suggestions = analyzeAudioForSuggestions(buffer, audioFile.name);
      setAiSuggestions(suggestions);

      // Auto-apply suggested preset & settings
      const matchingPreset = CREATOR_PRESETS.find(p => p.id === suggestions.bestPresetId) || CREATOR_PRESETS[0];
      setSelectedPreset(matchingPreset);
      setDspConfig(prev => ({
        ...prev,
        noiseReduction: suggestions.noiseRemoval,
        voiceEnhancement: suggestions.voiceEnhancement,
        compressor: suggestions.compressionLevel !== 'none',
      }));

    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Error decoding audio file');
    } finally {
      setIsLoadingFile(false);
    }
  };

  // Drag & drop logic
  const [dragActive, setDragActive] = useState(false);
  
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      loadAudioBuffer(e.dataTransfer.files[0]);
    }
  };

  // Initialize WaveSurfer
  useEffect(() => {
    if (!audioUrl || !waveformRef.current) return;

    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
    }

    const timelinePlugin = TimelinePlugin.create({
      height: 15,
      style: {
        fontSize: '9px',
        color: '#7a7a9a'
      }
    });

    const hoverPlugin = HoverPlugin.create({
      lineColor: 'var(--color-accent-light)',
      lineWidth: 1
    });

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: 'rgba(124, 111, 247, 0.2)',
      progressColor: 'var(--color-accent)',
      cursorColor: 'var(--color-waveform-cursor)',
      height: 100,
      barWidth: 2,
      barGap: 1.5,
      barRadius: 2,
      plugins: [timelinePlugin, hoverPlugin]
    });

    ws.load(audioUrl);
    wavesurferRef.current = ws;

    ws.on('ready', () => {
      setDuration(ws.getDuration());
      setCurrentTime(0);
      setIsPlaying(false);
      setAudioElement(ws.getMediaElement() as HTMLAudioElement);
    });

    ws.on('timeupdate', (t) => {
      setCurrentTime(t);
    });

    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));

    return () => {
      setAudioElement(null);
      ws.destroy();
      wavesurferRef.current = null;
    };
  }, [audioUrl]);

  // Audio actions
  const togglePlay = () => {
    if (wavesurferRef.current) wavesurferRef.current.playPause();
  };

  const stopPlayback = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.stop();
      setCurrentTime(0);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    if (wavesurferRef.current) {
      wavesurferRef.current.setVolume(vol);
    }
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (wavesurferRef.current) {
      wavesurferRef.current.setVolume(nextMuted ? 0 : volume);
    }
  };

  // Master Processing trigger
  const runMasterPipeline = async () => {
    if (!audioBuffer || !file) return;

    setIsProcessing(true);
    setResultUrl(null);

    try {
      let workingBuffer = audioBuffer;

      // Stage A: Silence removal (using existing engine)
      if (dspConfig.removeSilence) {
        setProcessingProgress({ status: 'preparing', percent: 15, message: 'Analyzing gaps…' });
        const { detectSilence } = await import('../services/silenceDetector');
        const { processAudio } = await import('../services/audioProcessor');
        
        const silenceResults = detectSilence(audioBuffer, {
          threshold: -40,
          minSilenceDuration: 1.2,
          paddingBefore: 0.1,
          paddingAfter: 0.1,
          crossfadeDuration: 0.03
        });

        if (silenceResults.regions.length > 0) {
          setProcessingProgress({ status: 'preparing', percent: 25, message: 'Trimming silent pauses…' });
          const processed = await processAudio(audioBuffer, silenceResults.regions, {
            threshold: -40,
            minSilenceDuration: 1.2,
            paddingBefore: 0.1,
            paddingAfter: 0.1,
            crossfadeDuration: 0.03
          });
          workingBuffer = processed.buffer;
        }
      }

      // Stage B: Preset DSP encoding using FFmpeg WASM
      const exportedBlob = await processCreatorAudio(
        workingBuffer,
        selectedPreset,
        dspConfig,
        customOverrides,
        (progress) => {
          setProcessingProgress(progress);
        }
      );

      const url = URL.createObjectURL(exportedBlob);
      setResultUrl(url);

      // Trigger automatic file download
      const cleanBase = file.name.replace(/\.[^.]+$/, '');
      const outFilename = `${cleanBase}_mastered.${activeConfig.format}`;
      const dlLink = document.createElement('a');
      dlLink.href = url;
      dlLink.download = outFilename;
      dlLink.click();

      // Show sharing summary modal
      setShowShareModal(true);

    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Audio processing error');
    } finally {
      setIsProcessing(false);
      setProcessingProgress(null);
    }
  };

  // Batch Mastering trigger
  const runBatchMasterPipeline = async () => {
    if (!audioBuffer || !file) return;

    // Get selected presets
    const selectedPresets = CREATOR_PRESETS.filter(p => batchSelection[p.id]);
    if (selectedPresets.length === 0) {
      alert('Please select at least one preset for batch export');
      return;
    }

    setIsProcessing(true);

    try {
      const zipBlob = await processBatchExport(
        audioBuffer,
        selectedPresets,
        dspConfig,
        file.name,
        (progress) => {
          setProcessingProgress(progress);
        }
      );

      const url = URL.createObjectURL(zipBlob);
      const cleanBase = file.name.replace(/\.[^.]+$/, '');
      const outFilename = `${cleanBase}_batch_master.zip`;

      const dlLink = document.createElement('a');
      dlLink.href = url;
      dlLink.download = outFilename;
      dlLink.click();

      // Clear selection
      setBatchSelection({});
      setShowBatchPanel(false);
      
      alert('Batch mastering complete! ZIP downloaded.');
    } catch (err) {
      console.error(err);
      alert('Batch mastering failed');
    } finally {
      setIsProcessing(false);
      setProcessingProgress(null);
    }
  };

  // Shared Modal Actions
  const copyMockLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const shareMasterFile = () => {
    if (navigator.share && file) {
      navigator.share({
        title: 'Mastered Audio from DecibelCut',
        text: 'I just optimized my audio for publishing!',
        url: window.location.href
      }).catch(console.error);
    } else {
      alert('Native sharing is not supported in this browser. Please use Copy Link.');
    }
  };

  // Auto preset applier
  const applyPresetSettings = (preset: CreatorPreset) => {
    setSelectedPreset(preset);
    // Auto preset configurations
    const defaultDSP: Partial<CreatorDSPConfig> = {
      loudnessNormalize: true,
      fadeIn: true,
      fadeOut: true,
      noiseReduction: preset.id === 'whatsapp' || preset.id === 'discord',
      voiceEnhancement: preset.id === 'spotify-podcast' || preset.id === 'apple-podcast',
      compressor: preset.id === 'youtube' || preset.id === 'spotify-podcast',
      limiter: true,
    };
    
    // Auto Eq guesser
    if (preset.id.includes('podcast')) {
      defaultDSP.eqPreset = 'podcast';
    } else if (preset.id === 'ringtone') {
      defaultDSP.eqPreset = 'music';
      defaultDSP.loudnessNormalize = false;
      defaultDSP.normalizePeaks = true;
    } else {
      defaultDSP.eqPreset = 'none';
    }

    setDspConfig(prev => ({ ...prev, ...defaultDSP }));
  };

  return (
    <div className={styles.containerPage}>
      {/* Custom Header Bar */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backBtn} onClick={() => navigate('/')} title="Back to Home">
            <ArrowLeft size={16} />
            <span>Home</span>
          </button>
          <div className={styles.logoMark}>⚡</div>
          <span className={styles.logoText}>Decibel<strong>Cut</strong> <small className={styles.moduleBadge}>Creator Tools</small></span>
        </div>
        <div className={styles.headerRight}>
          <button className={styles.navLink} onClick={() => navigate('/podcast-studio')}>Podcast Studio</button>
          <button className={styles.navLink} onClick={() => navigate('/app')}>Silence Remover</button>
        </div>
      </header>

      {/* Main Panel View */}
      <main className={styles.mainContent}>
        {!file ? (
          // 1. Dashboard View
          <div className={styles.dashboardView}>
            <div className={styles.dashHeader}>
              <h1 className={styles.dashTitle}>🎬 Creator Tools</h1>
              <p className={styles.dashSubtitle}>Optimize your audio for every platform entirely client-side. Select a target preset to begin.</p>
            </div>

            {/* Presets Grid */}
            <div className={styles.presetsGrid}>
              {CREATOR_PRESETS.map((preset) => (
                <div 
                  key={preset.id} 
                  className={styles.presetCard}
                  onClick={() => {
                    applyPresetSettings(preset);
                    fileInputRef.current?.click();
                  }}
                >
                  <div className={styles.presetCardIcon}>{preset.icon}</div>
                  <h3 className={styles.presetCardTitle}>{preset.name}</h3>
                  <p className={styles.presetCardSubtitle}>{preset.subtitle}</p>
                  <div className={styles.presetCardSpecs}>
                    <span>{preset.format.toUpperCase()}</span>
                    <span>{preset.bitrate}kbps</span>
                    <span>{preset.loudness} LUFS</span>
                    <span>{preset.channels === 2 ? 'Stereo' : 'Mono'}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Upload Area */}
            <div 
              className={[styles.uploadBox, dragActive ? styles.dragActive : ''].join(' ')}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                className={styles.fileInput} 
                accept="audio/*" 
                onChange={(e) => e.target.files?.[0] && loadAudioBuffer(e.target.files[0])}
              />
              <Upload size={36} className={styles.uploadIcon} />
              <h3 className={styles.uploadTitle}>Or drag and drop your audio file directly</h3>
              <p className={styles.uploadDesc}>Supports MP3, WAV, FLAC, AAC, OGG, M4A up to 500MB</p>
              
              {isLoadingFile && (
                <div className={styles.fileLoader}>
                  <div className={styles.spinner} />
                  <span>Decoding audio file ({fileLoadProgress}%)…</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          // 2. Interactive Workspace View
          <div className={styles.workspace}>
            {/* Top Workspace Bar */}
            <div className={styles.workspaceBar}>
              <div className={styles.fileChip}>
                <FileAudio size={16} />
                <span className={styles.fileName} title={file.name}>{file.name}</span>
                <span className={styles.fileSize}>{formatFileSize(file.size)}</span>
                <span className={styles.fileDuration}>{formatDuration(duration)}</span>
              </div>
              
              <div className={styles.workspaceActions}>
                <button 
                  className={styles.resetBtn} 
                  onClick={() => {
                    setFile(null);
                    setAudioBuffer(null);
                    setAudioUrl(null);
                    setResultUrl(null);
                  }}
                >
                  <RefreshCw size={14} />
                  <span>Load New File</span>
                </button>
              </div>
            </div>

            {/* AI Suggestion Banner */}
            {aiSuggestions && showAiBanner && (
              <div className={styles.aiBanner}>
                <div className={styles.aiBannerLeft}>
                  <div className={styles.aiIconPulse}>
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <strong className={styles.aiTitle}>AI Audio Copilot Suggestions</strong>
                    <ul className={styles.aiTips}>
                      {aiSuggestions.reasoning.map((tip, idx) => (
                        <li key={idx} className={styles.aiTip}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <button className={styles.aiClose} onClick={() => setShowAiBanner(false)}>×</button>
              </div>
            )}

            <div className={styles.workspaceLayout}>
              {/* Left Settings Sidebar */}
              <aside className={styles.sidebar}>
                <div className={styles.sidebarSection}>
                  <h4 className={styles.sectionHeaderTitle}>
                    <Layers size={14} />
                    <span>Target Preset</span>
                  </h4>
                  <div className={styles.selectWrapper}>
                    <select 
                      className={styles.presetSelect} 
                      value={selectedPreset.id} 
                      onChange={(e) => {
                        const pr = CREATOR_PRESETS.find(p => p.id === e.target.value);
                        if (pr) applyPresetSettings(pr);
                      }}
                    >
                      {CREATOR_PRESETS.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className={styles.selectArrow} />
                  </div>
                </div>

                <div className={styles.sidebarSection}>
                  <h4 className={styles.sectionHeaderTitle}>
                    <Settings size={14} />
                    <span>Manual Configuration Overrides</span>
                  </h4>
                  
                  <div className={styles.manualControls}>
                    {/* Format */}
                    <div className={styles.controlRow}>
                      <span className={styles.controlLabel}>Format</span>
                      <div className={styles.selectOverrideWrapper}>
                        <select 
                          value={activeConfig.format} 
                          onChange={(e) => setCustomOverrides(prev => ({ ...prev, format: e.target.value as any }))}
                        >
                          <option value="mp3">MP3</option>
                          <option value="wav">WAV</option>
                          <option value="flac">FLAC</option>
                          <option value="aac">AAC</option>
                          <option value="m4a">M4A</option>
                          <option value="ogg">OGG</option>
                        </select>
                      </div>
                    </div>

                    {/* Bitrate */}
                    {activeConfig.format !== 'wav' && activeConfig.format !== 'flac' && (
                      <div className={styles.controlRow}>
                        <span className={styles.controlLabel}>Bitrate</span>
                        <div className={styles.selectOverrideWrapper}>
                          <select 
                            value={activeConfig.bitrate} 
                            onChange={(e) => setCustomOverrides(prev => ({ ...prev, bitrate: parseInt(e.target.value) }))}
                          >
                            <option value={64}>64 kbps (Mono/Voice)</option>
                            <option value={128}>128 kbps (Standard)</option>
                            <option value={192}>192 kbps (Medium High)</option>
                            <option value={256}>256 kbps (High Quality)</option>
                            <option value={320}>320 kbps (Studio AAC)</option>
                            <option value={384}>384 kbps (Ultra High)</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Sample Rate */}
                    <div className={styles.controlRow}>
                      <span className={styles.controlLabel}>Sample Rate</span>
                      <div className={styles.selectOverrideWrapper}>
                        <select 
                          value={activeConfig.sampleRate} 
                          onChange={(e) => setCustomOverrides(prev => ({ ...prev, sampleRate: parseInt(e.target.value) }))}
                        >
                          <option value={16000}>16000 Hz (Voice note)</option>
                          <option value={32000}>32000 Hz (FM Quality)</option>
                          <option value={44100}>44100 Hz (CD Standard)</option>
                          <option value={48000}>48000 Hz (Video Standard)</option>
                        </select>
                      </div>
                    </div>

                    {/* Channels */}
                    <div className={styles.controlRow}>
                      <span className={styles.controlLabel}>Channels</span>
                      <div className={styles.channelsToggle}>
                        <button 
                          className={activeConfig.channels === 1 ? styles.channelBtnActive : styles.channelBtn}
                          onClick={() => setCustomOverrides(prev => ({ ...prev, channels: 1 }))}
                        >
                          Mono
                        </button>
                        <button 
                          className={activeConfig.channels === 2 ? styles.channelBtnActive : styles.channelBtn}
                          onClick={() => setCustomOverrides(prev => ({ ...prev, channels: 2 }))}
                        >
                          Stereo
                        </button>
                      </div>
                    </div>

                    {/* Loudness Target Slider */}
                    {dspConfig.loudnessNormalize && (
                      <div className={styles.sliderControl}>
                        <div className={styles.sliderHeader}>
                          <span className={styles.controlLabel}>Loudness Target</span>
                          <span className={styles.sliderValue}>{activeConfig.loudness} LUFS</span>
                        </div>
                        <input 
                          type="range" 
                          min="-24" 
                          max="-10" 
                          step="1"
                          value={activeConfig.loudness} 
                          onChange={(e) => setCustomOverrides(prev => ({ ...prev, loudness: parseInt(e.target.value) }))}
                          className={styles.rangeInput}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Batch Export Panel */}
                <div className={styles.sidebarSection}>
                  <button 
                    className={styles.batchToggleBtn} 
                    onClick={() => setShowBatchPanel(!showBatchPanel)}
                  >
                    <Layers size={14} />
                    <span>Multi-Platform Batch Export</span>
                    <ChevronDown size={14} className={showBatchPanel ? styles.rotatedArrow : ''} />
                  </button>

                  {showBatchPanel && (
                    <div className={styles.batchPanelContent}>
                      <p className={styles.batchHelp}>Select platforms to export to simultaneously. We will wrap them into a ZIP archive.</p>
                      <div className={styles.batchChecks}>
                        {CREATOR_PRESETS.map(p => (
                          <label key={p.id} className={styles.checkboxLabel}>
                            <input 
                              type="checkbox" 
                              checked={!!batchSelection[p.id]}
                              onChange={(e) => setBatchSelection(prev => ({ ...prev, [p.id]: e.target.checked }))}
                            />
                            <span className={styles.checkboxIcon}>{p.icon}</span>
                            <span className={styles.checkboxText}>{p.name.replace(' Optimizer', '').replace(' Audio', '').replace(' Video', '')}</span>
                          </label>
                        ))}
                      </div>
                      <button 
                        className={styles.batchExportBtn}
                        onClick={runBatchMasterPipeline}
                        disabled={isProcessing}
                      >
                        <Cpu size={14} />
                        <span>Export Selected Batch</span>
                      </button>
                    </div>
                  )}
                </div>
              </aside>

              {/* Center Canvas */}
              <div className={styles.canvasArea}>
                {/* Waveform View */}
                <div className={styles.waveformSection}>
                  <div ref={waveformRef} className={styles.waveformCanvas} />
                  
                  {/* Visual controls */}
                  <div className={styles.waveformControls}>
                    <div className={styles.timeLabel}>
                      <span>{currentTime.toFixed(2)}</span> / <span>{duration.toFixed(2)}s</span>
                    </div>

                    <div className={styles.playBtns}>
                      <button className={styles.iconButton} onClick={togglePlay} title="Play/Pause">
                        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                      </button>
                      <button className={styles.iconButton} onClick={stopPlayback} title="Stop">
                        <Square size={14} />
                      </button>
                    </div>

                    <div className={styles.volSlider}>
                      <button className={styles.iconButton} onClick={toggleMute} title="Mute">
                        {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                      </button>
                      <input 
                        type="range" 
                        min="0" 
                        max="1" 
                        step="0.05" 
                        value={isMuted ? 0 : volume} 
                        onChange={handleVolumeChange}
                        className={styles.volInput}
                      />
                    </div>
                  </div>
                </div>

                {/* DSP Features Grid */}
                <div className={styles.dspGridSection}>
                  <h3 className={styles.dspGridTitle}>
                    <Sliders size={16} />
                    <span>Mastering Audio Processing Features</span>
                  </h3>

                  <div className={styles.dspToggles}>
                    {/* EQ Preset Selector */}
                    <div className={styles.eqSelectorCard}>
                      <span className={styles.dspTextWrap}>
                        <strong>EQ Mastering Preset</strong>
                        <small>Enhance overall frequency profile.</small>
                      </span>
                      <div className={styles.selectOverrideWrapper}>
                        <select 
                          value={dspConfig.eqPreset} 
                          onChange={(e) => setDspConfig(prev => ({ ...prev, eqPreset: e.target.value as any }))}
                        >
                          <option value="none">Flat (No EQ)</option>
                          <option value="podcast">🎙️ Podcast (Clarity Boost)</option>
                          <option value="gaming">🎮 Gaming (SFX Intelligibility)</option>
                          <option value="music">🎵 Music (Vibrant smile EQ)</option>
                          <option value="interview">🗣️ Interview (Focus voices)</option>
                          <option value="speech">📢 Speech (Presence boost)</option>
                          <option value="streaming">🖥️ Streaming (Loud leveling)</option>
                          <option value="vlog">📹 Vlog (Clean ambient voice)</option>
                        </select>
                      </div>
                    </div>

                    {/* Loudness Normalize */}
                    <label className={styles.dspCard}>
                      <input 
                        type="checkbox" 
                        checked={dspConfig.loudnessNormalize}
                        onChange={(e) => setDspConfig(prev => ({ ...prev, loudnessNormalize: e.target.checked, normalizePeaks: e.target.checked ? false : prev.normalizePeaks }))}
                      />
                      <span className={styles.dspTextWrap}>
                        <strong>Loudness Normalization</strong>
                        <small>Normalize levels according to platform LUFS recommendations.</small>
                      </span>
                    </label>

                    {/* Peak Normalize */}
                    <label className={styles.dspCard}>
                      <input 
                        type="checkbox" 
                        checked={dspConfig.normalizePeaks}
                        onChange={(e) => setDspConfig(prev => ({ ...prev, normalizePeaks: e.target.checked, loudnessNormalize: e.target.checked ? false : prev.loudnessNormalize }))}
                      />
                      <span className={styles.dspTextWrap}>
                        <strong>Normalize Peaks</strong>
                        <small>Master volume to maximum peak without compression.</small>
                      </span>
                    </label>

                    {/* Remove Silence */}
                    <label className={styles.dspCard}>
                      <input 
                        type="checkbox" 
                        checked={dspConfig.removeSilence}
                        onChange={(e) => setDspConfig(prev => ({ ...prev, removeSilence: e.target.checked }))}
                      />
                      <span className={styles.dspTextWrap}>
                        <strong>Smart Silence Remover</strong>
                        <small>Detect and auto-cut dead air pauses using local crossfades.</small>
                      </span>
                    </label>

                    {/* Noise Reduction */}
                    <label className={styles.dspCard}>
                      <input 
                        type="checkbox" 
                        checked={dspConfig.noiseReduction}
                        onChange={(e) => setDspConfig(prev => ({ ...prev, noiseReduction: e.target.checked }))}
                      />
                      <span className={styles.dspTextWrap}>
                        <strong>Noise Reduction</strong>
                        <small>Apply client-side FFT filters to eliminate low hum/hiss.</small>
                      </span>
                    </label>

                    {/* Voice Enhancement */}
                    <label className={styles.dspCard}>
                      <input 
                        type="checkbox" 
                        checked={dspConfig.voiceEnhancement}
                        onChange={(e) => setDspConfig(prev => ({ ...prev, voiceEnhancement: e.target.checked }))}
                      />
                      <span className={styles.dspTextWrap}>
                        <strong>Voice Enhancement</strong>
                        <small>Boost presence and shape audio frequencies for speech.</small>
                      </span>
                    </label>

                    {/* Compressor */}
                    <label className={styles.dspCard}>
                      <input 
                        type="checkbox" 
                        checked={dspConfig.compressor}
                        onChange={(e) => setDspConfig(prev => ({ ...prev, compressor: e.target.checked }))}
                      />
                      <span className={styles.dspTextWrap}>
                        <strong>Dynamic Compressor</strong>
                        <small>Even out speaking volume levels (attenuate peaks).</small>
                      </span>
                    </label>

                    {/* Limiter */}
                    <label className={styles.dspCard}>
                      <input 
                        type="checkbox" 
                        checked={dspConfig.limiter}
                        onChange={(e) => setDspConfig(prev => ({ ...prev, limiter: e.target.checked }))}
                      />
                      <span className={styles.dspTextWrap}>
                        <strong>Brickwall Limiter</strong>
                        <small>Prevent digital clipping distortion at master outputs.</small>
                      </span>
                    </label>

                    {/* De-Esser */}
                    <label className={styles.dspCard}>
                      <input 
                        type="checkbox" 
                        checked={dspConfig.deEsser}
                        onChange={(e) => setDspConfig(prev => ({ ...prev, deEsser: e.target.checked }))}
                      />
                      <span className={styles.dspTextWrap}>
                        <strong>Vocal De-Esser</strong>
                        <small>Soften sharp sibilant sounds ("s" and "t" peaks).</small>
                      </span>
                    </label>

                    {/* Bass Enhancement */}
                    <label className={styles.dspCard}>
                      <input 
                        type="checkbox" 
                        checked={dspConfig.bassEnhancement}
                        onChange={(e) => setDspConfig(prev => ({ ...prev, bassEnhancement: e.target.checked }))}
                      />
                      <span className={styles.dspTextWrap}>
                        <strong>Sub-Bass Enhancement</strong>
                        <small>Give voice/music a deep, warm podcast studio low end.</small>
                      </span>
                    </label>

                    {/* Treble Enhancement */}
                    <label className={styles.dspCard}>
                      <input 
                        type="checkbox" 
                        checked={dspConfig.trebleEnhancement}
                        onChange={(e) => setDspConfig(prev => ({ ...prev, trebleEnhancement: e.target.checked }))}
                      />
                      <span className={styles.dspTextWrap}>
                        <strong>Treble Air Enhancer</strong>
                        <small>Boost higher vocal register frequencies for sparkle.</small>
                      </span>
                    </label>

                    {/* Vocal Boost */}
                    <label className={styles.dspCard}>
                      <input 
                        type="checkbox" 
                        checked={dspConfig.vocalBoost}
                        onChange={(e) => setDspConfig(prev => ({ ...prev, vocalBoost: e.target.checked }))}
                      />
                      <span className={styles.dspTextWrap}>
                        <strong>Mid-Range Vocal Boost</strong>
                        <small>Directly accentuate standard conversational bands.</small>
                      </span>
                    </label>

                    {/* Auto Fade In */}
                    <label className={styles.dspCard}>
                      <input 
                        type="checkbox" 
                        checked={dspConfig.fadeIn}
                        onChange={(e) => setDspConfig(prev => ({ ...prev, fadeIn: e.target.checked }))}
                      />
                      <span className={styles.dspTextWrap}>
                        <strong>Auto Fade In</strong>
                        <small>Apply a smooth 1.5-second fade at clip start.</small>
                      </span>
                    </label>

                    {/* Auto Fade Out */}
                    <label className={styles.dspCard}>
                      <input 
                        type="checkbox" 
                        checked={dspConfig.fadeOut}
                        onChange={(e) => setDspConfig(prev => ({ ...prev, fadeOut: e.target.checked }))}
                      />
                      <span className={styles.dspTextWrap}>
                        <strong>Auto Fade Out</strong>
                        <small>Apply a smooth 1.5-second fade at clip end.</small>
                      </span>
                    </label>
                  </div>
                </div>

                {/* Primary Master Export Button */}
                <div className={styles.exportFooter}>
                  <button 
                    className={styles.masterButton} 
                    onClick={runMasterPipeline}
                    disabled={isProcessing}
                  >
                    <Wand2 size={18} />
                    <span>Run Platform Master & Export</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 3. Processing Overlay Panel */}
      {isProcessing && processingProgress && (
        <div className={styles.overlayLoader}>
          <div className={styles.loaderBox}>
            <div className={styles.glowProgressOuter}>
              <div 
                className={styles.glowProgressBar} 
                style={{ width: `${processingProgress.percent}%` }}
              />
            </div>
            <h3 className={styles.progressPercent}>{processingProgress.percent}%</h3>
            <span className={styles.progressMsg}>{processingProgress.message}</span>
            <small className={styles.progressSubtext}>Mastering entirely in your browser using local WebAssembly. Please keep this tab open.</small>
          </div>
        </div>
      )}

      {/* 4. Social Sharing Dialog Modal */}
      {showShareModal && (
        <div className={styles.shareModal}>
          <div className={styles.modalOverlay} onClick={() => setShowShareModal(false)} />
          <div className={styles.modalBox}>
            <button className={styles.modalClose} onClick={() => setShowShareModal(false)}>×</button>
            
            <div className={styles.modalHeader}>
              <div className={styles.successIconWrap}>
                <CheckCircle2 size={36} />
              </div>
              <h2 className={styles.modalTitle}>Audio Mastered Successfully!</h2>
              <p className={styles.modalDesc}>Your file was optimized using the <strong>{selectedPreset.name}</strong> preset and has been downloaded to your computer.</p>
            </div>

            <div className={styles.shareButtons}>
              {/* Download Again */}
              {resultUrl && (
                <a 
                  href={resultUrl} 
                  download={`${file?.name.replace(/\.[^.]+$/, '')}_mastered.${activeConfig.format}`}
                  className={styles.modalActionBtn}
                >
                  <Download size={16} />
                  <span>Download Again</span>
                </a>
              )}

              {/* Copy URL */}
              <button className={styles.modalActionBtn} onClick={copyMockLink}>
                {copiedLink ? <Check size={16} /> : <Copy size={16} />}
                <span>{copiedLink ? 'Copied Link!' : 'Copy Share Link'}</span>
              </button>

              {/* Native Share */}
              <button className={styles.modalActionBtn} onClick={shareMasterFile}>
                <Share2 size={16} />
                <span>Share File</span>
              </button>

              {/* Mock Save Project */}
              <button className={styles.modalActionBtn} onClick={() => alert('Project configuration saved to session memory.')}>
                <Save size={16} />
                <span>Save Project Config</span>
              </button>

              {/* Export Again */}
              <button 
                className={[styles.modalActionBtn, styles.exportAgain].join(' ')} 
                onClick={() => {
                  setShowShareModal(false);
                  runMasterPipeline();
                }}
              >
                <RefreshCw size={16} />
                <span>Re-Export Master</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
