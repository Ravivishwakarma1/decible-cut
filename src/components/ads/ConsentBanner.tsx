import React from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import { ShieldAlert, Cookie, Check, X } from 'lucide-react';
import styles from './ConsentBanner.module.css';

export const ConsentBanner: React.FC = () => {
  const adConsent = useSettingsStore((s) => s.adConsent);
  const setAdConsent = useSettingsStore((s) => s.setAdConsent);

  if (adConsent !== 'undecided') return null;

  return (
    <div className={styles.banner} role="alert" aria-live="polite">
      <div className={styles.content}>
        <div className={styles.iconWrapper}>
          <Cookie size={20} className={styles.cookieIcon} />
        </div>
        <div className={styles.textGroup}>
          <h4 className={styles.title}>We value your privacy</h4>
          <p className={styles.desc}>
            DecibelCut uses essential local scripts to process your audio 100% privately in your browser. We also display responsive ads to keep the project completely free. Choose whether you accept personalized cookies and scripts.
          </p>
        </div>
      </div>
      <div className={styles.actions}>
        <button 
          onClick={() => setAdConsent('denied')} 
          className={styles.rejectBtn}
          title="Opt-out of personalized tracking ads"
        >
          <X size={14} />
          <span>Reject / Non-Personalized</span>
        </button>
        <button 
          onClick={() => setAdConsent('granted')} 
          className={styles.acceptBtn}
          title="Opt-in to personalized tracking ads"
        >
          <Check size={14} />
          <span>Accept Personalized Ads</span>
        </button>
      </div>
    </div>
  );
};
