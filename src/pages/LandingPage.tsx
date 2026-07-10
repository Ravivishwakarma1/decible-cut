import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import styles from './LandingPage.module.css';
import {
  Zap, Shield, Wand2, Music, FileDown, Layers,
  ArrowRight, ChevronDown, ChevronUp,
  Scissors, Headphones, Video, Play, Pause
} from 'lucide-react';
import { BannerAd, InContentAd, FooterAd, SkyscraperAd } from '../components/ads/AdComponents';

// ---- Hero Section ----
const Hero: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCutEnabled, setIsCutEnabled] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const buffersRef = useRef<{ original: AudioBuffer; processed: AudioBuffer } | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const elapsedTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);

  const initAudio = () => {
    if (audioCtxRef.current) return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    audioCtxRef.current = ctx;

    const sampleRate = ctx.sampleRate;

    // Original buffer (8.0s)
    const origDuration = 8.0;
    const origLength = sampleRate * origDuration;
    const originalBuffer = ctx.createBuffer(1, origLength, sampleRate);
    const origData = originalBuffer.getChannelData(0);

    // Processed buffer (5.5s)
    const procDuration = 5.5;
    const procLength = sampleRate * procDuration;
    const processedBuffer = ctx.createBuffer(1, procLength, sampleRate);
    const procData = processedBuffer.getChannelData(0);

    // Synthesize Original: speech (120Hz fundamental) + 4 segments, 3 gaps of noise
    for (let i = 0; i < origLength; i++) {
      const t = i / sampleRate;
      const noise = (Math.random() * 2 - 1) * 0.022; // low hum static
      
      let voice = 0;
      // Speech active segments:
      // seg1: 0.0s - 1.5s
      // seg2: 2.3s - 4.2s
      // seg3: 5.2s - 6.7s
      // seg4: 7.4s - 8.0s
      const isSpeech = (t >= 0 && t < 1.5) || 
                       (t >= 2.3 && t < 4.2) || 
                       (t >= 5.2 && t < 6.7) || 
                       (t >= 7.4 && t <= 8.0);

      if (isSpeech) {
        const f0 = 125;
        const wave = Math.sin(2 * Math.PI * f0 * t) + 
                     0.5 * Math.sin(2 * Math.PI * f0 * 2 * t) + 
                     0.25 * Math.sin(2 * Math.PI * f0 * 3 * t);
        const envelope = Math.max(0, Math.sin(2 * Math.PI * 3.5 * t));
        voice = wave * envelope * 0.12;
      }
      
      origData[i] = voice + noise;
    }

    // Synthesize Processed: continuous speech, gaps removed
    for (let i = 0; i < procLength; i++) {
      const t = i / sampleRate;
      const noise = (Math.random() * 2 - 1) * 0.0012; // near zero hum
      
      let voice = 0;
      let tOrig = t;
      if (t >= 0 && t < 1.5) {
        // seg1
      } else if (t >= 1.5 && t < 3.4) {
        tOrig = t + 0.8;
      } else if (t >= 3.4 && t < 4.9) {
        tOrig = t + 1.8;
      } else {
        tOrig = t + 2.5;
      }

      const f0 = 125;
      const wave = Math.sin(2 * Math.PI * f0 * tOrig) + 
                   0.5 * Math.sin(2 * Math.PI * f0 * 2 * tOrig) + 
                   0.25 * Math.sin(2 * Math.PI * f0 * 3 * tOrig);
      const envelope = Math.max(0, Math.sin(2 * Math.PI * 3.5 * tOrig));
      voice = wave * envelope * 0.12;
      
      procData[i] = voice + noise;
    }

    buffersRef.current = { original: originalBuffer, processed: processedBuffer };
  };

  const playNode = (offset: number) => {
    if (!audioCtxRef.current || !buffersRef.current) return;

    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch (e) {}
    }

    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    const source = ctx.createBufferSource();
    source.buffer = isCutEnabled ? buffersRef.current.processed : buffersRef.current.original;
    source.connect(ctx.destination);

    sourceNodeRef.current = source;
    startTimeRef.current = ctx.currentTime - offset;
    elapsedTimeRef.current = offset;
    setCurrentTime(offset);

    source.start(0, offset);

    source.onended = () => {
      const duration = isCutEnabled ? 5.5 : 8.0;
      if (ctx.currentTime - startTimeRef.current >= duration - 0.1) {
        setIsPlaying(false);
        elapsedTimeRef.current = 0;
        setCurrentTime(0);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      }
    };

    const updateProgress = () => {
      const duration = isCutEnabled ? 5.5 : 8.0;
      const elapsed = ctx.currentTime - startTimeRef.current;
      if (elapsed <= duration) {
        setCurrentTime(elapsed);
        elapsedTimeRef.current = elapsed;
        animationFrameRef.current = requestAnimationFrame(updateProgress);
      }
    };

    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = requestAnimationFrame(updateProgress);
  };

  const handlePlayToggle = () => {
    initAudio();
    if (isPlaying) {
      if (sourceNodeRef.current) {
        try { sourceNodeRef.current.stop(); } catch (e) {}
      }
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      playNode(elapsedTimeRef.current);
    }
  };

  const handleToggleCut = () => {
    initAudio();
    const newCut = !isCutEnabled;
    let newOffset = elapsedTimeRef.current;

    // Splicing time mapping logic
    if (newCut) {
      // original (8s) -> processed (5.5s)
      if (newOffset < 1.5) {
        // seg1
      } else if (newOffset >= 1.5 && newOffset <= 2.3) {
        newOffset = 1.5;
      } else if (newOffset > 2.3 && newOffset < 4.2) {
        newOffset = newOffset - 0.8;
      } else if (newOffset >= 4.2 && newOffset <= 5.2) {
        newOffset = 3.4;
      } else if (newOffset > 5.2 && newOffset < 6.7) {
        newOffset = newOffset - 1.8;
      } else if (newOffset >= 6.7 && newOffset <= 7.4) {
        newOffset = 4.9;
      } else {
        newOffset = newOffset - 2.5;
      }
    } else {
      // processed (5.5s) -> original (8s)
      if (newOffset < 1.5) {
        // seg1
      } else if (newOffset >= 1.5 && newOffset < 3.4) {
        newOffset = newOffset + 0.8;
      } else if (newOffset >= 3.4 && newOffset < 4.9) {
        newOffset = newOffset + 1.8;
      } else {
        newOffset = newOffset + 2.5;
      }
    }

    const duration = newCut ? 5.5 : 8.0;
    if (newOffset >= duration) newOffset = 0;

    setIsCutEnabled(newCut);
    elapsedTimeRef.current = newOffset;
    setCurrentTime(newOffset);

    if (isPlaying) {
      setTimeout(() => {
        playNode(newOffset);
      }, 0);
    }
  };

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (sourceNodeRef.current) {
        try { sourceNodeRef.current.stop(); } catch (e) {}
      }
    };
  }, []);

  // Format Elapsed / Total
  const formatMockTime = (time: number, isCut: boolean) => {
    const origDuration = 8.0;
    const procDuration = 5.5;
    const mockMaxSecs = isCut ? 5 * 60 + 28 : 8 * 60 + 42; // 5:28 or 8:42
    const activeDuration = isCut ? procDuration : origDuration;
    
    const ratio = mockMaxSecs / activeDuration;
    const elapsedSecs = Math.min(mockMaxSecs, Math.floor(time * ratio));
    
    const m = Math.floor(elapsedSecs / 60);
    const s = Math.floor(elapsedSecs % 60);
    const totalM = Math.floor(mockMaxSecs / 60);
    const totalS = Math.floor(mockMaxSecs % 60);
    
    const pad = (val: number) => val < 10 ? `0${val}` : `${val}`;
    return `${m}:${pad(s)} / ${totalM}:${pad(totalS)}`;
  };

  const activeDuration = isCutEnabled ? 5.5 : 8.0;
  const percentComplete = (currentTime / activeDuration) * 100;

  // Waveform rendering
  const isIndexSilent = (i: number) => {
    return (i >= 15 && i <= 22) || (i >= 42 && i <= 51) || (i >= 67 && i <= 73);
  };

  // Compile list of active indices
  const activeIndices: number[] = [];
  for (let i = 0; i < 80; i++) {
    if (!isIndexSilent(i)) activeIndices.push(i);
  }

  return (
    <section className={styles.hero}>
      <div className={styles.heroBg} aria-hidden="true">
        <div className={styles.heroBgGlow1} />
        <div className={styles.heroBgGlow2} />
        <div className={styles.heroBgGrid} />
      </div>

      <div className={styles.heroContent}>
        <div className={styles.heroBadge}>
          <Zap size={12} />
          <span>100% Free · No Login Required · Privacy First</span>
        </div>

        <h1 className={styles.heroTitle}>
          Remove Dead Air<br />
          <span className={styles.heroAccent}>Automatically.</span>
        </h1>

        <p className={styles.heroSubtitle}>
          DecibelCut intelligently detects and removes silent gaps from your audio files.
          Podcasts, audiobooks, voice recordings — polished in seconds.
          Everything runs locally in your browser.
        </p>

        <div className={styles.heroCtas}>
          <Link to="/app" className={styles.ctaPrimary}>
            Start Editing Free
            <ArrowRight size={18} />
          </Link>
          <a href="#how-it-works" className={styles.ctaSecondary}>
            See how it works
          </a>
        </div>

        <p className={styles.ctaSubtext}>
          ⚡ No Account Required · Forever Free · 100% Private
        </p>

        <div className={styles.heroStats}>
          <div className={styles.heroStat}>
            <span className={styles.heroStatValue}>0 MB</span>
            <span className={styles.heroStatLabel}>uploaded to servers</span>
          </div>
          <div className={styles.heroStatDivider} />
          <div className={styles.heroStat}>
            <span className={styles.heroStatValue}>6</span>
            <span className={styles.heroStatLabel}>audio formats supported</span>
          </div>
          <div className={styles.heroStatDivider} />
          <div className={styles.heroStat}>
            <span className={styles.heroStatValue}>∞</span>
            <span className={styles.heroStatLabel}>files — always free</span>
          </div>
        </div>
      </div>

      {/* App Preview mockup */}
      <div className={styles.heroPreview} aria-label="App preview">
        <div className={styles.previewWindow}>
          <div className={styles.previewTitleBar}>
            <div className={styles.previewDots}>
              <span className={styles.dotRed} />
              <span className={styles.dotYellow} />
              <span className={styles.dotGreen} />
            </div>
            <span className={styles.previewTitle}>DecibelCut — podcast_episode_1.mp3</span>
          </div>
          <div className={styles.previewBody}>
            <div className={styles.previewWaveform}>
              {Array.from({ length: 80 }).map((_, i) => {
                const isSilent = isIndexSilent(i);
                const isCollapsed = isCutEnabled && isSilent;
                
                // Determine highlighting
                let isPlayed = false;
                if (!isSilent) {
                  if (isCutEnabled) {
                    const pos = activeIndices.indexOf(i);
                    isPlayed = pos <= (currentTime / 5.5) * 55;
                  } else {
                    isPlayed = i <= (currentTime / 8.0) * 80;
                  }
                } else {
                  isPlayed = i <= (currentTime / 8.0) * 80;
                }

                // Wave height formulation
                const waveHeight = 20 + Math.sin(i * 0.4) * 15 + Math.sin(i * 0.9) * 20;

                return (
                  <div
                    key={i}
                    className={[
                      styles.waveBar,
                      isSilent ? (isPlayed ? styles.waveBarSilencePlayed : styles.waveBarSilence) : (isPlayed ? styles.waveBarPlayed : ''),
                      isCollapsed ? styles.waveBarCollapsed : '',
                    ].filter(Boolean).join(' ')}
                    style={{
                      height: `${waveHeight}%`,
                    }}
                  />
                );
              })}
            </div>
            <div className={styles.previewControls}>
              <button 
                onClick={handlePlayToggle} 
                className={styles.previewCtrl}
                style={{ border: 'none', cursor: 'pointer' }}
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
              </button>
              
              <div className={styles.previewSeek}>
                <div className={styles.previewSeekFill} style={{ width: `${percentComplete}%` }} />
              </div>
              
              <span className={styles.previewTime}>
                {formatMockTime(currentTime, isCutEnabled)}
              </span>

              {/* Real-time Splicing Toggle */}
              <button 
                className={[styles.toggleBtn, isCutEnabled ? styles.toggleBtnActive : ''].join(' ')}
                onClick={handleToggleCut}
                title={isCutEnabled ? "Restore silent gaps" : "Cut silent gaps"}
              >
                <Zap size={11} className={styles.toggleIcon} />
                <span>Remove Dead Air</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// ---- Features ----
const FEATURES = [
  {
    icon: <Shield size={24} />,
    title: 'Privacy First',
    desc: 'All audio processing happens entirely in your browser. Your files never leave your device.',
    color: '#34d399',
  },
  {
    icon: <Zap size={24} />,
    title: 'Lightning Fast',
    desc: 'Web Audio API + WebAssembly delivers near-native processing speeds directly in the browser.',
    color: '#fbbf24',
  },
  {
    icon: <Wand2 size={24} />,
    title: 'Smart Detection',
    desc: 'RMS-based silence detection with configurable threshold, padding, and crossfade settings.',
    color: '#7c6ff7',
  },
  {
    icon: <Music size={24} />,
    title: 'Waveform Editor',
    desc: 'Interactive waveform with zoom, pan, region selection, undo/redo, and manual editing.',
    color: '#60a5fa',
  },
  {
    icon: <Layers size={24} />,
    title: 'Smart Presets',
    desc: 'Podcast, audiobook, and tight-music presets. Or dial in your exact settings.',
    color: '#f472b6',
  },
  {
    icon: <FileDown size={24} />,
    title: 'Lossless Export',
    desc: 'Export to MP3, WAV, or FLAC. Preserve audio quality. Download instantly.',
    color: '#fb923c',
  },
];

const Features: React.FC = () => (
  <section className={styles.features} id="features">
    <div className={styles.container}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionBadge}>Features</span>
        <h2 className={styles.sectionTitle}>Everything you need.<br />Nothing you don't.</h2>
        <p className={styles.sectionSubtitle}>
          Professional-grade audio editing tools, delivered entirely in your browser.
        </p>
      </div>

      <div className={styles.featureGrid}>
        {FEATURES.map((feature) => (
          <div key={feature.title} className={styles.featureCard}>
            <div className={styles.featureIconWrap} style={{ color: feature.color }}>
              {feature.icon}
            </div>
            <h3 className={styles.featureTitle}>{feature.title}</h3>
            <p className={styles.featureDesc}>{feature.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// ---- How It Works ----
const STEPS = [
  {
    num: '01',
    icon: <Headphones size={28} />,
    title: 'Drop Your File',
    desc: 'Drag and drop any audio file or browse from your computer. MP3, WAV, FLAC, AAC, OGG, and M4A all supported.',
  },
  {
    num: '02',
    icon: <Zap size={28} />,
    title: 'Detect Silence',
    desc: 'DecibelCut analyzes your audio and highlights all silent regions on the waveform. Fine-tune the detection settings.',
  },
  {
    num: '03',
    icon: <Scissors size={28} />,
    title: 'Review & Edit',
    desc: 'Preview the detected regions on the interactive waveform. Manually add or remove regions as needed.',
  },
  {
    num: '04',
    icon: <FileDown size={28} />,
    title: 'Export',
    desc: 'Process and download your clean audio in MP3, WAV, or FLAC. The whole pipeline runs in your browser.',
  },
];

const HowItWorks: React.FC = () => (
  <section className={styles.howItWorks} id="how-it-works">
    <div className={styles.container}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionBadge}>How It Works</span>
        <h2 className={styles.sectionTitle}>From noisy to polished<br />in four steps</h2>
      </div>

      <div className={styles.steps}>
        {STEPS.map((step, i) => (
          <div key={step.num} className={styles.step}>
            <div className={styles.stepNum}>{step.num}</div>
            <div className={styles.stepIcon}>{step.icon}</div>
            <h3 className={styles.stepTitle}>{step.title}</h3>
            <p className={styles.stepDesc}>{step.desc}</p>
            {i < STEPS.length - 1 && (
              <div className={styles.stepArrow} aria-hidden="true">→</div>
            )}
          </div>
        ))}
      </div>
    </div>
  </section>
);

// ---- FAQ ----
const FAQ_ITEMS = [
  {
    q: 'Is DecibelCut really free?',
    a: 'Yes — completely free, forever. No sign-up, no subscription, no limits on file count or duration.',
  },
  {
    q: 'Does my audio get uploaded to your servers?',
    a: 'No. DecibelCut runs entirely in your browser using Web Audio API and WebAssembly. Your audio files never leave your device.',
  },
  {
    q: 'What audio formats are supported?',
    a: 'Import: MP3, WAV, FLAC, AAC, OGG, M4A. Export: MP3, WAV, FLAC.',
  },
  {
    q: 'How does the silence detection work?',
    a: 'DecibelCut uses RMS (Root Mean Square) energy analysis to identify regions below your chosen dBFS threshold. You can tune the threshold, minimum silence duration, and buffer padding.',
  },
  {
    q: 'Will it damage my audio quality?',
    a: 'No. The processing uses the original audio data and applies gentle crossfades at each cut point to prevent clicks. Export to WAV or FLAC for lossless output.',
  },
  {
    q: 'Can I undo changes?',
    a: 'Yes. The waveform editor supports full undo/redo history (Ctrl+Z / Ctrl+Shift+Z). You can also restore your previous session after an accidental page refresh.',
  },
  {
    q: 'Does it work on large files?',
    a: 'Files up to 500MB are supported. Processing happens in memory so very large files may require a modern device with sufficient RAM.',
  },
  {
    q: 'Will DecibelCut get a desktop app?',
    a: 'Yes! The architecture is designed for Electron or Tauri packaging. A desktop version is planned.',
  },
];

const FAQItem: React.FC<{ q: string; a: string }> = ({ q, a }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className={[styles.faqItem, open ? styles.faqOpen : ''].filter(Boolean).join(' ')}>
      <button className={styles.faqQuestion} onClick={() => setOpen(!open)}>
        <span>{q}</span>
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      {open && <p className={styles.faqAnswer}>{a}</p>}
    </div>
  );
};

const FAQ: React.FC = () => (
  <section className={styles.faq} id="faq">
    <div className={styles.container}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionBadge}>FAQ</span>
        <h2 className={styles.sectionTitle}>Common questions</h2>
      </div>
      <div className={styles.faqList}>
        {FAQ_ITEMS.map((item) => (
          <FAQItem key={item.q} q={item.q} a={item.a} />
        ))}
      </div>
    </div>
  </section>
);

// ---- CTA Section ----
const CTASection: React.FC = () => (
  <section className={styles.cta}>
    <div className={styles.ctaGlow} aria-hidden="true" />
    <div className={styles.container}>
      <div className={styles.ctaContent}>
        <h2 className={styles.ctaTitle}>Ready to clean your audio?</h2>
        <p className={styles.ctaSubtitle}>No account needed. No file size limits. Always free.</p>
        <Link to="/app" className={styles.ctaPrimary}>
          Open DecibelCut Free
          <ArrowRight size={18} />
        </Link>
      </div>
    </div>
  </section>
);

// ---- Tools Section ----
const Tools: React.FC = () => (
  <section className={styles.features} style={{ borderTop: 'none', background: 'var(--color-bg-primary)', paddingBottom: '20px', paddingTop: '60px' }}>
    <div className={styles.container}>
      <div className={styles.sectionHeader} style={{ marginBottom: '36px' }}>
        <span className={styles.sectionBadge}>Tools</span>
        <h2 className={styles.sectionTitle}>🎬 DecibelCut Tools</h2>
        <p className={styles.sectionSubtitle}>
          Select one of our specialized, 100% client-side audio utilities.
        </p>
      </div>

      <div className={styles.featureGrid}>
        <Link to="/app" className={styles.featureCard} style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className={styles.featureIconWrap} style={{ color: '#7c6ff7' }}>
            <Scissors size={24} />
          </div>
          <h3 className={styles.featureTitle}>✂️ Silence Remover</h3>
          <p className={styles.featureDesc}>
            Intelligently scan audio files and remove silent gaps and dead air automatically. All processing runs locally in your browser.
          </p>
        </Link>

        <Link to="/extract-audio" className={styles.featureCard} style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className={styles.featureIconWrap} style={{ color: '#60a5fa' }}>
            <Video size={24} />
          </div>
          <h3 className={styles.featureTitle}>🎬 Extract Audio</h3>
          <p className={styles.featureDesc}>
            Upload any video format and extract its audio track in high-quality MP3, WAV, FLAC, and more in seconds.
          </p>
        </Link>

        <Link to="/creator-tools" className={styles.featureCard} style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className={styles.featureIconWrap} style={{ color: '#c084fc' }}>
            <Wand2 size={24} />
          </div>
          <h3 className={styles.featureTitle}>🎬 Creator Tools</h3>
          <p className={styles.featureDesc}>
            Optimize your audio for YouTube, TikTok, Spotify, and more. Features loudness normalization, denoiser, compressor, and batch export.
          </p>
        </Link>

        <Link to="/podcast-studio" className={styles.featureCard} style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className={styles.featureIconWrap} style={{ color: '#fb923c' }}>
            <Headphones size={24} />
          </div>
          <h3 className={styles.featureTitle}>🎙️ Podcast Studio</h3>
          <p className={styles.featureDesc}>
            A lightweight online DAW for podcasters. Multi-track editing, microphone recording, intro/outro library, and AI summaries.
          </p>
        </Link>
      </div>
    </div>
  </section>
);

// ---- Footer ----
const Footer: React.FC = () => (
  <footer className={styles.footer}>
    <div className={styles.container}>
      <div className={styles.footerContent}>
        <div className={styles.footerBrand}>
          <div className={styles.footerLogo}>
            <span>⚡</span>
            <span>DecibelCut</span>
          </div>
          <p className={styles.footerTagline}>Privacy-first audio silence remover</p>
        </div>

        <div className={styles.footerLinks}>
          <Link to="/app" className={styles.footerLink}>Silence Remover</Link>
          <Link to="/extract-audio" className={styles.footerLink}>Extract Audio</Link>
          <Link to="/creator-tools" className={styles.footerLink}>Creator Tools</Link>
          <Link to="/podcast-studio" className={styles.footerLink}>Podcast Studio</Link>
          <Link to="/about" className={styles.footerLink}>About</Link>
          <Link to="/privacy" className={styles.footerLink}>Privacy Policy</Link>
        </div>
      </div>
      <div className={styles.footerBottom}>
        <p>© {new Date().getFullYear()} DecibelCut. Built with ❤️ for creators.</p>
        <p className={styles.footerPrivacy}>All processing is client-side. Zero data collection.</p>
      </div>
    </div>
  </footer>
);

// ---- Navigation ----
const Nav: React.FC = () => (
  <nav className={styles.nav}>
    <div className={styles.navInner}>
      <Link to="/" className={styles.navLogo}>
        <span className={styles.navLogoMark}>⚡</span>
        <span>Decibel<strong>Cut</strong></span>
      </Link>
      <div className={styles.navLinks}>
        <Link to="/app" className={styles.navLink}>Silence Remover</Link>
        <Link to="/extract-audio" className={styles.navLink}>Extract Audio</Link>
        <Link to="/creator-tools" className={styles.navLink}>Creator Tools</Link>
        <Link to="/podcast-studio" className={styles.navLink}>Podcast Studio</Link>
        <Link to="/about" className={styles.navLink}>About</Link>
      </div>
      <Link to="/app" className={styles.navCta}>
        Open App
      </Link>
    </div>
  </nav>
);

// ---- Main Page ----
export const LandingPage: React.FC = () => {
  return (
    <div className={styles.page}>
      <Nav />
      
      {/* Side Skyscrapers */}
      <SkyscraperAd position="left" placement="skyscraperLeft" />
      <SkyscraperAd position="right" placement="skyscraperRight" />
      
      <Hero />
      <div className={styles.container}>
        <BannerAd placement="landingPageBelowHero" />
      </div>
      <Tools />
      <Features />
      <div className={styles.container}>
        <InContentAd placement="landingPageBetweenSections" />
      </div>
      <HowItWorks />
      <FAQ />
      <CTASection />
      <div className={styles.container} style={{ marginBottom: '32px' }}>
        <FooterAd placement="landingPageFooter" />
      </div>
      <Footer />
    </div>
  );
};
