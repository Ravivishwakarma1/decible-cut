import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, Lock, EyeOff, ServerOff, Database, Globe } from 'lucide-react';
import { InContentAd } from '../components/ads/AdComponents';
import styles from './PrivacyPolicyPage.module.css';
import { useSEO } from '../hooks/useSEO';

export const PrivacyPolicyPage: React.FC = () => {
  useSEO({
    title: 'Privacy Policy | DecibelCut',
    description: 'Read about our strict local-only, serverless data privacy commitment.'
  });
  return (
    <div className={styles.root}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <Link to="/" className={styles.backBtn}>
            <ArrowLeft size={16} />
            Back to Home
          </Link>
          <div className={styles.iconWrapper}>
            <Shield size={32} className={styles.shieldIcon} />
          </div>
          <h1 className={styles.title}>Privacy Policy</h1>
          <p className={styles.subtitle}>
            Privacy is not a setting — it is our core engineering foundation. DecibelCut is built on a 100% client-side execution model.
          </p>
        </div>

        {/* Philosophy Callout */}
        <section className={styles.philosophyCard}>
          <div className={styles.cardHeader}>
            <Lock size={20} className={styles.lockIcon} />
            <h3>Our Serverless Commitment</h3>
          </div>
          <p>
            DecibelCut was designed with one simple rule: <strong>Your data is yours alone.</strong> We do not host your files, we do not process your audio on remote servers, and we do not maintain databases of your content.
          </p>
        </section>

        {/* Content Sections */}
        <section className={styles.grid}>
          {/* Item 1 */}
          <div className={styles.card}>
            <div className={styles.cardIconWrapper}>
              <ServerOff size={22} className={styles.accentIcon} />
            </div>
            <h3 className={styles.cardTitle}>No File Uploads</h3>
            <p className={styles.cardText}>
              All audio decoding, silence scanning, and buffer stitching happen entirely on your computer's CPU and memory inside the browser sandbox. The server simply hosts static web page files; it has no mechanism to accept or receive media files.
            </p>
          </div>

          {/* Item 2 */}
          <div className={styles.card}>
            <div className={styles.cardIconWrapper}>
              <EyeOff size={22} className={styles.accentIcon} />
            </div>
            <h3 className={styles.cardTitle}>Zero Analytics Tracking</h3>
            <p className={styles.cardText}>
              We do not track your usage, use analytics (such as Google Analytics), or trace your audio files. Optional cookies and scripts are only loaded to serve advertisements if consent is explicitly granted.
            </p>
          </div>

          {/* Item 3 */}
          <div className={styles.card}>
            <div className={styles.cardIconWrapper}>
              <Database size={22} className={styles.accentIcon} />
            </div>
            <h3 className={styles.cardTitle}>No Login Required</h3>
            <p className={styles.cardText}>
              There are no accounts, subscriptions, or login forms. You can use all active features immediately without disclosing your name, email, or identity. No account database exists.
            </p>
          </div>

          {/* Item 4 */}
          <div className={styles.card}>
            <div className={styles.cardIconWrapper}>
              <Globe size={22} className={styles.accentIcon} />
            </div>
            <h3 className={styles.cardTitle}>Fully Offline Operation</h3>
            <p className={styles.cardText}>
              Once the web app is loaded in your browser, you can disconnect your internet entirely. The silence removal engine, audio visualizer, and export wrappers will continue to function 100% offline.
            </p>
          </div>
        </section>

        {/* Detailed Terms */}
        <section className={styles.detailedSection}>
          <h2 className={styles.sectionTitle}>Technical Details</h2>
          <div className={styles.detailsList}>
            <div className={styles.detailItem}>
              <h4>WebAudio API Sandbox</h4>
              <p>
                Your browser manages all raw audio buffers locally. Memory allocated for rendering waveforms is automatically freed as soon as you close the browser tab or clear the active file.
              </p>
            </div>
            <div className={styles.detailItem}>
              <h4>WebAssembly FFmpeg</h4>
              <p>
                To provide audio export configurations (MP3, WAV, FLAC), we use a compiled client-side binary of FFmpeg. Encoding instructions execute inside a separate browser worker thread, ensuring your operating system is isolated from vulnerability risks.
              </p>
            </div>
            <div className={styles.detailItem}>
              <h4>Local Storage Sessions</h4>
              <p>
                We use browser <code>localStorage</code> solely to save your recent editing preferences (like silence threshold settings and zoom scale) so you don't lose them on page refresh. This data is never sent to the internet and stays on your local machine.
              </p>
            </div>
            <div className={styles.detailItem}>
              <h4>Third-Party Advertising (Google AdSense)</h4>
              <p>
                We integrate Google AdSense to serve advertisements on our platform. Third-party vendors, including Google, use cookies to serve ads based on your prior visits to this or other websites. By utilizing our Consent Banner, you can choose to enable personalized advertising or default to non-personalized ad requests (which do not use tracking cookies for personalization). You may also manage cookie preferences through your Google Ad Settings.
              </p>
            </div>
          </div>
        </section>

        {/* Ad Placement */}
        <InContentAd placement="privacyPageBottom" />

        {/* Footer info */}
        <div className={styles.policyFooter}>
          <p>DecibelCut is open source. You can inspect our full codebase, verify our serverless claim, or self-host your own instance at any time.</p>
          <div className={styles.lastUpdated}>
            <span>Last updated: July 2026</span>
          </div>
        </div>
      </div>
    </div>
  );
};
