// ============================================================
// DecibelCut — FFmpeg WASM Service
// Lazy-loaded audio encoding: MP3, WAV, FLAC
// ============================================================

import type { ExportConfig, ExportProgress } from '../types/processing.types';

type FFmpegInstance = {
  load: (opts?: object) => Promise<void>;
  writeFile: (name: string, data: Uint8Array) => Promise<void>;
  readFile: (name: string) => Promise<Uint8Array>;
  deleteFile: (name: string) => Promise<void>;
  exec: (args: string[]) => Promise<number>;
  on: (event: string, handler: (data: unknown) => void) => void;
  off: (event: string, handler: (data: unknown) => void) => void;
  terminate: () => void;
};

let ffmpegInstance: FFmpegInstance | null = null;
let isLoaded = false;
let isLoading = false;

/**
 * Lazy-load and initialize FFmpeg WASM
 */
export async function loadFFmpeg(
  onProgress?: (percent: number) => void
): Promise<FFmpegInstance> {
  if (isLoaded && ffmpegInstance) return ffmpegInstance;
  if (isLoading) {
    // Wait for existing load to complete
    return new Promise((resolve, reject) => {
      const check = setInterval(() => {
        if (isLoaded && ffmpegInstance) {
          clearInterval(check);
          resolve(ffmpegInstance);
        } else if (!isLoading && !isLoaded) {
          clearInterval(check);
          reject(new Error('FFmpeg failed to load'));
        }
      }, 100);
    });
  }

  isLoading = true;
  onProgress?.(5);

  try {
    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
    const ffmpeg = new FFmpeg() as unknown as FFmpegInstance;

    const baseURL = `${window.location.origin}/ffmpeg`;

    // Report loading progress via log events
    let coreLoaded = false;
    const logHandler = () => {
      if (!coreLoaded) {
        onProgress?.(50);
        coreLoaded = true;
      }
    };
    ffmpeg.on('log', logHandler);

    try {
      // First try: Direct same-origin URLs (cleanest under strict COEP/require-corp)
      await ffmpeg.load({
        coreURL: `${baseURL}/ffmpeg-core.js`,
        wasmURL: `${baseURL}/ffmpeg-core.wasm`,
      });
    } catch (directLoadError) {
      console.warn('Direct FFmpeg load failed, trying toBlobURL fallback:', directLoadError);
      const { toBlobURL } = await import('@ffmpeg/util');
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
    }

    ffmpeg.off('log', logHandler);

    ffmpegInstance = ffmpeg;
    isLoaded = true;
    onProgress?.(100);
    return ffmpeg;
  } catch (err) {
    isLoading = false;
    throw new Error(`Failed to load FFmpeg: ${err instanceof Error ? err.message : err}`);
  } finally {
    isLoading = false;
  }
}

/**
 * Encode a WAV ArrayBuffer to the target format
 */
export async function encodeAudio(
  wavData: ArrayBuffer,
  config: ExportConfig,
  onProgress?: (progress: ExportProgress) => void
): Promise<Blob> {
  onProgress?.({ status: 'preparing', percent: 0, message: 'Loading encoder…' });

  const ffmpeg = await loadFFmpeg((p) => {
    onProgress?.({
      status: 'preparing',
      percent: Math.round(p * 0.3),
      message: 'Loading FFmpeg…',
    });
  });

  onProgress?.({ status: 'encoding', percent: 30, message: 'Writing input file…' });

  const inputName = 'input.wav';
  const outputName = `output.${config.format}`;

  await ffmpeg.writeFile(inputName, new Uint8Array(wavData));

  onProgress?.({ status: 'encoding', percent: 40, message: 'Encoding…' });

  // Build FFmpeg args
  const args = ['-i', inputName];

  switch (config.format) {
    case 'mp3':
      args.push('-codec:a', 'libmp3lame');
      if (config.bitrate) args.push('-b:a', `${config.bitrate}k`);
      break;
    case 'flac':
      args.push('-codec:a', 'flac');
      break;
    case 'wav':
      args.push('-codec:a', 'pcm_s16le');
      break;
  }

  args.push('-y', outputName);

  // Track FFmpeg progress via log
  const progressHandler = (data: unknown) => {
    const msg = (data as { message?: string })?.message ?? '';
    if (msg.includes('time=')) {
      onProgress?.({ status: 'encoding', percent: 70, message: 'Encoding audio…' });
    }
  };
  ffmpeg.on('log', progressHandler);

  const exitCode = await ffmpeg.exec(args);
  ffmpeg.off('log', progressHandler);

  if (exitCode !== 0) {
    await ffmpeg.deleteFile(inputName).catch(() => null);
    throw new Error(`FFmpeg encoding failed with exit code ${exitCode}`);
  }

  onProgress?.({ status: 'encoding', percent: 90, message: 'Reading output…' });

  const data = await ffmpeg.readFile(outputName);

  // Cleanup
  await ffmpeg.deleteFile(inputName).catch(() => null);
  await ffmpeg.deleteFile(outputName).catch(() => null);

  const mimeTypes: Record<string, string> = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    flac: 'audio/flac',
  };

  return new Blob([data as unknown as ArrayBuffer], { type: mimeTypes[config.format] ?? 'audio/mpeg' });
}
