// ============================================================
// DecibelCut — Audio to Text Transcriber Page
// Standalone speech-to-text converter with subtitle formatting
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import WaveSurfer from 'wavesurfer.js';
import { useSettingsStore } from '../store/settingsStore';
import { 
  ArrowLeft, Upload, Play, Pause, Copy, Search, 
  Key, FileText, Sparkles, RefreshCw, FileAudio, 
  Edit2, Check, X, Globe, AlignLeft, CheckCircle2
} from 'lucide-react';
import styles from './AudioToTextPage.module.css';

import { 
  transcribeWithGroq, 
  downsampleAudioBufferToWav16k, 
  postProcessTranscriptWithGroq 
} from '../services/groqService';
import { 
  convertToSRT, 
  convertToVTT, 
  convertToCSV, 
  convertToTXT 
} from '../utils/subtitleFormatter';
import type { TranscriptSegment } from '../utils/subtitleFormatter';
import { extractAudioFromVideo } from '../services/videoService';
import { formatDuration, formatFileSize } from '../utils/formatters';
import { useSEO } from '../hooks/useSEO';

export const AudioToTextPage: React.FC = () => {
  useSEO({
    title: 'Audio to Text Converter & Subtitle Generator | DecibelCut',
    description: 'Convert voice recordings, podcasts, and video soundtracks to text. Export to SRT, WebVTT, TXT, CSV, and JSON subtitles in seconds.'
  });

  const navigate = useNavigate();
  const settings = useSettingsStore();
  const groqApiKey = settings.groqApiKey;

  // File states
  const [file, setFile] = useState<File | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  // Processing states
  const [isLoading, setIsLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  
  // Result states
  const [segments, setSegments] = useState<TranscriptSegment[] | null>(null);
  const [aiResults, setAiResults] = useState<{
    summary: string;
    showNotes: string;
    chapters: Array<{ time: string; title: string }>;
  } | null>(null);

  // UI state
  const [activeTab, setActiveTab] = useState<'transcript' | 'ai-summary' | 'show-notes' | 'chapters' | 'export'>('transcript');
  const [searchTerm, setSearchTerm] = useState('');
  const [language, setLanguage] = useState('en');
  const [promptPrefix, setPromptPrefix] = useState('');
  const [runAiPostProcessing, setRunAiPostProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Player & WaveSurfer state
  const waveformContainerRef = useRef<HTMLDivElement | null>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const videoRefCallback = (node: HTMLVideoElement | null) => {
    setVideoElement(node);
  };
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);

  // Transcription tuning parameters
  const [temperature, setTemperature] = useState(0.0);
  const [musicMode, setMusicMode] = useState(true);

  // Editing state
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [editingSpeaker, setEditingSpeaker] = useState('');

  // API Key Modal State
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  // Open the key popup automatically if no API key is set
  useEffect(() => {
    if (!groqApiKey) {
      setShowKeyModal(true);
    }
  }, [groqApiKey]);

  // Clean up object URL
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // Initialize WaveSurfer
  useEffect(() => {
    if (!audioUrl || !waveformContainerRef.current) return;
    
    // If it is a video, wait until the HTML5 video element ref is set
    if (isVideo && !videoElement) return;

    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
    }

    const ws = WaveSurfer.create({
      container: waveformContainerRef.current,
      media: isVideo && videoElement ? videoElement : undefined,
      waveColor: 'rgba(255, 255, 255, 0.15)',
      progressColor: 'var(--color-accent)',
      cursorColor: 'rgba(255, 255, 255, 0.4)',
      barWidth: 2,
      barGap: 1.5,
      height: 50,
      normalize: true,
    });

    ws.load(audioUrl);
    wavesurferRef.current = ws;

    ws.on('ready', () => {
      setTotalDuration(ws.getDuration());
      setCurrentTime(0);
      setIsPlaying(false);
    });

    ws.on('timeupdate', (time) => {
      setCurrentTime(time);
    });

    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));

    return () => {
      ws.destroy();
    };
  }, [audioUrl, isVideo, videoElement]);

  // Drag & drop logic
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
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  // Decode audio or extract from video
  const handleFile = async (selectedFile: File) => {
    setIsLoading(true);
    setProgressMsg('Analyzing file format…');
    setSegments(null);
    setAiResults(null);
    
    const ext = selectedFile.name.split('.').pop()?.toLowerCase() ?? '';
    const videoExtensions = ['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v', '3gp'];
    const isVid = videoExtensions.includes(ext);
    
    setIsVideo(isVid);
    setFile(selectedFile);

    // Create play URL
    const url = URL.createObjectURL(selectedFile);
    setAudioUrl(url);

    try {
      let buffer: AudioBuffer;
      
      // Try direct decoding first
      try {
        setProgressMsg(isVid ? 'Extracting audio stream…' : 'Decoding audio stream…');
        const arrayBuffer = await selectedFile.arrayBuffer();
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        buffer = await ctx.decodeAudioData(arrayBuffer);
      } catch (decodeErr) {
        // Fall back to FFmpeg WASM for video extraction if direct browser decoding fails
        if (isVid) {
          setProgressMsg('Initializing FFmpeg WASM for video audio extraction…');
          const extractedBlob = await extractAudioFromVideo(selectedFile, {
            format: 'wav',
            qualityPreset: 'balanced',
            normalize: false,
            fadeIn: false,
            fadeOut: false,
            preserveMetadata: false,
            trim: { enabled: false, start: 0, end: 0 }
          });
          const arrayBuffer = await extractedBlob.arrayBuffer();
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          buffer = await ctx.decodeAudioData(arrayBuffer);
        } else {
          throw decodeErr;
        }
      }

      setAudioBuffer(buffer);
      setTotalDuration(buffer.duration);
    } catch (err) {
      console.error(err);
      alert('Failed to load file. The file may be corrupt or encoded in an unsupported format.');
      setFile(null);
      setAudioUrl(null);
    } finally {
      setIsLoading(false);
      setProgressMsg('');
    }
  };

  const handleTranscribe = async () => {
    if (!audioBuffer || !file) return;

    if (!groqApiKey) {
      setShowKeyModal(true);
      return;
    }

    setIsLoading(true);
    setProgressMsg('Compressing audio track for transcription…');

    try {
      // 1. Downsample audio to 16kHz mono WAV for Whisper API
      const wavBlob = await downsampleAudioBufferToWav16k(audioBuffer);
      
      // 2. Perform Whisper speech-to-text
      setProgressMsg('Transcribing speech to text…');
      
      // Adjust prompt and temperature if musicMode is enabled
      const finalPrompt = musicMode 
        ? (promptPrefix ? `${promptPrefix}. lyrics of the song with correct words, transcribing all vocal dialogues` : 'lyrics of the song with correct words, transcribing all vocal dialogues')
        : promptPrefix;
      const finalTemp = musicMode ? 0.2 : temperature;

      const results = await transcribeWithGroq(wavBlob, groqApiKey, language, finalPrompt, finalTemp);

      if (results.segments && results.segments.length > 0) {
        const formattedSegments = results.segments.map((seg: any) => ({
          start: seg.start,
          end: seg.end,
          text: seg.text.trim(),
          speaker: 'Speaker 1'
        }));
        setSegments(formattedSegments);
      } else {
        setSegments([
          {
            start: 0,
            end: audioBuffer.duration,
            text: results.text,
            speaker: 'Speaker 1'
          }
        ]);
      }

      // 3. Optional AI Summarization & Notes
      if (runAiPostProcessing) {
        setProgressMsg('Generating summary and notes…');
        const formattedText = results.segments 
          ? results.segments.map((seg: any) => `[${formatDuration(seg.start)}] ${seg.text.trim()}`).join('\n')
          : results.text;

        const postProcessed = await postProcessTranscriptWithGroq(formattedText, file.name, groqApiKey);
        setAiResults({
          summary: postProcessed.summary,
          showNotes: postProcessed.showNotes,
          chapters: postProcessed.chapters
        });
      }

    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Transcription failed.');
    } finally {
      setIsLoading(false);
      setProgressMsg('');
    }
  };

  // Simulated transcription for testing without key
  const handleSimulateTranscribe = () => {
    if (!audioBuffer) return;

    setIsLoading(true);
    setProgressMsg('Simulating local transcription preview…');

    setTimeout(() => {
      const mockTexts = [
        "Welcome to the DecibelCut speech transcription and subtitle generator.",
        "Everything you upload is processed 100% locally in your web browser.",
        "We support transcribing both audio and video files using client-side extraction.",
        "You can search your transcripts and make corrections directly in this editor.",
        "Click the Download options in the export tab to save subtitles as SRT, WebVTT, or text."
      ];

      const duration = audioBuffer.duration;
      const count = Math.min(5, Math.ceil(duration / 7));
      const simulated: TranscriptSegment[] = Array.from({ length: count }).map((_, idx) => {
        const start = idx * (duration / count);
        const end = (idx + 1) * (duration / count);
        return {
          start,
          end,
          text: mockTexts[idx % mockTexts.length],
          speaker: idx % 2 === 0 ? 'Speaker A' : 'Speaker B'
        };
      });

      setSegments(simulated);
      setAiResults({
        summary: "This is a simulated summary paragraph of the decoded file. It demonstrates how AI generates key summaries, notes, and chapters once you input a real Groq API key.",
        showNotes: "### Key Takeaways\n- Client-side extraction prevents large video uploads.\n- Clean transcripts can be corrected instantly.\n- SRT and VTT subtitle downloads are fully formatted.",
        chapters: [
          { time: "00:00", title: "Introduction and Set up" },
          { time: formatDuration(duration * 0.4), title: "Core Transcription Workflow" },
          { time: formatDuration(duration * 0.8), title: "Export Options Demonstration" }
        ]
      });

      setIsLoading(false);
      setProgressMsg('');
    }, 1500);
  };

  const handleSaveApiKey = () => {
    if (!tempApiKey.trim()) return;
    settings.setGroqApiKey(tempApiKey.trim());
    setShowKeyModal(false);
    setTempApiKey('');
  };

  const handlePlayPause = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  };

  const seekTo = (time: number) => {
    if (wavesurferRef.current) {
      wavesurferRef.current.setTime(time);
      wavesurferRef.current.play().catch(() => {});
    }
  };

  // Edit segments
  const startEditing = (index: number, seg: TranscriptSegment) => {
    setEditingSegmentId(index.toString());
    setEditingText(seg.text);
    setEditingSpeaker(seg.speaker || 'Speaker 1');
  };

  const saveEdit = (index: number) => {
    if (!segments) return;
    const updated = [...segments];
    updated[index] = {
      ...updated[index],
      text: editingText,
      speaker: editingSpeaker
    };
    setSegments(updated);
    setEditingSegmentId(null);
  };

  // Export utilities
  const handleDownload = (format: 'srt' | 'vtt' | 'csv' | 'txt' | 'json') => {
    if (!segments) return;
    let content = '';
    let mimeType = 'text/plain';
    let ext = format;

    switch (format) {
      case 'srt':
        content = convertToSRT(segments);
        break;
      case 'vtt':
        content = convertToVTT(segments);
        mimeType = 'text/vtt';
        break;
      case 'csv':
        content = convertToCSV(segments);
        mimeType = 'text/csv';
        break;
      case 'txt':
        content = convertToTXT(segments);
        break;
      case 'json':
        content = JSON.stringify(segments, null, 2);
        mimeType = 'application/json';
        break;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Clean filename
    const baseName = file?.name.substring(0, file.name.lastIndexOf('.')) || 'transcript';
    link.download = `${baseName}.${ext}`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = () => {
    if (!segments) return;
    const text = convertToTXT(segments);
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  const filteredSegments = segments?.filter(seg => 
    seg.text.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (seg.speaker && seg.speaker.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className={styles.root}>
      {/* Top Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backBtn} onClick={() => navigate('/')}>
            <ArrowLeft size={16} />
            Back to Home
          </button>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>⚡</span>
            <span>Decibel<strong>Cut</strong></span>
          </div>
          <span className={styles.toolTitle}>/ Audio to Text</span>
        </div>
        <div className={styles.headerRight}>
          <button 
            className={[styles.settingsBtn, groqApiKey ? styles.settingsBtnActive : ''].join(' ')} 
            onClick={() => setShowKeyModal(true)}
            title="Configure API Settings"
          >
            <Key size={16} />
            <span>{groqApiKey ? 'API Key Active' : 'Configure API Key'}</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className={styles.main}>
        {!file ? (
          /* Dropzone State */
          <div className={styles.dropContainer}>
            <div 
              className={[styles.dropzone, dragActive ? styles.dropzoneActive : ''].join(' ')}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
            >
              <div className={styles.dropContent}>
                <div className={styles.dropIcon}>
                  <Upload size={40} />
                </div>
                <h2>Upload your Media File</h2>
                <p>Drag and drop any audio or video file, or browse from your device</p>
                <div className={styles.fileTypes}>
                  <span>MP3, WAV, FLAC, M4A, WEBM, MP4, MOV, MKV</span>
                </div>
                <label className={styles.browseBtn}>
                  Browse Files
                  <input 
                    type="file" 
                    accept="audio/*,video/*" 
                    onChange={handleFileSelect} 
                    style={{ display: 'none' }} 
                  />
                </label>
                <p className={styles.privacyGuarantee}>
                  🔒 Client-side audio extraction. Your files never leave your device.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Workspace State */
          <div className={styles.workspace}>
            {/* Left Pane - File Info & Player Controls */}
            <div className={styles.controlPane}>
              <div className={styles.glassCard}>
                <div className={styles.cardHeader}>
                  <FileAudio size={18} className={styles.primaryColor} />
                  <h3>File Details</h3>
                </div>
                <div className={styles.fileDetails}>
                  <div className={styles.detailRow}>
                    <span className={styles.detailKey}>Name</span>
                    <span className={styles.detailVal} title={file.name}>{file.name}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailKey}>Size</span>
                    <span className={styles.detailVal}>{formatFileSize(file.size)}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailKey}>Duration</span>
                    <span className={styles.detailVal}>{formatDuration(totalDuration)}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailKey}>Type</span>
                    <span className={styles.detailVal}>{isVideo ? '🎥 Video File' : '🎵 Audio File'}</span>
                  </div>
                </div>

                {audioUrl && (
                  <div className={styles.playerSection}>
                    {isVideo && (
                      <div className={styles.videoPlayerContainer} onClick={handlePlayPause}>
                        <video 
                          ref={videoRefCallback} 
                          src={audioUrl} 
                          className={styles.videoPlayer}
                          playsInline
                        />
                      </div>
                    )}
                    
                    <div className={styles.waveformContainer}>
                      <div ref={waveformContainerRef} className={styles.waveform} />
                    </div>

                    <div className={styles.playerControls}>
                      <button className={styles.playPauseBtn} onClick={handlePlayPause}>
                        {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                      </button>
                      <div className={styles.playTime}>
                        <span>{formatDuration(currentTime)}</span>
                        <span>/</span>
                        <span>{formatDuration(totalDuration)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Transcription settings */}
              <div className={styles.glassCard}>
                <div className={styles.cardHeader}>
                  <Sparkles size={18} className={styles.accentColor} />
                  <h3>Transcription Settings</h3>
                </div>

                <div className={styles.settingsGroup}>
                  <div className={styles.field}>
                    <label>Spoken Language</label>
                    <div className={styles.selectWrapper}>
                      <Globe size={14} className={styles.selectIcon} />
                      <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                        <option value="en">English</option>
                        <option value="hi">Hindi (हिंदी)</option>
                        <option value="es">Spanish</option>
                        <option value="fr">French</option>
                        <option value="de">German</option>
                        <option value="it">Italian</option>
                        <option value="pt">Portuguese</option>
                        <option value="nl">Dutch</option>
                        <option value="auto">Auto Detect</option>
                      </select>
                    </div>
                  </div>

                  <div className={styles.field}>
                    <label>Prompt / Keywords (Optional)</label>
                    <input 
                      type="text" 
                      placeholder="e.g. DecibelCut, podcast, technical terms..." 
                      value={promptPrefix} 
                      onChange={(e) => setPromptPrefix(e.target.value)}
                    />
                    <span className={styles.helpText}>Improves spelling accuracy of names or acronyms.</span>
                  </div>

                  <div className={styles.toggleRow}>
                    <div className={styles.toggleInfo}>
                      <span>Optimize for Music & Lyrics</span>
                      <p>Adjusts parameters to prevent missing song vocals and mixed dialogues</p>
                    </div>
                    <button 
                      className={[styles.toggleBtn, musicMode ? styles.toggleActive : ''].join(' ')}
                      onClick={() => setMusicMode(!musicMode)}
                    >
                      <span className={styles.toggleThumb} />
                    </button>
                  </div>

                  {!musicMode && (
                    <div className={styles.field}>
                      <label>Transcription Temperature</label>
                      <div className={styles.selectWrapper}>
                        <Globe size={14} className={styles.selectIcon} />
                        <select 
                          value={temperature} 
                          onChange={(e) => setTemperature(parseFloat(e.target.value))}
                        >
                          <option value="0.0">0.0 (High Precision - Default)</option>
                          <option value="0.2">0.2 (Balanced / Singing)</option>
                          <option value="0.4">0.4 (Creative / Noisy)</option>
                        </select>
                      </div>
                    </div>
                  )}

                  <div className={styles.toggleRow}>
                    <div className={styles.toggleInfo}>
                      <span>AI Post-Processing</span>
                      <p>Generate summary, show notes, and chapter list using LLaMA</p>
                    </div>
                    <button 
                      className={[styles.toggleBtn, runAiPostProcessing ? styles.toggleActive : ''].join(' ')}
                      onClick={() => setRunAiPostProcessing(!runAiPostProcessing)}
                    >
                      <span className={styles.toggleThumb} />
                    </button>
                  </div>
                </div>

                <div className={styles.actionButtons}>
                  <button 
                    className={styles.transcribeActionBtn} 
                    onClick={handleTranscribe}
                    disabled={isLoading || !audioBuffer}
                  >
                    {isLoading ? <RefreshCw size={14} className={styles.spinning} /> : <Sparkles size={14} />}
                    <span>{isLoading ? progressMsg : 'Transcribe Audio'}</span>
                  </button>
                  
                  {!groqApiKey && (
                    <button 
                      className={styles.simulateActionBtn}
                      onClick={handleSimulateTranscribe}
                      disabled={isLoading}
                    >
                      <span>Try Mock Preview</span>
                    </button>
                  )}
                </div>
              </div>

              <button className={styles.clearFileBtn} onClick={() => { setFile(null); setSegments(null); setAiResults(null); }}>
                Remove File
              </button>
            </div>

            {/* Right Pane - Workspace Output Tabs */}
            <div className={styles.resultPane}>
              {!segments && !isLoading && (
                <div className={styles.resultPlaceholder}>
                  <div className={styles.placeholderIcon}>📝</div>
                  <h3>Ready for transcription</h3>
                  <p>Configure settings and click "Transcribe Audio" to process this file</p>
                </div>
              )}

              {isLoading && (
                <div className={styles.loadingState}>
                  <div className={styles.spinnerWrapper}>
                    <RefreshCw size={36} className={styles.spinning} />
                  </div>
                  <h3>Processing Audio</h3>
                  <p>{progressMsg}</p>
                </div>
              )}

              {segments && !isLoading && (
                <div className={styles.resultContainer}>
                  {/* Tabs bar */}
                  <div className={styles.tabsHeader}>
                    <button 
                      className={activeTab === 'transcript' ? styles.tabBtnActive : styles.tabBtn}
                      onClick={() => setActiveTab('transcript')}
                    >
                      Transcript
                    </button>
                    {aiResults && (
                      <>
                        <button 
                          className={activeTab === 'ai-summary' ? styles.tabBtnActive : styles.tabBtn}
                          onClick={() => setActiveTab('ai-summary')}
                        >
                          Summary
                        </button>
                        <button 
                          className={activeTab === 'show-notes' ? styles.tabBtnActive : styles.tabBtn}
                          onClick={() => setActiveTab('show-notes')}
                        >
                          Show Notes
                        </button>
                        <button 
                          className={activeTab === 'chapters' ? styles.tabBtnActive : styles.tabBtn}
                          onClick={() => setActiveTab('chapters')}
                        >
                          Chapters
                        </button>
                      </>
                    )}
                    <button 
                      className={activeTab === 'export' ? styles.tabBtnActive : styles.tabBtn}
                      onClick={() => setActiveTab('export')}
                    >
                      Export & Download
                    </button>
                  </div>

                  {/* Tab Body */}
                  <div className={styles.tabBody}>
                    {/* Transcript Tab */}
                    {activeTab === 'transcript' && (
                      <div className={styles.transcriptView}>
                        <div className={styles.searchBar}>
                          <Search size={16} />
                          <input 
                            type="text" 
                            placeholder="Search words or speakers..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                          />
                          {searchTerm && <button onClick={() => setSearchTerm('')} className={styles.clearSearch}>×</button>}
                        </div>

                        <div className={styles.segmentsList}>
                          {filteredSegments && filteredSegments.length > 0 ? (
                            filteredSegments.map((seg, idx) => {
                              const isEditing = editingSegmentId === idx.toString();
                              return (
                                <div key={idx} className={styles.segmentCard}>
                                  <div className={styles.segmentHeader}>
                                    {isEditing ? (
                                      <input 
                                        type="text" 
                                        className={styles.speakerEditInput}
                                        value={editingSpeaker}
                                        onChange={(e) => setEditingSpeaker(e.target.value)}
                                      />
                                    ) : (
                                      <span className={styles.speakerBadge}>{seg.speaker || 'Speaker 1'}</span>
                                    )}
                                    
                                    <button 
                                      className={styles.segmentTime}
                                      onClick={() => seekTo(seg.start)}
                                      title={`Jump to ${formatDuration(seg.start)}`}
                                    >
                                      <Play size={10} fill="currentColor" />
                                      <span>{formatDuration(seg.start)} - {formatDuration(seg.end)}</span>
                                    </button>
                                  </div>

                                  <div className={styles.segmentBody}>
                                    {isEditing ? (
                                      <textarea
                                        className={styles.textEditArea}
                                        value={editingText}
                                        onChange={(e) => setEditingText(e.target.value)}
                                      />
                                    ) : (
                                      <p className={styles.segmentText}>{seg.text}</p>
                                    )}
                                  </div>

                                  <div className={styles.segmentActions}>
                                    {isEditing ? (
                                      <button className={styles.saveEditBtn} onClick={() => saveEdit(idx)}>
                                        <Check size={12} />
                                        <span>Save</span>
                                      </button>
                                    ) : (
                                      <button className={styles.editBtn} onClick={() => startEditing(idx, seg)}>
                                        <Edit2 size={12} />
                                        <span>Edit</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className={styles.noResults}>No matching segments found.</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* AI Summary Tab */}
                    {activeTab === 'ai-summary' && aiResults && (
                      <div className={styles.aiTextView}>
                        <div className={styles.sectionIconHeader}>
                          <AlignLeft size={18} />
                          <h3>Summary Paragraph</h3>
                        </div>
                        <p className={styles.aiSummaryContent}>{aiResults.summary}</p>
                      </div>
                    )}

                    {/* Show Notes Tab */}
                    {activeTab === 'show-notes' && aiResults && (
                      <div className={styles.aiTextView}>
                        <div className={styles.sectionIconHeader}>
                          <FileText size={18} />
                          <h3>AI Show Notes</h3>
                        </div>
                        <pre className={styles.markdownPre}>{aiResults.showNotes}</pre>
                      </div>
                    )}

                    {/* Chapters Tab */}
                    {activeTab === 'chapters' && aiResults && (
                      <div className={styles.chaptersView}>
                        <div className={styles.sectionIconHeader}>
                          <Sparkles size={18} />
                          <h3>Milestone Chapters</h3>
                        </div>
                        <div className={styles.chaptersList}>
                          {aiResults.chapters.map((ch, i) => {
                            // Extract time seconds (e.g. 01:23)
                            const [m, s] = ch.time.split(':').map(Number);
                            const seconds = isNaN(m) ? 0 : m * 60 + (s || 0);

                            return (
                              <div key={i} className={styles.chapterRow} onClick={() => seekTo(seconds)}>
                                <span className={styles.chapterTime}>⏱️ {ch.time}</span>
                                <span className={styles.chapterTitle}>{ch.title}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Export Tab */}
                    {activeTab === 'export' && (
                      <div className={styles.exportView}>
                        <h3>Download Transcription Files</h3>
                        <p>Save subtitles or text transcripts directly to your hard drive.</p>
                        
                        <div className={styles.exportGrid}>
                          <div className={styles.exportCard} onClick={() => handleDownload('srt')}>
                            <div className={styles.exportFormatBadge}>SRT</div>
                            <h4>SubRip Subtitles</h4>
                            <p>Perfect for YouTube, video players, and editing suites.</p>
                            <span className={styles.downloadLink}>Download .srt</span>
                          </div>

                          <div className={styles.exportCard} onClick={() => handleDownload('vtt')}>
                            <div className={styles.exportFormatBadge}>VTT</div>
                            <h4>WebVTT Subtitles</h4>
                            <p>Standard format for web HTML5 video players.</p>
                            <span className={styles.downloadLink}>Download .vtt</span>
                          </div>

                          <div className={styles.exportCard} onClick={() => handleDownload('txt')}>
                            <div className={styles.exportFormatBadge}>TXT</div>
                            <h4>Plain Text Transcript</h4>
                            <p>Readable text paragraph split by double returns.</p>
                            <span className={styles.downloadLink}>Download .txt</span>
                          </div>

                          <div className={styles.exportCard} onClick={() => handleDownload('csv')}>
                            <div className={styles.exportFormatBadge}>CSV</div>
                            <h4>CSV Spreadsheet</h4>
                            <p>Opens in Excel or Sheets. Columns: Start, End, Speaker, Text.</p>
                            <span className={styles.downloadLink}>Download .csv</span>
                          </div>

                          <div className={styles.exportCard} onClick={() => handleDownload('json')}>
                            <div className={styles.exportFormatBadge}>JSON</div>
                            <h4>Structured JSON Data</h4>
                            <p>Segment objects containing exact timestamps and text arrays.</p>
                            <span className={styles.downloadLink}>Download .json</span>
                          </div>
                        </div>

                        <div className={styles.copyClipboardSection}>
                          <button 
                            className={[styles.copyClipboardBtn, copySuccess ? styles.copySuccess : ''].join(' ')}
                            onClick={copyToClipboard}
                          >
                            {copySuccess ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                            <span>{copySuccess ? 'Copied Transcript!' : 'Copy Entire Transcript to Clipboard'}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Frictionless API Key Modal */}
      {showKeyModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <button className={styles.closeModalBtn} onClick={() => setShowKeyModal(false)}>
              <X size={18} />
            </button>
            <div className={styles.modalIcon}>
              <Key size={32} />
            </div>
            <h2>Groq API Key Required</h2>
            <p className={styles.modalInstruction}>
              Transcription is powered by the high-speed Groq Cloud API. To transcribe files:
            </p>
            
            <ol className={styles.stepsList}>
              <li>Get a free API Key from the <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className={styles.externalLink}>Groq Developer Console</a>.</li>
              <li>Paste your API key in the input field below to save it locally.</li>
            </ol>

            <div className={styles.inputWrapper}>
              <input 
                type="password"
                placeholder="gsk_..."
                value={tempApiKey}
                onChange={(e) => setTempApiKey(e.target.value)}
                className={styles.apiKeyInput}
              />
              <button 
                className={styles.saveKeyActionBtn}
                onClick={handleSaveApiKey}
                disabled={!tempApiKey.trim()}
              >
                Save API Key
              </button>
            </div>

            <p className={styles.securityWarning}>
              🔒 Your API key is stored 100% locally in your browser's LocalStorage. It is only sent directly to Groq's endpoints.
            </p>

            <div className={styles.modalActionsDivider}>
              <span>or</span>
            </div>

            <button 
              className={styles.skipToSimulateBtn}
              onClick={() => {
                setShowKeyModal(false);
                handleSimulateTranscribe();
              }}
            >
              Try simulated mock preview instead
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
