import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Zap, Sliders, Volume2, Layers, Mic, Headphones,
  Sparkles, Music, ArrowLeft, Check, Mail, ArrowRight,
  Clock, Play, AlertCircle
} from 'lucide-react';
import { InContentAd } from '../components/ads/AdComponents';
import styles from './ComingSoonPage.module.css';

interface ComingSoonPageProps {
  tool: 'creator' | 'podcast';
}

interface FeatureInfo {
  icon: React.ReactNode;
  title: string;
  desc: string;
}

export const ComingSoonPage: React.FC<ComingSoonPageProps> = ({ tool }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [error, setError] = useState('');

  const isCreator = tool === 'creator';

  const toolDetails = {
    title: isCreator ? 'Creator Tools' : 'Podcast Studio',
    tagline: isCreator 
      ? 'Power up your content for YouTube, Spotify, and TikTok.'
      : 'Your browser-based podcast production suite.',
    description: isCreator
      ? 'A full suite of smart, client-side tools designed to normalize, denoise, compress, and master your audio tracks in seconds. Everything runs 100% locally in your browser with zero server uploads.'
      : 'A lightweight multi-track DAW designed specifically for podcasters. Record high-quality audio, arrange tracks, apply intros/outros, and auto-generate AI show notes — all inside your web browser.',
    badge: isCreator ? 'Mastering & Optimization' : 'Multi-track DAW Editor',
    releaseTimeline: 'Releasing Q3 2026',
  };

  const creatorFeatures: FeatureInfo[] = [
    {
      icon: <Sliders className={styles.featureIcon} size={24} />,
      title: 'Loudness Normalization',
      desc: 'Target exact LUFS/dBTP standards for Spotify, YouTube, Apple Podcasts, and TikTok automatically.',
    },
    {
      icon: <Volume2 className={styles.featureIcon} size={24} />,
      title: 'Denoise & Noise Gate',
      desc: 'Surgically isolate vocals and remove background hiss, AC hum, and fan noises using client-side WebAssembly.',
    },
    {
      icon: <Sparkles className={styles.featureIcon} size={24} />,
      title: 'Voice Compressor',
      desc: 'Add broadcast warmth and control dynamics with a custom multiband compressor tuned for voiceovers.',
    },
    {
      icon: <Layers className={styles.featureIcon} size={24} />,
      title: 'Batch Optimization',
      desc: 'Drag, drop, and process dozens of files simultaneously with custom presets. Save hours on repetitive editing.',
    },
  ];

  const podcastFeatures: FeatureInfo[] = [
    {
      icon: <Layers className={styles.featureIcon} size={24} />,
      title: 'Multi-Track Timeline',
      desc: 'Seamlessly layer, split, trim, and arrange voice recordings, intro/outro music, and ambient sound effects.',
    },
    {
      icon: <Mic className={styles.featureIcon} size={24} />,
      title: 'Live Audio Recording',
      desc: 'Record studio-grade audio directly inside your browser with live level meters, gain controls, and safe clipping protection.',
    },
    {
      icon: <Music className={styles.featureIcon} size={24} />,
      title: 'Sfx & Music Library',
      desc: 'Access preloaded royalty-free transitional music, stingers, sound effects, and bumper packages in a few clicks.',
    },
    {
      icon: <Sparkles className={styles.featureIcon} size={24} />,
      title: 'AI Chapter & Show Notes',
      desc: 'Transcribe recordings locally and automatically generate structured episode chapters, show notes, and teaser descriptions.',
    },
  ];

  const features = isCreator ? creatorFeatures : podcastFeatures;

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address.');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setError('');
    setLoading(true);

    // Simulate server subscription
    setTimeout(() => {
      setLoading(false);
      setSubscribed(true);
      setEmail('');
    }, 1200);
  };

  return (
    <div className={styles.page}>
      {/* Background visual graphics */}
      <div className={styles.glowBg} aria-hidden="true">
        <div className={styles.glow1} />
        <div className={styles.glow2} />
        <div className={styles.glowGrid} />
      </div>

      {/* Navigation Header */}
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <Link to="/" className={styles.navLogo}>
            <span className={styles.navLogoMark}>⚡</span>
            <span>Decibel<strong>Cut</strong></span>
          </Link>
          <div className={styles.navLinks}>
            <Link to="/app" className={styles.navLink}>Silence Remover</Link>
            <Link to="/extract-audio" className={styles.navLink}>Extract Audio</Link>
            <Link to="/creator-tools" className={[styles.navLink, isCreator ? styles.navLinkActive : ''].join(' ')}>Creator Tools</Link>
            <Link to="/podcast-studio" className={[styles.navLink, !isCreator ? styles.navLinkActive : ''].join(' ')}>Podcast Studio</Link>
            <Link to="/about" className={styles.navLink}>About</Link>
          </div>
          <Link to="/app" className={styles.navCta}>
            Open App
          </Link>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className={styles.container}>
        <div className={styles.backBtnWrap}>
          <Link to="/" className={styles.backBtn}>
            <ArrowLeft size={16} />
            <span>Back to home</span>
          </Link>
        </div>

        {/* Hero Section */}
        <section className={styles.hero}>
          <div className={styles.badge}>
            <Clock size={12} className={styles.badgeIcon} />
            <span>{toolDetails.badge}</span>
          </div>

          <h1 className={styles.title}>
            {toolDetails.title} is <span className={styles.accentText}>Coming Soon</span>
          </h1>

          <p className={styles.tagline}>{toolDetails.tagline}</p>
          <p className={styles.description}>{toolDetails.description}</p>

          {/* Interactive Subscribe Box */}
          <div className={styles.subscribeCard}>
            {!subscribed ? (
              <form onSubmit={handleSubscribe} className={styles.form}>
                <div className={styles.formTitleGroup}>
                  <Mail size={16} className={styles.mailIcon} />
                  <h3>Get early access & updates</h3>
                </div>
                <p className={styles.formDesc}>Be the first to test {toolDetails.title} when our beta releases.</p>
                <div className={styles.inputGroup}>
                  <div className={styles.inputWrapper}>
                    <input
                      type="email"
                      placeholder="Enter your email address"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError('');
                      }}
                      className={styles.input}
                      disabled={loading}
                    />
                  </div>
                  <button type="submit" className={styles.submitBtn} disabled={loading}>
                    {loading ? (
                      <span className={styles.spinner} />
                    ) : (
                      <>
                        <span>Notify Me</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </div>
                {error && (
                  <div className={styles.errorMsg}>
                    <AlertCircle size={14} />
                    <span>{error}</span>
                  </div>
                )}
              </form>
            ) : (
              <div className={styles.successBlock}>
                <div className={styles.successIconWrapper}>
                  <Check size={28} className={styles.checkIcon} />
                </div>
                <h3 className={styles.successTitle}>You're on the list!</h3>
                <p className={styles.successDesc}>
                  Thanks for subscribing. We will send updates and beta invitations directly to your email.
                </p>
                <button onClick={() => setSubscribed(false)} className={styles.resetBtn}>
                  Change email address
                </button>
              </div>
            )}
          </div>
        </section>

        {/* What to Expect Features Section */}
        <section className={styles.featuresSection}>
          <div className={styles.featuresHeader}>
            <h2>What to expect</h2>
            <p>Here is what we are building for the initial launch</p>
          </div>

          <div className={styles.featuresGrid}>
            {features.map((feature, idx) => (
              <div key={idx} className={styles.featureCard}>
                <div className={styles.featureIconContainer}>
                  {feature.icon}
                </div>
                <h3 className={styles.featureTitle}>{feature.title}</h3>
                <p className={styles.featureDesc}>{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Redirect Options */}
        <section className={styles.redirectSection}>
          <h2 className={styles.redirectTitle}>Need to process audio right now?</h2>
          <p className={styles.redirectSubtitle}>
            Our main tools are fully active, running local processing in your browser.
          </p>
          <div className={styles.redirectBtns}>
            <Link to="/app" className={styles.primaryCta}>
              <Zap size={16} />
              <span>Use Silence Remover</span>
            </Link>
            <Link to="/extract-audio" className={styles.secondaryCta}>
              <Play size={16} />
              <span>Extract Audio from Video</span>
            </Link>
          </div>
        </section>
      </main>

      {/* Ad Placement */}
      <div className={styles.container} style={{ paddingBottom: '40px' }}>
        <InContentAd placement="comingSoonPageBottom" />
      </div>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <p>© {new Date().getFullYear()} DecibelCut. Built with ❤️ for creators.</p>
          <p className={styles.footerPrivacy}>
            All processing is client-side · <Link to="/privacy" style={{ color: 'inherit', textDecoration: 'underline' }}>Privacy Policy</Link>
          </p>
        </div>
      </footer>
    </div>
  );
};
