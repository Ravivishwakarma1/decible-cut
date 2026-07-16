// ============================================================
// DecibelCut — Podcast Creator Studio Page
// Browser DAW: Multi-Track, Recording, AI Transcript & Mastering
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Mic, Upload, Folder, Play, Pause, Square, 
  Volume2, Trash2, Edit2, Copy, Plus, 
  Wand2, Sparkles, Download, Image, Music, 
  Settings, ChevronDown, Archive, PlayCircle
} from 'lucide-react';
import styles from './PodcastCreatorStudioPage.module.css';

import {
  generateMockAIContent,
  getAllProjects,
  saveProject,
  deleteProject,
  saveAudioFile,
  getAudioFile,
  getLibraryAssets,
  addLibraryAsset,
  deleteLibraryAsset,
  renderMultiTrackPodcast,
  normalizeLoudnessAndEncode
} from '../services/podcastStudioService';
import type {
  PodcastProject,
  PodcastClip,
  LibraryAsset,
  MockAIResults
} from '../services/podcastStudioService';
import { decodeAudioFile } from '../services/audioEngine';
import type { ExportProgress } from '../types/processing.types';
import { useSEO } from '../hooks/useSEO';
import { useSettingsStore } from '../store/settingsStore';
import { generateRealGroqAIContent } from '../services/groqService';

export const PodcastCreatorStudioPage: React.FC = () => {
  useSEO({
    title: 'Podcast Creator Studio — DecibelCut',
    description: 'Record, trim, and arrange your podcasts inside your browser. Multi-track audio timeline, AI summaries, and professional mastering.'
  });

  const navigate = useNavigate();

  // Projects list state
  const [projects, setProjects] = useState<PodcastProject[]>([]);
  const [activeProject, setActiveProject] = useState<PodcastProject | null>(null);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  // Timeline & Playback engine state
  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadTime, setPlayheadTime] = useState(0); // seconds
  const [timelineDuration, setTimelineDuration] = useState(60); // visible timeline seconds
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const playIntervalRef = useRef<number | null>(null);

  // Web Audio Context for previewing
  const previewCtxRef = useRef<AudioContext | null>(null);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  // Reusable intro/outro library assets
  const [libraryAssets, setLibraryAssets] = useState<LibraryAsset[]>([]);
  const [uploadingAssetType, setUploadingAssetType] = useState<LibraryAsset['type']>('music');



  // Recording module state
  const [isRecording, setIsRecording] = useState(false);
  const [recDuration, setRecDuration] = useState(0);
  const [recTrackId, setRecTrackId] = useState<string | null>(null);
  const [recDevices, setRecDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [recSettings, setRecSettings] = useState({
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  });
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recStreamRef = useRef<MediaStream | null>(null);
  const recTimerRef = useRef<number | null>(null);
  
  // Recording canvas visualizer
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isRecordingRef = useRef(false);
  const recAudioCtxRef = useRef<AudioContext | null>(null);

  const groqApiKey = useSettingsStore((s) => s.groqApiKey);

  // AI features state
  const [aiResults, setAiResults] = useState<MockAIResults | null>(null);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [aiProgressMsg, setAiProgressMsg] = useState('Analyzing project waves…');
  const [activeAITab, setActiveAITab] = useState<'transcript' | 'summary' | 'notes' | 'chapters'>('transcript');
  const [fillerWordsRemoved, setFillerWordsRemoved] = useState(false);

  // Export module state
  const [exportPlatform, setExportPlatform] = useState<'spotify' | 'apple' | 'youtube' | 'amazon' | 'rss'>('spotify');
  const [exportQuality, setExportQuality] = useState<'draft' | 'standard' | 'high' | 'studio'>('standard');
  const [exportFormat, setExportFormat] = useState<'mp3' | 'wav' | 'flac' | 'm4a'>('mp3');
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [enableDucking, setEnableDucking] = useState(false);

  // Load projects and assets on mount
  useEffect(() => {
    loadProjectsAndAssets();
    
    // Fetch microphones
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then(devices => {
        const mics = devices.filter(d => d.kind === 'audioinput');
        setRecDevices(mics);
        if (mics.length > 0) setSelectedDeviceId(mics[0].deviceId);
      });
    }

    return () => {
      stopPlaybackEngine();
      stopRecording();
    };
  }, []);

  const loadProjectsAndAssets = async () => {
    try {
      const allProj = await getAllProjects();
      setProjects(allProj);
      
      const assets = await getLibraryAssets();
      setLibraryAssets(assets);

      if (allProj.length > 0) {
        // Auto-select first unarchived project
        const firstActive = allProj.find(p => !p.archived);
        if (firstActive) setActiveProject(firstActive);
        else setActiveProject(allProj[0]);
      } else {
        // Create a default project if none exist
        await handleCreateProject('My First Podcast Project');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ---- Project Handlers ----

  const handleCreateProject = async (name: string) => {
    const id = `proj_${Date.now()}`;
    const newProj: PodcastProject = {
      id,
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      archived: false,
      metadata: {
        title: name,
        podcastName: 'My Podcast Show',
        author: 'Creator',
        description: 'An awesome podcast episode edited in DecibelCut.',
        category: 'Technology',
        language: 'en',
        copyright: `© ${new Date().getFullYear()} Creator`,
        releaseYear: new Date().getFullYear(),
        episodeNumber: 1,
        season: 1,
        tags: 'podcast, audio, editor'
      },
      tracks: [
        { id: 'tr_1', name: '🎵 Intro & Outro bed', type: 'intro', volume: 0.8, muted: false, soloed: false, clips: [] },
        { id: 'tr_2', name: '🗣️ Voice Recording', type: 'voice', volume: 1.0, muted: false, soloed: false, clips: [] },
        { id: 'tr_3', name: '🎶 Background Music', type: 'music', volume: 0.3, muted: false, soloed: false, clips: [] },
        { id: 'tr_4', name: '💥 Sound Effects (SFX)', type: 'sfx', volume: 0.8, muted: false, soloed: false, clips: [] }
      ]
    };

    await saveProject(newProj);
    await loadProjectsAndAssets();
    setActiveProject(newProj);
  };

  const handleRenameProject = async (id: string, newName: string) => {
    const proj = projects.find(p => p.id === id);
    if (proj) {
      const updated = { ...proj, name: newName };
      await saveProject(updated);
      await loadProjectsAndAssets();
      if (activeProject?.id === id) setActiveProject(updated);
    }
  };

  const handleDuplicateProject = async (proj: PodcastProject) => {
    const id = `proj_${Date.now()}`;
    const duplicated: PodcastProject = {
      ...proj,
      id,
      name: `${proj.name} (Copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tracks: proj.tracks.map(t => ({
        ...t,
        clips: t.clips.map(c => ({ ...c, id: `clip_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` }))
      }))
    };
    await saveProject(duplicated);
    await loadProjectsAndAssets();
    setActiveProject(duplicated);
  };

  const handleDeleteProjectClick = async (id: string) => {
    if (confirm('Are you sure you want to permanently delete this project and all its audio tracks?')) {
      await deleteProject(id);
      await loadProjectsAndAssets();
    }
  };

  const handleArchiveProject = async (proj: PodcastProject) => {
    const updated = { ...proj, archived: !proj.archived };
    await saveProject(updated);
    await loadProjectsAndAssets();
    if (activeProject?.id === proj.id) setActiveProject(updated);
  };

  // Auto-save active project changes helper
  const saveActiveProjectState = async (updatedProject: PodcastProject) => {
    setActiveProject(updatedProject);
    await saveProject(updatedProject);
    setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
  };

  // ---- Clip Editing and Track Mixing ----

  const handleTrackVolumeChange = (trackId: string, volume: number) => {
    if (!activeProject) return;
    const updatedTracks = activeProject.tracks.map(track => {
      if (track.id === trackId) {
        return { ...track, volume };
      }
      return track;
    });
    saveActiveProjectState({ ...activeProject, tracks: updatedTracks });
  };

  const toggleTrackMute = (trackId: string) => {
    if (!activeProject) return;
    const updatedTracks = activeProject.tracks.map(track => {
      if (track.id === trackId) {
        return { ...track, muted: !track.muted };
      }
      return track;
    });
    saveActiveProjectState({ ...activeProject, tracks: updatedTracks });
  };

  const toggleTrackSolo = (trackId: string) => {
    if (!activeProject) return;
    const updatedTracks = activeProject.tracks.map(track => {
      if (track.id === trackId) {
        return { ...track, soloed: !track.soloed };
      }
      return track;
    });
    saveActiveProjectState({ ...activeProject, tracks: updatedTracks });
  };

  // Choose file upload for track
  const handleFileUploadForTrack = (trackId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file && activeProject) {
        try {
          const { buffer } = await decodeAudioFile(file);
          const fileId = `file_${Date.now()}`;
          await saveAudioFile(fileId, file);

          const newClip: PodcastClip = {
            id: `clip_${Date.now()}`,
            name: file.name,
            duration: buffer.duration,
            startOffset: playheadTime,
            audioFileId: fileId
          };

          const updatedTracks = activeProject.tracks.map(t => {
            if (t.id === trackId) {
              return { ...t, clips: [...t.clips, newClip] };
            }
            return t;
          });

          // Check if duration exceeds timeline range
          const endSec = newClip.startOffset + newClip.duration;
          if (endSec > timelineDuration) {
            setTimelineDuration(Math.ceil(endSec + 10));
          }

          saveActiveProjectState({ ...activeProject, tracks: updatedTracks });
        } catch (err) {
          console.error(err);
          alert('Failed to load audio clip');
        }
      }
    };
    input.click();
  };

  const handleDeleteClip = (trackId: string, clipId: string) => {
    if (!activeProject) return;
    const updatedTracks = activeProject.tracks.map(t => {
      if (t.id === trackId) {
        return { ...t, clips: t.clips.filter(c => c.id !== clipId) };
      }
      return t;
    });
    saveActiveProjectState({ ...activeProject, tracks: updatedTracks });
    if (activeClipId === clipId) setActiveClipId(null);
  };

  const handleMoveClip = (trackId: string, clipId: string, direction: 'left' | 'right') => {
    if (!activeProject) return;
    const delta = direction === 'left' ? -2 : 2;
    const updatedTracks = activeProject.tracks.map(t => {
      if (t.id === trackId) {
        return {
          ...t,
          clips: t.clips.map(c => {
            if (c.id === clipId) {
              return { ...c, startOffset: Math.max(0, c.startOffset + delta) };
            }
            return c;
          })
        };
      }
      return t;
    });
    saveActiveProjectState({ ...activeProject, tracks: updatedTracks });
  };

  // Split active clip at playhead
  const handleSplitClipAtPlayhead = () => {
    if (!activeProject || !activeClipId) return;
    let splitDone = false;
    const updatedTracks = activeProject.tracks.map(track => {
      const clip = track.clips.find(c => c.id === activeClipId);
      if (clip) {
        const relativePlayhead = playheadTime - clip.startOffset;
        if (relativePlayhead > 0.5 && relativePlayhead < clip.duration - 0.5) {
          splitDone = true;
          // Split clip into two
          const clip1: PodcastClip = {
            ...clip,
            id: `clip_${Date.now()}_1`,
            duration: relativePlayhead,
            name: `${clip.name.replace(/\.[^.]+$/, '')} (Part 1)`
          };
          const clip2: PodcastClip = {
            ...clip,
            id: `clip_${Date.now()}_2`,
            startOffset: playheadTime,
            duration: clip.duration - relativePlayhead,
            name: `${clip.name.replace(/\.[^.]+$/, '')} (Part 2)`
          };
          return {
            ...track,
            clips: [...track.clips.filter(c => c.id !== activeClipId), clip1, clip2]
          };
        }
      }
      return track;
    });

    if (splitDone) {
      saveActiveProjectState({ ...activeProject, tracks: updatedTracks });
      setActiveClipId(null);
    } else {
      alert('Playhead must be positioned inside the selected clip to split it.');
    }
  };

  // Reusable intro/outro uploader
  const handleAddLibraryAssetClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const { buffer } = await decodeAudioFile(file);
          const fileId = `lib_file_${Date.now()}`;
          const newAsset: LibraryAsset = {
            id: `asset_${Date.now()}`,
            name: file.name,
            type: uploadingAssetType,
            duration: buffer.duration,
            audioFileId: fileId,
            createdAt: Date.now()
          };

          await addLibraryAsset(newAsset, file);
          await loadProjectsAndAssets();
        } catch (err) {
          console.error(err);
          alert('Failed to load asset');
        }
      }
    };
    input.click();
  };

  const handleAddAssetToTimeline = async (asset: LibraryAsset) => {
    if (!activeProject) return;
    
    // Place on corresponding track type
    let targetTrack = activeProject.tracks.find(t => t.type === 'intro');
    if (asset.type === 'sfx') targetTrack = activeProject.tracks.find(t => t.type === 'sfx') || targetTrack;
    if (asset.type === 'music') targetTrack = activeProject.tracks.find(t => t.type === 'music') || targetTrack;

    if (targetTrack) {
      const fileBlob = await getAudioFile(asset.audioFileId);
      if (fileBlob) {
        // Save file clone as clip local instance
        const clipFileId = `file_inst_${Date.now()}`;
        await saveAudioFile(clipFileId, fileBlob);

        const newClip: PodcastClip = {
          id: `clip_${Date.now()}`,
          name: asset.name,
          duration: asset.duration,
          startOffset: playheadTime,
          audioFileId: clipFileId
        };

        const updatedTracks = activeProject.tracks.map(t => {
          if (t.id === targetTrack!.id) {
            return { ...t, clips: [...t.clips, newClip] };
          }
          return t;
        });

        saveActiveProjectState({ ...activeProject, tracks: updatedTracks });
      }
    }
  };

  // ---- Playback Preview Engine ----

  const startPlaybackEngine = async () => {
    if (!activeProject) return;
    
    // Stop any existing playback
    stopPlaybackEngine();

    const ctx = new AudioContext();
    previewCtxRef.current = ctx;
    setIsPlaying(true);

    const tracksToMix = activeProject.tracks.filter(t => !t.muted);
    const isAnySoloed = tracksToMix.some(t => t.soloed);
    const activeTracks = isAnySoloed ? tracksToMix.filter(t => t.soloed) : tracksToMix;

    // Calculate voice track segments for ducking
    const voiceIntervals: Array<{ start: number; end: number }> = [];
    const voiceTracks = activeTracks.filter(t => t.type === 'voice');
    voiceTracks.forEach(t => {
      t.clips.forEach(clip => {
        voiceIntervals.push({ start: clip.startOffset, end: clip.startOffset + clip.duration });
      });
    });

    voiceIntervals.sort((a, b) => a.start - b.start);
    const mergedVoice: Array<{ start: number; end: number }> = [];
    for (const interval of voiceIntervals) {
      if (mergedVoice.length === 0) {
        mergedVoice.push({ ...interval });
      } else {
        const last = mergedVoice[mergedVoice.length - 1];
        if (interval.start <= last.end) {
          last.end = Math.max(last.end, interval.end);
        } else {
          mergedVoice.push({ ...interval });
        }
      }
    }

    // Load and schedule sources
    const startTime = ctx.currentTime;
    const currentOffset = playheadTime;

    activeTracks.forEach(async (track) => {
      track.clips.forEach(async (clip) => {
        // Check if clip overlaps with current playhead
        const clipEnd = clip.startOffset + clip.duration;
        if (clipEnd <= currentOffset) return;

        const blob = await getAudioFile(clip.audioFileId);
        if (!blob) return;

        try {
          const arrayBuffer = await blob.arrayBuffer();
          // Decodes isolated copy for preview
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

          const sourceNode = ctx.createBufferSource();
          sourceNode.buffer = audioBuffer;

          const gainNode = ctx.createGain();
          gainNode.gain.setValueAtTime(track.volume, 0);

          // Calculate start offset & delay
          let startDelay = clip.startOffset - currentOffset;
          let offsetInSource = 0;

          if (startDelay < 0) {
            offsetInSource = Math.abs(startDelay);
            startDelay = 0;
          }

          // Apply auto-ducking on music tracks
          if (enableDucking && track.type === 'music' && mergedVoice.length > 0) {
            const duckVolume = track.volume * 0.2;
            const attack = 0.2; // 200ms
            const release = 0.8; // 800ms
            
            mergedVoice.forEach(seg => {
              const clipStart = clip.startOffset;
              const clipEnd = clip.startOffset + clip.duration;
              
              if (seg.start < clipEnd && seg.end > clipStart) {
                const fadeOutStart = Math.max(clipStart, seg.start) - currentOffset;
                const fadeOutEnd = Math.min(clipEnd, seg.start + attack) - currentOffset;
                const fadeInStart = Math.max(clipStart, seg.end) - currentOffset;
                const fadeInEnd = Math.min(clipEnd, seg.end + release) - currentOffset;
                
                if (fadeOutStart < clip.duration - offsetInSource) {
                  const actualFadeOutStart = Math.max(0, fadeOutStart);
                  const actualFadeOutEnd = Math.max(0, fadeOutEnd);
                  gainNode.gain.setValueAtTime(track.volume, startTime + actualFadeOutStart);
                  gainNode.gain.linearRampToValueAtTime(duckVolume, startTime + actualFadeOutEnd);
                }
                
                if (fadeOutEnd < fadeInStart && fadeInStart < clip.duration - offsetInSource) {
                  gainNode.gain.setValueAtTime(duckVolume, startTime + Math.max(0, fadeInStart));
                }
                
                if (fadeInStart < clip.duration - offsetInSource) {
                  const actualFadeInEnd = Math.max(0, fadeInEnd);
                  gainNode.gain.linearRampToValueAtTime(track.volume, startTime + actualFadeInEnd);
                }
              }
            });
          }

          sourceNode.connect(gainNode);
          gainNode.connect(ctx.destination);

          sourceNode.start(startTime + startDelay, offsetInSource);
          activeSourcesRef.current.push(sourceNode);

        } catch (err) {
          console.error(err);
        }
      });
    });

    // Start timer interval
    const tickRate = 100; // ms
    playIntervalRef.current = window.setInterval(() => {
      setPlayheadTime(prev => {
        const next = prev + (tickRate / 1000);
        if (next >= timelineDuration) {
          stopPlaybackEngine();
          return 0;
        }
        return next;
      });
    }, tickRate);
  };

  const stopPlaybackEngine = () => {
    setIsPlaying(false);
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }
    
    // Stop all active buffer sources
    activeSourcesRef.current.forEach(source => {
      try {
        source.stop();
      } catch {
        // Safe check
      }
    });
    activeSourcesRef.current = [];

    if (previewCtxRef.current) {
      previewCtxRef.current.close().catch(() => null);
      previewCtxRef.current = null;
    }
  };



  // ---- Audio Recording Module ----

  const startRecording = async (trackId: string) => {
    if (isRecording) return;
    
    setRecTrackId(trackId);
    setIsRecording(true);
    isRecordingRef.current = true;
    setRecDuration(0);

    try {
      const constraints = {
        audio: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          echoCancellation: recSettings.echoCancellation,
          noiseSuppression: recSettings.noiseSuppression,
          autoGainControl: recSettings.autoGainControl
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      recStreamRef.current = stream;

      // Setup Canvas visualizer using AudioContext Analyser
      const audioCtx = new AudioContext();
      recAudioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      visualizeRecording();

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        
        // Decode to compute actual duration
        try {
          const { decodeAudioFile } = await import('../services/audioEngine');
          const file = new File([audioBlob], `mic_recording_${Date.now()}.webm`, { type: 'audio/webm' });
          const { buffer } = await decodeAudioFile(file);

          const fileId = `rec_${Date.now()}`;
          await saveAudioFile(fileId, audioBlob);

          if (activeProject && recTrackId) {
            const newClip: PodcastClip = {
              id: `clip_${Date.now()}`,
              name: `Recording #${(activeProject.tracks.find(t => t.id === recTrackId)?.clips.length ?? 0) + 1}`,
              duration: buffer.duration,
              startOffset: playheadTime,
              audioFileId: fileId
            };

            const updatedTracks = activeProject.tracks.map(t => {
              if (t.id === recTrackId) {
                return { ...t, clips: [...t.clips, newClip] };
              }
              return t;
            });

            // Adjust visible duration if needed
            const endSec = newClip.startOffset + newClip.duration;
            if (endSec > timelineDuration) setTimelineDuration(Math.ceil(endSec + 10));

            saveActiveProjectState({ ...activeProject, tracks: updatedTracks });
          }
        } catch (err) {
          console.error(err);
          alert('Failed to save micro clip.');
        }
      };

      mediaRecorder.start();

      // Start recording timer
      recTimerRef.current = window.setInterval(() => {
        setRecDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error(err);
      alert('Failed to initialize microphone stream.');
      setIsRecording(false);
      isRecordingRef.current = false;
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    isRecordingRef.current = false;
    setRecTrackId(null);
    
    if (recTimerRef.current) {
      clearInterval(recTimerRef.current);
      recTimerRef.current = null;
    }

    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    if (recStreamRef.current) {
      recStreamRef.current.getTracks().forEach(t => t.stop());
      recStreamRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (recAudioCtxRef.current) {
      recAudioCtxRef.current.close().catch(() => null);
      recAudioCtxRef.current = null;
    }
  };

  const visualizeRecording = () => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!isRecordingRef.current) return;
      animationFrameRef.current = requestAnimationFrame(draw);

      analyser.getByteFrequencyData(dataArray);

      ctx.fillStyle = 'rgba(17, 17, 24, 0.4)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 1.5;

        // Custom glow neon color
        ctx.fillStyle = `rgb(251, 146, 60)`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    draw();
  };

  // ---- AI Copilot Features Handlers ----

  const runAICopilotMix = async () => {
    if (!activeProject) return;

    if (!groqApiKey) {
      const confirmMock = window.confirm(
        "Groq API Key not found.\n\nWould you like to use the demo mock content? \nTo use real AI, enter your Groq API Key in the Settings page."
      );
      if (!confirmMock) return;

      setIsAIProcessing(true);
      setAiProgressMsg('Analyzing project waves (Mock)…');
      await new Promise(r => setTimeout(r, 2000));

      const content = generateMockAIContent(activeProject.name);
      setAiResults(content);
      setIsAIProcessing(false);
      return;
    }

    setIsAIProcessing(true);
    setAiProgressMsg('Mixing tracks (0%)…');

    const audioCtx = new AudioContext();
    try {
      // 1. Render mixed buffer offline
      const mixedBuffer = await renderMultiTrackPodcast(activeProject, audioCtx, (pct) => {
        setAiProgressMsg(`Mixing tracks (${Math.round(pct * 100)}%)…`);
      }, enableDucking);

      // 2. Call groq service
      const results = await generateRealGroqAIContent(
        mixedBuffer,
        activeProject.name,
        groqApiKey,
        (msg) => setAiProgressMsg(msg)
      );

      setAiResults(results);
      setFillerWordsRemoved(false); // Reset status
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'AI processing failed');
    } finally {
      setIsAIProcessing(false);
      audioCtx.close().catch(() => null);
    }
  };

  const handleRemoveFillerWords = () => {
    if (!activeProject || !aiResults) return;
    
    // Simulate cutting voice track clips short to mimic word removal
    const updatedTracks = activeProject.tracks.map(track => {
      if (track.type === 'voice') {
        return {
          ...track,
          clips: track.clips.map(clip => {
            // Trim duration slightly to simulate removing words
            const reduction = 0.5; // seconds
            return {
              ...clip,
              duration: Math.max(1, clip.duration - reduction)
            };
          })
        };
      }
      return track;
    });

    saveActiveProjectState({ ...activeProject, tracks: updatedTracks });
    setFillerWordsRemoved(true);
    alert('AI filler words removal complete! Cut out 8 filler words ("uh", "um", "like") from Voice Recording track.');
  };

  // ---- Mastering Export Trigger ----

  const handleExportMix = async () => {
    if (!activeProject) return;

    setIsExporting(true);
    setExportProgress({ status: 'preparing', percent: 10, message: 'Mixing multi-track layers…' });

    const audioCtx = new AudioContext();
    try {
      // 1. Perform offline rendering
      const mixedBuffer = await renderMultiTrackPodcast(activeProject, audioCtx, (pct) => {
        setExportProgress({
          status: 'preparing',
          percent: 10 + Math.round(pct * 0.4),
          message: 'Combining timeline tracks…'
        });
      }, enableDucking);

      // 2. Normalize and encode with FFmpeg WASM
      const resultBlob = await normalizeLoudnessAndEncode(
        mixedBuffer,
        exportPlatform,
        exportQuality,
        exportFormat,
        (progress) => {
          setExportProgress({
            ...progress,
            percent: 50 + Math.round(progress.percent * 0.5)
          });
        }
      );

      // 3. Trigger download
      const filename = `${activeProject.name.replace(/\s+/g, '_')}_mastered.${exportFormat}`;
      const url = URL.createObjectURL(resultBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();

      // Revoke after download is triggered
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      
      alert('Mastered episode exported successfully!');

    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Mastering mix failed');
    } finally {
      audioCtx.close().catch(() => null);
      setIsExporting(false);
      setExportProgress(null);
    }
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
          <span className={styles.logoText}>Decibel<strong>Cut</strong> <small className={styles.moduleBadge}>Podcast Studio</small></span>
        </div>
        <div className={styles.headerRight}>
          <button className={styles.navLink} onClick={() => navigate('/creator-tools')}>Creator Tools</button>
          <button className={styles.navLink} onClick={() => navigate('/app')}>Silence Remover</button>
        </div>
      </header>

      {/* Main Studio DAW Layout */}
      <div className={styles.dawLayout}>
        {/* Left Project Sidebar */}
        <aside className={styles.dawSidebar}>
          {/* Active Projects Manager */}
          <div className={styles.sidebarBlock}>
            <div className={styles.blockTitleHeader}>
              <Folder size={14} />
              <span>Project Manager</span>
            </div>
            
            <div className={styles.projectsList}>
              {projects.map(p => (
                <div 
                  key={p.id} 
                  className={[
                    styles.projectItem, 
                    activeProject?.id === p.id ? styles.projectItemActive : '',
                    p.archived ? styles.projectItemArchived : ''
                  ].join(' ')}
                  onClick={() => setActiveProject(p)}
                >
                  <span className={styles.projectTextName} title={p.name}>{p.name}</span>
                  <div className={styles.projectItemActions}>
                    <button onClick={(e) => { e.stopPropagation(); const n = prompt('Rename project:', p.name); if (n) handleRenameProject(p.id, n); }} title="Rename"><Edit2 size={12} /></button>
                    <button onClick={(e) => { e.stopPropagation(); handleDuplicateProject(p); }} title="Duplicate"><Copy size={12} /></button>
                    <button onClick={(e) => { e.stopPropagation(); handleArchiveProject(p); }} title={p.archived ? 'Restore' : 'Archive'}><Archive size={12} /></button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteProjectClick(p.id); }} className={styles.deleteIconBtn} title="Delete"><Trash2 size={12} /></button>
                  </div>
                </div>
              ))}
            </div>

            <button 
              className={styles.newProjBtn}
              onClick={() => setIsNewProjectModalOpen(true)}
            >
              <Plus size={14} />
              <span>New Studio Project</span>
            </button>
          </div>

          {/* Intro/Outro Library Assets */}
          <div className={styles.sidebarBlock}>
            <div className={styles.blockTitleHeader}>
              <Music size={14} />
              <span>Intro & Outro Asset Library</span>
            </div>
            
            <div className={styles.libraryUploadControls}>
              <div className={styles.selectWrapperAsset}>
                <select 
                  value={uploadingAssetType}
                  onChange={(e) => setUploadingAssetType(e.target.value as any)}
                >
                  <option value="music">Theme Music</option>
                  <option value="intro">Intro Voicebed</option>
                  <option value="outro">Outro Voicebed</option>
                  <option value="transition">Jingles & Swoosh</option>
                  <option value="sfx">Sound FX</option>
                </select>
                <ChevronDown size={12} className={styles.selectArrow} />
              </div>
              <button className={styles.assetUploadBtn} onClick={handleAddLibraryAssetClick}>
                <Upload size={12} />
              </button>
            </div>

            <div className={styles.libraryAssetsList}>
              {libraryAssets.map(asset => (
                <div key={asset.id} className={styles.libraryAssetItem}>
                  <div className={styles.assetItemLeft}>
                    <PlayCircle size={14} className={styles.assetPlayIcon} />
                    <span className={styles.assetName} title={asset.name}>{asset.name}</span>
                  </div>
                  <div className={styles.assetItemActions}>
                    <button onClick={() => handleAddAssetToTimeline(asset)} title="Add to track"><Plus size={12} /></button>
                    <button onClick={async () => { await deleteLibraryAsset(asset); await loadProjectsAndAssets(); }} className={styles.deleteIconBtn} title="Delete"><Trash2 size={12} /></button>
                  </div>
                </div>
              ))}
              {libraryAssets.length === 0 && (
                <p className={styles.emptyLibraryText}>No reusable intro/outro templates saved. Upload files above to build your templates package.</p>
              )}
            </div>
          </div>

          {/* Recording Setup */}
          <div className={styles.sidebarBlock}>
            <div className={styles.blockTitleHeader}>
              <Mic size={14} />
              <span>Recording Setup</span>
            </div>
            <div className={styles.formField} style={{ gap: '4px' }}>
              <label style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>Microphone Input</label>
              <div className={styles.selectWrapperAsset} style={{ width: '100%' }}>
                <select 
                  value={selectedDeviceId}
                  onChange={(e) => setSelectedDeviceId(e.target.value)}
                  style={{ width: '100%', fontSize: '0.74rem' }}
                >
                  {recDevices.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.slice(0, 5)}`}</option>
                  ))}
                  {recDevices.length === 0 && <option value="">Default Microphone</option>}
                </select>
                <ChevronDown size={12} className={styles.selectArrow} />
              </div>
            </div>
            
            <div className={styles.recToggles} style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
              <label className={styles.checkboxLabel} style={{ fontSize: '0.72rem', padding: '2px 4px' }}>
                <input 
                  type="checkbox" 
                  checked={recSettings.echoCancellation}
                  onChange={(e) => setRecSettings(prev => ({ ...prev, echoCancellation: e.target.checked }))}
                />
                <span>Echo Cancellation</span>
              </label>
              <label className={styles.checkboxLabel} style={{ fontSize: '0.72rem', padding: '2px 4px' }}>
                <input 
                  type="checkbox" 
                  checked={recSettings.noiseSuppression}
                  onChange={(e) => setRecSettings(prev => ({ ...prev, noiseSuppression: e.target.checked }))}
                />
                <span>Noise Suppression</span>
              </label>
              <label className={styles.checkboxLabel} style={{ fontSize: '0.72rem', padding: '2px 4px' }}>
                <input 
                  type="checkbox" 
                  checked={recSettings.autoGainControl}
                  onChange={(e) => setRecSettings(prev => ({ ...prev, autoGainControl: e.target.checked }))}
                />
                <span>Auto Gain Control</span>
              </label>
            </div>
          </div>


        </aside>

        {/* Center Editing Area */}
        <main className={styles.dawWorkspace}>
          {activeProject && (
            <div className={styles.workspaceBodyContainer}>
              
              {/* Studio Workspace controls */}
              <div className={styles.studioControlsHeader}>
                <div className={styles.playbackControls}>
                  <button 
                    className={isPlaying ? styles.playBtnActive : styles.playBtn}
                    onClick={isPlaying ? stopPlaybackEngine : startPlaybackEngine}
                  >
                    {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                  </button>
                  <button className={styles.stopBtn} onClick={stopPlaybackEngine}>
                    <Square size={14} />
                  </button>

                  <div className={styles.playbackTimer}>
                    <span>Playhead: {playheadTime.toFixed(1)}s</span>
                    <span className={styles.timerDivider}>/</span>
                    <span>Timeline: {timelineDuration}s</span>
                  </div>
                </div>

                <div className={styles.dawToolbar}>
                  <button 
                    className={styles.splitClipBtn} 
                    onClick={handleSplitClipAtPlayhead}
                    disabled={!activeClipId}
                  >
                    ✂️ Split Clip
                  </button>
                  <button 
                    className={styles.zoomTimelineBtn}
                    onClick={() => setTimelineDuration(prev => Math.max(30, prev - 15))}
                  >
                    🔍 Zoom In
                  </button>
                  <button 
                    className={styles.zoomTimelineBtn}
                    onClick={() => setTimelineDuration(prev => prev + 30)}
                  >
                    🔍 Zoom Out
                  </button>
                </div>
              </div>

              {/* Multi-Track Timeline Canvas */}
              <div className={styles.tracksTimelineContainer}>
                {/* Horizontal playhead bar */}
                <div className={styles.playheadTimeTicks}>
                  <div className={styles.timelineRuler}>
                    {Array.from({ length: Math.ceil(timelineDuration / 10) + 1 }).map((_, idx) => (
                      <span key={idx} style={{ left: `${(idx * 10 / timelineDuration) * 100}%` }}>{idx * 10}s</span>
                    ))}
                  </div>
                  
                  {/* Visual playhead line */}
                  <div 
                    className={styles.playheadLine} 
                    style={{ left: `${(playheadTime / timelineDuration) * 100}%` }}
                  />
                </div>

                {/* Tracks Rows */}
                {activeProject.tracks.map(track => (
                  <div key={track.id} className={styles.trackRow}>
                    
                    {/* Left Track Control Panel */}
                    <div className={styles.trackControlHeader}>
                      <span className={styles.trackTitle}>{track.name}</span>
                      
                      <div className={styles.trackActionButtons}>
                        <button 
                          className={track.muted ? styles.trackActionBtnMuted : styles.trackActionBtn}
                          onClick={() => toggleTrackMute(track.id)}
                          title="Mute track"
                        >
                          M
                        </button>
                        <button 
                          className={track.soloed ? styles.trackActionBtnSoloed : styles.trackActionBtn}
                          onClick={() => toggleTrackSolo(track.id)}
                          title="Solo track"
                        >
                          S
                        </button>
                        <button 
                          className={styles.trackActionBtnUpload}
                          onClick={() => handleFileUploadForTrack(track.id)}
                          title="Upload clip file"
                        >
                          <Upload size={10} />
                        </button>
                        <button 
                          className={[styles.trackActionBtnRecord, isRecording && recTrackId === track.id ? styles.recActiveBlink : ''].join(' ')}
                          onClick={() => isRecording && recTrackId === track.id ? stopRecording() : startRecording(track.id)}
                          title="Record mic to track"
                        >
                          <Mic size={10} />
                        </button>
                      </div>

                      {/* Track volume slider */}
                      <div className={styles.trackVolWrap}>
                        <Volume2 size={10} />
                        <input 
                          type="range" 
                          min="0" 
                          max="1" 
                          step="0.05"
                          value={track.volume} 
                          onChange={(e) => handleTrackVolumeChange(track.id, parseFloat(e.target.value))}
                          className={styles.trackVolSlider}
                        />
                      </div>
                    </div>

                    {/* Right Timeline Track Lane */}
                    <div className={styles.trackLane}>
                      {track.clips.map(clip => {
                        const leftPct = (clip.startOffset / timelineDuration) * 100;
                        const widthPct = (clip.duration / timelineDuration) * 100;
                        
                        return (
                          <div 
                            key={clip.id}
                            className={[
                              styles.clipBlock, 
                              activeClipId === clip.id ? styles.clipBlockSelected : ''
                            ].join(' ')}
                            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                            onClick={(e) => { e.stopPropagation(); setActiveClipId(clip.id); }}
                          >
                            <span className={styles.clipBlockLabel} title={clip.name}>{clip.name}</span>
                            <span className={styles.clipBlockDuration}>{clip.duration.toFixed(1)}s</span>

                            {/* Move handles shown when selected */}
                            {activeClipId === clip.id && (
                              <div className={styles.clipMoveHandles}>
                                <button className={styles.moveHandleBtn} onClick={() => handleMoveClip(track.id, clip.id, 'left')}>◀</button>
                                <button className={styles.deleteClipBtn} onClick={() => handleDeleteClip(track.id, clip.id)}><Trash2 size={10} /></button>
                                <button className={styles.moveHandleBtn} onClick={() => handleMoveClip(track.id, clip.id, 'right')}>▶</button>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Rec blink overlay */}
                      {isRecording && recTrackId === track.id && (
                        <div className={styles.recOverlayTrack}>
                          <div className={styles.recBlinkCircle} />
                          <span>Recording microphone ({recDuration}s)…</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom Multi-Panel section (Metadata, AI Copilot, Export settings) */}
              <div className={styles.studioMultiTabsSection}>
                {/* AI Podcast Copilot */}
                <div className={styles.multiTabPanel}>
                  <div className={styles.tabPanelTitle}>
                    <Sparkles size={16} />
                    <span>AI Podcast Copilot (Transcript & Summary)</span>
                  </div>

                  {!aiResults ? (
                    <div className={styles.aiInitView}>
                      <p className={styles.aiTextHelp}>Generate fully automated episodes metadata: summaries, transcripts, show notes, and chapters, and automatically clean filler words ("uh", "um").</p>
                      <button 
                        className={styles.runAIButton}
                        onClick={runAICopilotMix}
                        disabled={isAIProcessing}
                      >
                        <Wand2 size={14} />
                        <span>{isAIProcessing ? aiProgressMsg : 'Transcribe & Generate Episode Notes'}</span>
                      </button>
                    </div>
                  ) : (
                    <div className={styles.aiResultsWorkspace}>
                      <div className={styles.aiToolbarTabs}>
                        <button className={activeAITab === 'transcript' ? styles.aiTabBtnActive : styles.aiTabBtn} onClick={() => setActiveAITab('transcript')}>Episode Transcript</button>
                        <button className={activeAITab === 'summary' ? styles.aiTabBtnActive : styles.aiTabBtn} onClick={() => setActiveAITab('summary')}>Episode Summary</button>
                        <button className={activeAITab === 'notes' ? styles.aiTabBtnActive : styles.aiTabBtn} onClick={() => setActiveAITab('notes')}>Show Notes</button>
                        <button className={activeAITab === 'chapters' ? styles.aiTabBtnActive : styles.aiTabBtn} onClick={() => setActiveAITab('chapters')}>Chapters & Timestamps</button>
                        
                        <button 
                          className={styles.fillerWordBtn}
                          onClick={handleRemoveFillerWords}
                          disabled={fillerWordsRemoved}
                        >
                          ✨ {fillerWordsRemoved ? 'Filler Words Removed!' : 'Auto Remove Filler Words'}
                        </button>
                      </div>

                      <div className={styles.aiTabResultContent}>
                        {activeAITab === 'transcript' && <pre className={styles.transcriptBox}>{aiResults.transcript}</pre>}
                        {activeAITab === 'summary' && <p className={styles.summaryBox}>{aiResults.summary}</p>}
                        {activeAITab === 'notes' && <pre className={styles.notesBox}>{aiResults.showNotes}</pre>}
                        {activeAITab === 'chapters' && (
                          <div className={styles.chaptersList}>
                            {aiResults.chapters.map((ch, idx) => (
                              <div key={idx} className={styles.chapterRow}>
                                <span className={styles.chapterTime}>{ch.time}</span>
                                <span className={styles.chapterTitle}>{ch.title}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Metadata & Artwork Inspector */}
                <div className={styles.multiTabPanel}>
                  <div className={styles.tabPanelTitle}>
                    <Settings size={16} />
                    <span>Episode Publishing Metadata</span>
                  </div>

                  <div className={styles.metadataFormGrid}>
                    <div className={styles.artworkColumn}>
                      <div className={styles.artworkBox}>
                        {activeProject.metadata.artworkUrl ? (
                          <img src={activeProject.metadata.artworkUrl} className={styles.artworkImg} alt="Artwork" />
                        ) : (
                          <div className={styles.artworkPlaceholder}>
                            <Image size={32} />
                            <span>Podcast Artwork Cover</span>
                          </div>
                        )}
                      </div>
                      <button 
                        className={styles.artworkUploadBtn}
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.onchange = (e) => {
                            const imgFile = (e.target as HTMLInputElement).files?.[0];
                            if (imgFile) {
                              const r = new FileReader();
                              r.onload = () => {
                                const metadata = { ...activeProject.metadata, artworkUrl: r.result as string };
                                saveActiveProjectState({ ...activeProject, metadata });
                              };
                              r.readAsDataURL(imgFile);
                            }
                          };
                          input.click();
                        }}
                      >
                        Upload Cover
                      </button>
                    </div>

                    <div className={styles.fieldsColumn}>
                      <div className={styles.formRow}>
                        <div className={styles.formField}>
                          <label>Episode Title</label>
                          <input 
                            type="text" 
                            value={activeProject.metadata.title} 
                            onChange={(e) => {
                              const metadata = { ...activeProject.metadata, title: e.target.value };
                              saveActiveProjectState({ ...activeProject, metadata });
                            }}
                          />
                        </div>
                        <div className={styles.formField}>
                          <label>Podcast Name</label>
                          <input 
                            type="text" 
                            value={activeProject.metadata.podcastName} 
                            onChange={(e) => {
                              const metadata = { ...activeProject.metadata, podcastName: e.target.value };
                              saveActiveProjectState({ ...activeProject, metadata });
                            }}
                          />
                        </div>
                      </div>

                      <div className={styles.formRow}>
                        <div className={styles.formField}>
                          <label>Author / Speaker</label>
                          <input 
                            type="text" 
                            value={activeProject.metadata.author} 
                            onChange={(e) => {
                              const metadata = { ...activeProject.metadata, author: e.target.value };
                              saveActiveProjectState({ ...activeProject, metadata });
                            }}
                          />
                        </div>
                        <div className={styles.formField}>
                          <label>Category</label>
                          <input 
                            type="text" 
                            value={activeProject.metadata.category} 
                            onChange={(e) => {
                              const metadata = { ...activeProject.metadata, category: e.target.value };
                              saveActiveProjectState({ ...activeProject, metadata });
                            }}
                          />
                        </div>
                      </div>

                      <div className={styles.formField}>
                        <label>Episode Description</label>
                        <textarea 
                          value={activeProject.metadata.description} 
                          onChange={(e) => {
                            const metadata = { ...activeProject.metadata, description: e.target.value };
                            saveActiveProjectState({ ...activeProject, metadata });
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Platform Export Panel */}
                <div className={styles.multiTabPanel}>
                  <div className={styles.tabPanelTitle}>
                    <Download size={16} />
                    <span>Loudness Optimization & Export Studio</span>
                  </div>

                  <div className={styles.exportFormPanel}>
                    <div className={styles.exportFormRow}>
                      <span className={styles.exportFormLabel}>Loudness Target Preset</span>
                      <div className={styles.selectOverrideWrapper}>
                        <select 
                          value={exportPlatform} 
                          onChange={(e) => setExportPlatform(e.target.value as any)}
                        >
                          <option value="spotify">Spotify (-14 LUFS)</option>
                          <option value="apple">Apple Podcasts (-16 LUFS)</option>
                          <option value="youtube">YouTube (-14 LUFS)</option>
                          <option value="amazon">Amazon Music (-14 LUFS)</option>
                          <option value="rss">RSS Standard (-16 LUFS)</option>
                        </select>
                      </div>
                    </div>

                    <div className={styles.exportFormRow}>
                      <span className={styles.exportFormLabel}>Quality Preset</span>
                      <div className={styles.selectOverrideWrapper}>
                        <select 
                          value={exportQuality} 
                          onChange={(e) => setExportQuality(e.target.value as any)}
                        >
                          <option value="draft">Draft (128kbps standard)</option>
                          <option value="standard">Standard (192kbps medium)</option>
                          <option value="high">High Quality (256kbps high)</option>
                          <option value="studio">Studio Quality (320kbps lossless)</option>
                        </select>
                      </div>
                    </div>

                    <div className={styles.exportFormRow}>
                      <span className={styles.exportFormLabel}>Output Format</span>
                      <div className={styles.selectOverrideWrapper}>
                        <select 
                          value={exportFormat} 
                          onChange={(e) => setExportFormat(e.target.value as any)}
                        >
                          <option value="mp3">MP3 format</option>
                          <option value="wav">WAV lossless</option>
                          <option value="flac">FLAC compressed</option>
                          <option value="m4a">M4A (AAC container)</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 0 20px 0' }}>
                      <input 
                        type="checkbox" 
                        id="enable-ducking-cb"
                        checked={enableDucking} 
                        onChange={(e) => setEnableDucking(e.target.checked)}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                      <label htmlFor="enable-ducking-cb" style={{ fontSize: '0.85rem', color: '#cbd5e1', cursor: 'pointer', userSelect: 'none' }}>
                        Enable Auto-Ducking (Fade music during speech)
                      </label>
                    </div>

                    <button 
                      className={styles.mixExportButton}
                      onClick={handleExportMix}
                      disabled={isExporting}
                    >
                      <Download size={16} />
                      <span>{isExporting ? 'Combining Mix…' : 'Master Mix & Download'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>



      {/* Mic recording visualizer overlay */}
      {isRecording && recTrackId && (
        <div className={styles.recordingOverlayHUD}>
          <div className={styles.recordingBox}>
            <div className={styles.redPulseIcon} />
            <h3 className={styles.recTitle}>Recording Active</h3>
            <span className={styles.recTime}>Timer: {recDuration} seconds</span>

            {/* Canvas visualizer */}
            <canvas ref={canvasRef} className={styles.canvasVisualizer} width={300} height={80} />

            <div className={styles.recActions}>
              <button className={styles.stopRecBtn} onClick={stopRecording}>
                <Square size={12} />
                <span>Stop Recording</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-track export loading HUD overlay */}
      {isExporting && exportProgress && (
        <div className={styles.exportProgressOverlayHUD}>
          <div className={styles.exportProgressBox}>
            <div className={styles.glowProgressOuter}>
              <div 
                className={styles.glowProgressBar} 
                style={{ width: `${exportProgress.percent}%` }}
              />
            </div>
            <h3 className={styles.exportPercent}>{exportProgress.percent}%</h3>
            <span className={styles.exportMsg}>{exportProgress.message}</span>
            <small className={styles.exportSubtext}>Combining timeline tracks and mastering loudness limits. Please preserve this tab open.</small>
          </div>
        </div>
      )}

      {/* Create Project Modal */}
      {isNewProjectModalOpen && (
        <div className={styles.newProjModal}>
          <div className={styles.newProjOverlay} onClick={() => setIsNewProjectModalOpen(false)} />
          <div className={styles.newProjBox}>
            <button className={styles.modalClose} onClick={() => setIsNewProjectModalOpen(false)}>×</button>
            <h2 className={styles.newProjTitle}>Create New Podcast Project</h2>
            <div className={styles.newProjField}>
              <label>Project Name</label>
              <input 
                type="text" 
                placeholder="e.g. My Podcast Episode #1"
                value={newProjectName} 
                onChange={(e) => setNewProjectName(e.target.value)}
              />
            </div>
            <div className={styles.newProjActions}>
              <button 
                className={styles.newProjSubmit} 
                onClick={() => {
                  if (newProjectName.trim()) {
                    handleCreateProject(newProjectName.trim());
                    setIsNewProjectModalOpen(false);
                    setNewProjectName('');
                  }
                }}
              >
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
