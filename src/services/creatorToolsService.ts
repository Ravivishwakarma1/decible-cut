// ============================================================
// DecibelCut — Creator Tools Service
// Platform presets, FFmpeg DSP builders, Batch exports, and AI
// ============================================================

import { loadFFmpeg } from './ffmpegService';
import { audioBufferToWav } from './audioEngine';
import type { ExportProgress } from '../types/processing.types';
import JSZip from 'jszip';

export interface CreatorPreset {
  id: string;
  name: string;
  subtitle: string;
  icon: string;
  sampleRate: number;      // Hz
  bitrate: number;         // kbps
  loudness: number;        // LUFS target, e.g. -14
  codec: 'mp3' | 'aac' | 'flac' | 'ogg' | 'm4a';
  channels: 1 | 2;         // 1 = mono, 2 = stereo
  format: 'mp3' | 'wav' | 'flac' | 'aac' | 'ogg' | 'm4a';
}

export const CREATOR_PRESETS: CreatorPreset[] = [
  {
    id: 'youtube',
    name: 'YouTube Audio Optimizer',
    subtitle: 'Optimized for standard YouTube video uploads.',
    icon: '📹',
    sampleRate: 48000,
    bitrate: 384,
    loudness: -14,
    codec: 'aac',
    channels: 2,
    format: 'aac',
  },
  {
    id: 'tiktok',
    name: 'TikTok Audio Optimizer',
    subtitle: 'Optimized for TikTok vertical videos.',
    icon: '🎵',
    sampleRate: 44100,
    bitrate: 192,
    loudness: -14,
    codec: 'aac',
    channels: 2,
    format: 'm4a',
  },
  {
    id: 'instagram',
    name: 'Instagram Reels Optimizer',
    subtitle: 'Best settings for Instagram Reels & Posts.',
    icon: '📸',
    sampleRate: 44100,
    bitrate: 192,
    loudness: -16,
    codec: 'aac',
    channels: 2,
    format: 'm4a',
  },
  {
    id: 'youtube-shorts',
    name: 'YouTube Shorts Optimizer',
    subtitle: 'Optimized audio for Shorts vertical content.',
    icon: '⚡',
    sampleRate: 48000,
    bitrate: 192,
    loudness: -14,
    codec: 'aac',
    channels: 2,
    format: 'aac',
  },
  {
    id: 'facebook',
    name: 'Facebook Video Audio',
    subtitle: 'Loudness and bitrate tailored for Facebook feeds.',
    icon: '👥',
    sampleRate: 44100,
    bitrate: 128,
    loudness: -14,
    codec: 'mp3',
    channels: 2,
    format: 'mp3',
  },
  {
    id: 'spotify-podcast',
    name: 'Spotify Podcast Audio',
    subtitle: 'Standard Spotify Podcast loudness target.',
    icon: '🎧',
    sampleRate: 44100,
    bitrate: 192,
    loudness: -14,
    codec: 'mp3',
    channels: 1,
    format: 'mp3',
  },
  {
    id: 'apple-podcast',
    name: 'Apple Podcast Audio',
    subtitle: 'Apple Podcasts high-quality target.',
    icon: '🍎',
    sampleRate: 44100,
    bitrate: 256,
    loudness: -16,
    codec: 'aac',
    channels: 1,
    format: 'm4a',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Voice Note Converter',
    subtitle: 'Highly compressed format optimized for voice notes.',
    icon: '💬',
    sampleRate: 16000,
    bitrate: 32,
    loudness: -20,
    codec: 'ogg', // Vorbis fits ogg container perfectly in browser
    channels: 1,
    format: 'ogg',
  },
  {
    id: 'discord',
    name: 'Discord Audio Converter',
    subtitle: 'Optimized voice settings for Discord bots/attachments.',
    icon: '👾',
    sampleRate: 48000,
    bitrate: 64,
    loudness: -15,
    codec: 'ogg',
    channels: 2,
    format: 'ogg',
  },
  {
    id: 'ringtone',
    name: 'Ringtone Maker',
    subtitle: 'Louder peak mastering ideal for mobile rings.',
    icon: '🔔',
    sampleRate: 44100,
    bitrate: 256,
    loudness: -12,
    codec: 'aac',
    channels: 2,
    format: 'm4a',
  },
];

export interface CreatorDSPConfig {
  loudnessNormalize: boolean;
  removeSilence: boolean;
  fadeIn: boolean;
  fadeOut: boolean;
  noiseReduction: boolean;
  voiceEnhancement: boolean;
  compressor: boolean;
  limiter: boolean;
  normalizePeaks: boolean;
  bassEnhancement: boolean;
  trebleEnhancement: boolean;
  vocalBoost: boolean;
  deEsser: boolean;
  eqPreset: 'none' | 'podcast' | 'gaming' | 'music' | 'interview' | 'speech' | 'streaming' | 'vlog';
}

export interface AISuggestions {
  betterBitrate: number;
  recommendedLoudness: number;
  noiseRemoval: boolean;
  voiceEnhancement: boolean;
  compressionLevel: 'none' | 'light' | 'moderate' | 'heavy';
  bestExportFormat: 'mp3' | 'wav' | 'flac' | 'm4a' | 'ogg' | 'aac';
  bestPresetId: string;
  reasoning: string[];
}

/**
 * Analyzes audio buffer properties client-side to generate AI suggestion cards
 */
export function analyzeAudioForSuggestions(
  buffer: AudioBuffer,
  fileName: string
): AISuggestions {
  const duration = buffer.duration;
  const sampleRate = buffer.sampleRate;
  const channels = buffer.numberOfChannels;

  // Compute Peak and RMS to mock audio analysis
  let maxPeak = 0;
  let rmsSum = 0;
  let sampleCount = 0;
  
  const leftChannel = buffer.getChannelData(0);
  const step = Math.max(1, Math.floor(leftChannel.length / 100000)); // Sample 100k points
  
  for (let i = 0; i < leftChannel.length; i += step) {
    const val = Math.abs(leftChannel[i]);
    if (val > maxPeak) maxPeak = val;
    rmsSum += val * val;
    sampleCount++;
  }

  const peakDb = maxPeak > 0 ? 20 * Math.log10(maxPeak) : -100;
  const rmsDb = sampleCount > 0 ? 20 * Math.log10(Math.sqrt(rmsSum / sampleCount)) : -100;

  // Logic heuristics
  const reasoning: string[] = [];
  const nameLower = fileName.toLowerCase();
  
  let noiseRemoval = false;
  let voiceEnhancement = false;
  let compressionLevel: AISuggestions['compressionLevel'] = 'none';
  let recommendedLoudness = -14;
  let betterBitrate = 192;
  let bestPresetId = 'youtube';
  let bestExportFormat: AISuggestions['bestExportFormat'] = 'mp3';

  // Format preset guesser based on file name or length
  if (nameLower.includes('podcast') || nameLower.includes('episode') || nameLower.includes('talk')) {
    bestPresetId = 'spotify-podcast';
    bestExportFormat = 'mp3';
    recommendedLoudness = -14;
    betterBitrate = 192;
    reasoning.push('Detected file is a podcast/speech recording. Recommending Spotify Podcast Optimizer preset.');
  } else if (nameLower.includes('reel') || nameLower.includes('tiktok') || nameLower.includes('shorts') || duration < 65) {
    bestPresetId = 'tiktok';
    bestExportFormat = 'm4a';
    recommendedLoudness = -14;
    betterBitrate = 192;
    reasoning.push('Short audio length detected. Recommending TikTok Audio Optimizer preset (M4A container).');
  } else if (nameLower.includes('ringtone') || nameLower.includes('alarm')) {
    bestPresetId = 'ringtone';
    bestExportFormat = 'm4a';
    recommendedLoudness = -12;
    betterBitrate = 256;
    reasoning.push('Ringtone files benefit from a louder peak limit (-12 LUFS) and high bitrate AAC.');
  } else {
    bestPresetId = 'youtube';
    bestExportFormat = 'aac';
    recommendedLoudness = -14;
    betterBitrate = 320;
    reasoning.push('General video/audio file detected. Recommending YouTube Audio Optimizer (AAC 320kbps).');
  }

  // Noise floor guesser (using peak vs rms distance)
  // If peak to RMS ratio is small and peak is low, it could be noisy
  const peakToRms = peakDb - rmsDb;
  if (peakToRms < 10) {
    noiseRemoval = true;
    reasoning.push('Low dynamic range with high noise floor detected. Recommended: Turn on Noise Reduction.');
  } else {
    reasoning.push('Background noise level is acceptable, but Noise Reduction is recommended for mobile environments.');
  }

  // Compression levels based on peak to RMS difference
  if (peakToRms > 22) {
    compressionLevel = 'heavy';
    reasoning.push('High dynamic range (large volume peaks) detected. Recommended: Heavy Compressor to normalize speaking levels.');
  } else if (peakToRms > 15) {
    compressionLevel = 'moderate';
    reasoning.push('Moderate dynamic range detected. Recommended: Light-to-Moderate Compressor for a consistent sound stage.');
  } else {
    compressionLevel = 'light';
    reasoning.push('Consistent volume levels detected. Recommended: Light Compressor to glue elements together.');
  }

  if (sampleRate < 32000 || channels === 1) {
    voiceEnhancement = true;
    reasoning.push('Mono or low-sample-rate audio. Voice Enhancement will boost treble presence and clarity.');
  }

  return {
    betterBitrate,
    recommendedLoudness,
    noiseRemoval,
    voiceEnhancement,
    compressionLevel,
    bestExportFormat,
    bestPresetId,
    reasoning,
  };
}

/**
 * Builds the FFmpeg arguments based on custom DSP settings and preset target
 */
export function buildFFmpegArgs(
  inputName: string,
  outputName: string,
  preset: CreatorPreset,
  dsp: CreatorDSPConfig,
  customOverrides?: Partial<CreatorPreset>,
  duration?: number
): string[] {
  const activePreset = { ...preset, ...customOverrides };
  const args = ['-i', inputName];

  // Disable video
  args.push('-vn');

  // Build audio filters array
  const filters: string[] = [];

  // 1. Noise Reduction
  if (dsp.noiseReduction) {
    // afftdn is the built-in FFT denoiser in ffmpeg
    filters.push('afftdn=nr=15:nf=-45');
  }

  // 2. De-Esser
  if (dsp.deEsser) {
    // Standard high-mid band rejection to counter vocal sibilance
    filters.push('equalizer=f=6500:width_type=o:width=1.0:g=-5');
  }

  // 3. EQ Presets
  switch (dsp.eqPreset) {
    case 'podcast':
      filters.push('equalizer=f=80:width_type=o:width=1.0:g=-6'); // Cut low mud
      filters.push('equalizer=f=2500:width_type=o:width=1.2:g=3.5'); // Boost vocal presence
      break;
    case 'gaming':
      filters.push('equalizer=f=120:width_type=o:width=1.0:g=-4');
      filters.push('equalizer=f=3500:width_type=o:width=1.5:g=5'); // Boost footstep/spatial cues
      break;
    case 'music':
      filters.push('equalizer=f=80:width_type=o:width=1.2:g=4.5'); // Bass boost
      filters.push('equalizer=f=1000:width_type=o:width=1.0:g=-2'); // Cut mid clutter
      filters.push('equalizer=f=9000:width_type=o:width=1.2:g=4.5'); // Treble air
      break;
    case 'interview':
      filters.push('equalizer=f=90:width_type=o:width=1.0:g=-5'); // Sharp low cut
      filters.push('equalizer=f=1800:width_type=o:width=1.0:g=3');  // Vocal focus
      break;
    case 'speech':
      filters.push('equalizer=f=120:width_type=o:width=0.8:g=-4');
      filters.push('equalizer=f=3000:width_type=o:width=1.5:g=3');
      break;
    case 'streaming':
      filters.push('equalizer=f=90:width_type=o:width=1.0:g=-3');
      filters.push('equalizer=f=2200:width_type=o:width=1.0:g=3.5');
      break;
    case 'vlog':
      filters.push('equalizer=f=80:width_type=o:width=1.0:g=-5');
      filters.push('equalizer=f=4500:width_type=o:width=1.2:g=2.5');
      break;
  }

  // 4. Boosts
  if (dsp.bassEnhancement) {
    filters.push('bass=g=6');
  }
  if (dsp.trebleEnhancement) {
    filters.push('treble=g=5');
  }
  if (dsp.vocalBoost) {
    filters.push('equalizer=f=2000:width_type=o:width=1.5:g=4.5');
  }
  if (dsp.voiceEnhancement) {
    // Cut mud + boost mid presence
    filters.push('highpass=f=75');
    filters.push('equalizer=f=3200:width_type=o:width=1.2:g=4');
  }

  // 5. Compressor
  if (dsp.compressor) {
    // Standard dynamic compressor
    filters.push('acompressor=threshold=0.125:ratio=3.5:attack=15:release=120');
  }

  // 6. Loudness / Peak Normalization
  if (dsp.loudnessNormalize) {
    filters.push(`loudnorm=I=${activePreset.loudness}:TP=-1.5:LRA=11`);
  } else if (dsp.normalizePeaks) {
    // Peak normalization filter
    filters.push('dynaudnorm=p=1.0');
  }

  // 7. Limiter (prevent digital clipping)
  if (dsp.limiter) {
    filters.push('alimiter=level_in=1:level_out=0.95:limit=0.98:attack=5:release=50');
  }

  // Fade In / Out
  if (dsp.fadeIn) {
    filters.push('afade=t=in:ss=0:d=1.5');
  }
  if (dsp.fadeOut && duration && duration > 1.5) {
    const fadeOutStart = duration - 1.5;
    filters.push(`afade=t=out:st=${fadeOutStart.toFixed(3)}:d=1.5`);
  }

  // Add all filter graph arguments
  if (filters.length > 0) {
    args.push('-filter:a', filters.join(','));
  }

  // Bitrate, Channels & Sample Rate
  if (activePreset.channels) {
    args.push('-ac', activePreset.channels.toString());
  }
  if (activePreset.sampleRate) {
    args.push('-ar', activePreset.sampleRate.toString());
  }

  // Codecs mapping
  switch (activePreset.format) {
    case 'mp3':
      args.push('-codec:a', 'libmp3lame');
      args.push('-b:a', `${activePreset.bitrate}k`);
      break;
    case 'wav':
      args.push('-codec:a', 'pcm_s16le');
      break;
    case 'flac':
      args.push('-codec:a', 'flac');
      break;
    case 'aac':
    case 'm4a':
      args.push('-codec:a', 'aac');
      args.push('-b:a', `${activePreset.bitrate}k`);
      break;
    case 'ogg':
      args.push('-codec:a', 'libvorbis');
      args.push('-b:a', `${activePreset.bitrate}k`);
      break;
  }

  args.push('-y', outputName);
  return args;
}

/**
 * Runs processing pipeline client-side for a single preset config
 */
export async function processCreatorAudio(
  buffer: AudioBuffer,
  preset: CreatorPreset,
  dsp: CreatorDSPConfig,
  customOverrides?: Partial<CreatorPreset>,
  onProgress?: (progress: ExportProgress) => void
): Promise<Blob> {
  onProgress?.({ status: 'preparing', percent: 5, message: 'Rendering workspace buffer…' });

  // Convert buffer to WAV
  const wavData = audioBufferToWav(buffer);
  onProgress?.({ status: 'preparing', percent: 20, message: 'Initializing FFmpeg encoder…' });

  const ffmpeg = await loadFFmpeg((p) => {
    onProgress?.({
      status: 'preparing',
      percent: 20 + Math.round(p * 0.15),
      message: 'Loading core filters…',
    });
  });

  const inputName = `input_${Date.now()}.wav`;
  const outputName = `output_${Date.now()}.${customOverrides?.format ?? preset.format}`;

  onProgress?.({ status: 'encoding', percent: 40, message: 'Writing audio to virtual filesystem…' });
  await ffmpeg.writeFile(inputName, new Uint8Array(wavData));

  // Build FFmpeg commands
  const args = buildFFmpegArgs(inputName, outputName, preset, dsp, customOverrides, buffer.duration);

  onProgress?.({ status: 'encoding', percent: 50, message: 'Applying audio DSP parameters…' });

  const logHandler = (data: unknown) => {
    const msg = (data as { message?: string })?.message ?? '';
    const timeMatch = msg.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
    if (timeMatch && buffer.duration) {
      const hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      const seconds = parseFloat(`${timeMatch[3]}.${timeMatch[4]}`);
      const elapsed = hours * 3600 + minutes * 60 + seconds;
      
      const pct = Math.min(88, 50 + Math.round((elapsed / buffer.duration) * 38));
      onProgress?.({
        status: 'encoding',
        percent: pct,
        message: `Mastering platform preset (${Math.round((elapsed / buffer.duration) * 100)}%)…`
      });
    } else if (msg.includes('time=')) {
      onProgress?.({ status: 'encoding', percent: 75, message: 'Mastering platform preset…' });
    }
  };
  ffmpeg.on('log', logHandler);

  const exitCode = await ffmpeg.exec(args);
  ffmpeg.off('log', logHandler);

  if (exitCode !== 0) {
    await ffmpeg.deleteFile(inputName).catch(() => null);
    throw new Error(`FFmpeg processing failed with exit code ${exitCode}`);
  }

  onProgress?.({ status: 'encoding', percent: 90, message: 'Reading mastered file…' });
  const data = await ffmpeg.readFile(outputName);

  // Clean virtual file system to free browser memory
  await ffmpeg.deleteFile(inputName).catch(() => null);
  await ffmpeg.deleteFile(outputName).catch(() => null);

  const mimeTypes: Record<string, string> = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    flac: 'audio/flac',
    aac: 'audio/aac',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',
  };

  const format = customOverrides?.format ?? preset.format;
  onProgress?.({ status: 'encoding', percent: 100, message: 'Mastering complete!' });

  return new Blob([data as unknown as ArrayBuffer], { type: mimeTypes[format] ?? 'audio/mpeg' });
}

/**
 * Runs batch export: exports a single audio buffer into multiple presets, generating a single ZIP file download
 */
export async function processBatchExport(
  buffer: AudioBuffer,
  presetsToExport: CreatorPreset[],
  dsp: CreatorDSPConfig,
  baseFilename: string,
  onProgress?: (progress: ExportProgress) => void
): Promise<Blob> {
  const zip = new JSZip();
  const totalPresets = presetsToExport.length;

  for (let i = 0; i < totalPresets; i++) {
    const preset = presetsToExport[i];
    onProgress?.({
      status: 'encoding',
      percent: Math.round((i / totalPresets) * 90),
      message: `Exporting preset ${i + 1}/${totalPresets}: ${preset.name}…`,
    });

    const resultBlob = await processCreatorAudio(buffer, preset, dsp, undefined, () => {});
    const cleanBaseName = baseFilename.replace(/\.[^.]+$/, '');
    const filename = `${cleanBaseName}_${preset.id}.${preset.format}`;
    
    // Add file blob to ZIP
    zip.file(filename, resultBlob);
  }

  onProgress?.({ status: 'encoding', percent: 95, message: 'Creating ZIP archive…' });
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  onProgress?.({ status: 'complete', percent: 100, message: 'Batch export complete!' });
  return zipBlob;
}
