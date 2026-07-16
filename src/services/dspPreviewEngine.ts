// ============================================================
// DecibelCut — DSP Preview Engine
// Real-time Web Audio API node graph for audio preview
// ============================================================

import { getAudioContext } from './audioEngine';
import type { CreatorDSPConfig } from './creatorToolsService';

// Keep track of source nodes created for HTMLAudioElements to prevent browser errors
// (MediaElementAudioSourceNode can only be created once per element)
const sourceNodesMap = new Map<HTMLAudioElement, MediaElementAudioSourceNode>();

export class DspPreviewEngine {
  private audioCtx: AudioContext;
  private sourceNode: MediaElementAudioSourceNode | null = null;

  // Web Audio Nodes in the graph
  private bassNode: BiquadFilterNode;
  private trebleNode: BiquadFilterNode;
  private eqPeakingNode1: BiquadFilterNode; // Mid-cut/boost
  private eqPeakingNode2: BiquadFilterNode; // Vocal focus
  private deEsserNode: BiquadFilterNode;
  private highPassNode: BiquadFilterNode;
  private compressorNode: DynamicsCompressorNode;
  private limiterNode: DynamicsCompressorNode;
  private masterGain: GainNode;

  // Active status of filters
  private dspConfig: CreatorDSPConfig | null = null;
  private duration = 0;

  constructor(audioElement: HTMLAudioElement) {
    this.audioCtx = getAudioContext();

    // 1. Get or create MediaElementSourceNode
    let srcNode = sourceNodesMap.get(audioElement);
    if (!srcNode) {
      srcNode = this.audioCtx.createMediaElementSource(audioElement);
      sourceNodesMap.set(audioElement, srcNode);
    }
    this.sourceNode = srcNode;

    // 2. Initialize filter nodes
    this.bassNode = this.audioCtx.createBiquadFilter();
    this.bassNode.type = 'lowshelf';
    this.bassNode.frequency.value = 80;
    this.bassNode.gain.value = 0; // bypassed initially

    this.trebleNode = this.audioCtx.createBiquadFilter();
    this.trebleNode.type = 'highshelf';
    this.trebleNode.frequency.value = 9000;
    this.trebleNode.gain.value = 0; // bypassed initially

    this.eqPeakingNode1 = this.audioCtx.createBiquadFilter();
    this.eqPeakingNode1.type = 'peaking';
    this.eqPeakingNode1.Q.value = 1.0;
    this.eqPeakingNode1.gain.value = 0;

    this.eqPeakingNode2 = this.audioCtx.createBiquadFilter();
    this.eqPeakingNode2.type = 'peaking';
    this.eqPeakingNode2.Q.value = 1.2;
    this.eqPeakingNode2.gain.value = 0;

    this.deEsserNode = this.audioCtx.createBiquadFilter();
    this.deEsserNode.type = 'peaking';
    this.deEsserNode.frequency.value = 6500;
    this.deEsserNode.Q.value = 1.0;
    this.deEsserNode.gain.value = 0;

    this.highPassNode = this.audioCtx.createBiquadFilter();
    this.highPassNode.type = 'highpass';
    this.highPassNode.frequency.value = 75;
    // BiquadFilter highpass is enabled by routing through it or bypassing via freq=0
    // We will bypass it by setting frequency to 10 (below audible range)

    this.compressorNode = this.audioCtx.createDynamicsCompressor();
    // Default standard settings, bypass by setting threshold to 0
    this.compressorNode.threshold.value = 0;
    this.compressorNode.ratio.value = 3.5;
    this.compressorNode.attack.value = 0.015; // 15ms
    this.compressorNode.release.value = 0.12; // 120ms

    this.limiterNode = this.audioCtx.createDynamicsCompressor();
    // Hard limiter settings
    this.limiterNode.threshold.value = -1.5;
    this.limiterNode.ratio.value = 20;
    this.limiterNode.attack.value = 0.005; // 5ms
    this.limiterNode.release.value = 0.05; // 50ms

    this.masterGain = this.audioCtx.createGain();
    this.masterGain.gain.value = 1.0;

    // 3. Connect the node graph chain
    // Source -> Bass -> Treble -> Eq1 -> Eq2 -> DeEsser -> HighPass -> Compressor -> Limiter -> Gain -> Destination
    srcNode.connect(this.bassNode);
    this.bassNode.connect(this.trebleNode);
    this.trebleNode.connect(this.eqPeakingNode1);
    this.eqPeakingNode1.connect(this.eqPeakingNode2);
    this.eqPeakingNode2.connect(this.deEsserNode);
    this.deEsserNode.connect(this.highPassNode);
    this.highPassNode.connect(this.compressorNode);
    this.compressorNode.connect(this.limiterNode);
    this.limiterNode.connect(this.masterGain);
    this.masterGain.connect(this.audioCtx.destination);
  }

  /**
   * Updates real-time DSP parameters based on the current configuration
   */
  public update(dsp: CreatorDSPConfig, duration: number) {
    this.dspConfig = dsp;
    this.duration = duration;

    // A. Bass & Treble Enhancement
    this.bassNode.gain.setValueAtTime(dsp.bassEnhancement ? 6 : 0, this.audioCtx.currentTime);
    this.trebleNode.gain.setValueAtTime(dsp.trebleEnhancement ? 5 : 0, this.audioCtx.currentTime);

    // B. High Pass (Voice Enhancement)
    this.highPassNode.frequency.setValueAtTime(
      dsp.voiceEnhancement ? 75 : 10, // 10Hz is effectively bypassed
      this.audioCtx.currentTime
    );

    // C. De-Esser
    this.deEsserNode.gain.setValueAtTime(dsp.deEsser ? -5 : 0, this.audioCtx.currentTime);

    // D. EQ Presets
    this.eqPeakingNode1.gain.setValueAtTime(0, this.audioCtx.currentTime);
    this.eqPeakingNode2.gain.setValueAtTime(0, this.audioCtx.currentTime);

    switch (dsp.eqPreset) {
      case 'podcast':
        // Cut mud at 80Hz
        this.eqPeakingNode1.frequency.value = 80;
        this.eqPeakingNode1.type = 'peaking';
        this.eqPeakingNode1.gain.setValueAtTime(-6, this.audioCtx.currentTime);
        // Boost vocals at 2.5kHz
        this.eqPeakingNode2.frequency.value = 2500;
        this.eqPeakingNode2.gain.setValueAtTime(3.5, this.audioCtx.currentTime);
        break;
      case 'gaming':
        this.eqPeakingNode1.frequency.value = 120;
        this.eqPeakingNode1.gain.setValueAtTime(-4, this.audioCtx.currentTime);
        this.eqPeakingNode2.frequency.value = 3500;
        this.eqPeakingNode2.gain.setValueAtTime(5, this.audioCtx.currentTime);
        break;
      case 'music':
        // Extra bass boost & mid cut
        this.eqPeakingNode1.frequency.value = 1000;
        this.eqPeakingNode1.gain.setValueAtTime(-2, this.audioCtx.currentTime);
        break;
      case 'interview':
        this.eqPeakingNode1.frequency.value = 90;
        this.eqPeakingNode1.gain.setValueAtTime(-5, this.audioCtx.currentTime);
        this.eqPeakingNode2.frequency.value = 1800;
        this.eqPeakingNode2.gain.setValueAtTime(3, this.audioCtx.currentTime);
        break;
      case 'speech':
        this.eqPeakingNode1.frequency.value = 120;
        this.eqPeakingNode1.gain.setValueAtTime(-4, this.audioCtx.currentTime);
        this.eqPeakingNode2.frequency.value = 3000;
        this.eqPeakingNode2.gain.setValueAtTime(3, this.audioCtx.currentTime);
        break;
      case 'streaming':
        this.eqPeakingNode1.frequency.value = 90;
        this.eqPeakingNode1.gain.setValueAtTime(-3, this.audioCtx.currentTime);
        this.eqPeakingNode2.frequency.value = 2200;
        this.eqPeakingNode2.gain.setValueAtTime(3.5, this.audioCtx.currentTime);
        break;
      case 'vlog':
        this.eqPeakingNode1.frequency.value = 80;
        this.eqPeakingNode1.gain.setValueAtTime(-5, this.audioCtx.currentTime);
        this.eqPeakingNode2.frequency.value = 4500;
        this.eqPeakingNode2.gain.setValueAtTime(2.5, this.audioCtx.currentTime);
        break;
    }

    // E. Vocal Boost (if voice enhancement or vocalBoost active)
    if (dsp.vocalBoost) {
      this.eqPeakingNode2.frequency.value = 2000;
      this.eqPeakingNode2.gain.setValueAtTime(4.5, this.audioCtx.currentTime);
    } else if (dsp.voiceEnhancement) {
      this.eqPeakingNode2.frequency.value = 3200;
      this.eqPeakingNode2.gain.setValueAtTime(4, this.audioCtx.currentTime);
    }

    // F. Compressor
    this.compressorNode.threshold.setValueAtTime(
      dsp.compressor ? -24 : 0, // 0dB is effectively bypassed
      this.audioCtx.currentTime
    );

    // G. Limiter
    this.limiterNode.threshold.setValueAtTime(
      dsp.limiter ? -1.5 : 0,
      this.audioCtx.currentTime
    );
  }

  /**
   * Applies fade volumes dynamically in real time
   * @param currentTime Current playback time of the audio element in seconds
   */
  public updateFades(currentTime: number) {
    if (!this.dspConfig) return;

    let targetGain = 1.0;

    // Apply Loudness Normalization / Peak scale simulator
    if (this.dspConfig.loudnessNormalize) {
      // Simulate typical attenuation for loudnorm (standard voice scale target)
      targetGain = 0.8;
    }

    // Fade-in envelope
    if (this.dspConfig.fadeIn && currentTime < 1.5) {
      const progress = currentTime / 1.5;
      targetGain *= progress;
    }

    // Fade-out envelope
    if (this.dspConfig.fadeOut && this.duration > 1.5 && currentTime > this.duration - 1.5) {
      const remaining = this.duration - currentTime;
      const progress = Math.max(0, remaining / 1.5);
      targetGain *= progress;
    }

    this.masterGain.gain.setValueAtTime(targetGain, this.audioCtx.currentTime);
  }

  /**
   * Cleans up the audio node routing and restores connections
   */
  public destroy() {
    try {
      this.sourceNode?.disconnect();
    } catch (e) {
      console.warn('DSP Preview Engine cleanup error:', e);
    }
  }
}
