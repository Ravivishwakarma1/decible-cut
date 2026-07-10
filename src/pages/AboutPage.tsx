import React from 'react';
import { Link } from 'react-router-dom';
import styles from './AboutPage.module.css';
import { ArrowLeft, Shield, Zap, Cpu, Lock, Heart } from 'lucide-react';
import { InContentAd } from '../components/ads/AdComponents';

export const AboutPage: React.FC = () => {
  return (
    <div className={styles.root}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <Link to="/" className={styles.backBtn}>
            <ArrowLeft size={16} />
            Back to Home
          </Link>
          <h1 className={styles.title}>About DecibelCut</h1>
          <p className={styles.subtitle}>
            A professional, privacy-first audio editing application designed to automate audio cleanup and silence removal.
          </p>
        </div>

        {/* Core Pillars */}
        <section className={styles.pillarsGrid}>
          <div className={styles.pillarCard}>
            <div className={[styles.iconWrapper, styles.accentGreen].join(' ')}>
              <Shield size={24} />
            </div>
            <h3 className={styles.pillarTitle}>100% Privacy</h3>
            <p className={styles.pillarText}>
              Your audio files are never uploaded to any server. All processing runs locally in your browser sandbox using Web Audio and WebAssembly.
            </p>
          </div>

          <div className={styles.pillarCard}>
            <div className={[styles.iconWrapper, styles.accentYellow].join(' ')}>
              <Zap size={24} />
            </div>
            <h3 className={styles.pillarTitle}>Lightning Fast</h3>
            <p className={styles.pillarText}>
              DecibelCut stitches audio buffers and runs silence detection in parallel using multi-threaded web worker routines for a smooth and responsive experience.
            </p>
          </div>

          <div className={styles.pillarCard}>
            <div className={[styles.iconWrapper, styles.accentPurple].join(' ')}>
              <Cpu size={24} />
            </div>
            <h3 className={styles.pillarTitle}>Lossless Export</h3>
            <p className={styles.pillarText}>
              Under the hood, WebAssembly FFmpeg compiles your edited waveform directly into production-ready MP3, WAV, or FLAC formats without audio degradation.
            </p>
          </div>
        </section>

        {/* Details Section */}
        <section className={styles.detailsSection}>
          <h2 className={styles.sectionTitle}>How It Works</h2>
          <div className={styles.contentBlock}>
            <div className={styles.step}>
              <div className={styles.stepNumber}>1</div>
              <div className={styles.stepBody}>
                <h4>Local Audio Decoding</h4>
                <p>When you drop an audio file into DecibelCut, the browser decodes it into a raw PCM AudioBuffer. The UI is completely isolated, preventing system freezes even on hour-long tracks.</p>
              </div>
            </div>

            <div className={styles.step}>
              <div className={styles.stepNumber}>2</div>
              <div className={styles.stepBody}>
                <h4>RMS-Based Silence Detection</h4>
                <p>An optimized Root-Mean-Square (RMS) analysis scans the waveform in 50ms intervals. DecibelCut maps signal amplitudes onto a decibel scale (dBFS) and flags segments falling below your threshold.</p>
              </div>
            </div>

            <div className={styles.step}>
              <div className={styles.stepNumber}>3</div>
              <div className={styles.stepBody}>
                <h4>Stitching & Crossfading</h4>
                <p>All active non-silent regions are concatenated together. To eliminate pop and click artifacts at cut boundaries, DecibelCut applies sub-millisecond linear fade-ins and fade-outs (crossfades) between segments.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Technology Stack */}
        <section className={styles.detailsSection}>
          <h2 className={styles.sectionTitle}>Technology Stack</h2>
          <div className={styles.techGrid}>
            <div className={styles.techItem}>
              <strong>React 18 + TS</strong>
              <span>Provides a modern, component-driven framework with rigid type safety for reliable state operations.</span>
            </div>
            <div className={styles.techItem}>
              <strong>WaveSurfer.js v7</strong>
              <span>Handles responsive waveform rendering and powers the interactive zoom and region adjustments.</span>
            </div>
            <div className={styles.techItem}>
              <strong>FFmpeg WASM</strong>
              <span>Compiles FFmpeg to WebAssembly so you can encode and package files directly on the client side.</span>
            </div>
            <div className={styles.techItem}>
              <strong>Zustand</strong>
              <span>A highly performant, lightweight state manager that handles undo/redo stacks and real-time playback settings.</span>
            </div>
          </div>
        </section>

        {/* Privacy details */}
        <section className={styles.privacyBanner}>
          <div className={styles.privacyHeader}>
            <Lock size={20} className={styles.lockIcon} />
            <h3>Our Security & Privacy Philosophy</h3>
          </div>
          <p>
            DecibelCut was built to address a core issue in modern content creation: the reliance on remote servers for simple media processing tasks. By moving all execution to your local CPU/GPU:
          </p>
          <ul>
            <li>No files are ever uploaded or stored.</li>
            <li>No data bandwidth is wasted uploading massive podcasts.</li>
            <li>The tool works fully offline once loaded.</li>
            <li>Zero analytics trackers or telemetry are collected for usage statistics.</li>
          </ul>
          <p className={styles.privacyLinkText}>
            For more details, read our full <Link to="/privacy" className={styles.privacyLink}>Privacy Policy</Link>.
          </p>
        </section>

        {/* Ad Placement */}
        <InContentAd placement="aboutPageBottom" />

        {/* Footer */}
        <div className={styles.aboutFooter}>
          <p>DecibelCut is open-source and free to use forever.</p>
          <div className={styles.footerNote}>
            <span>Made with</span>
            <Heart size={14} className={styles.heartIcon} />
            <span>for podcasters, editors, and creators.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
