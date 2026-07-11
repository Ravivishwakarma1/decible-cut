import React, { useEffect } from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import { adsConfig } from '../../config/adsConfig';
import styles from './AdComponents.module.css';

// Read env variables
const getPublisherId = (): string | null => {
  return (
    import.meta.env.VITE_GOOGLE_ADSENSE_ID || 
    import.meta.env.NEXT_PUBLIC_GOOGLE_ADSENSE_ID || 
    'ca-pub-6264045340585631'
  );
};

// Check if running in development mode (local)
const isDevMode = (): boolean => {
  return import.meta.env.DEV || !getPublisherId();
};

interface AdProps {
  placement: keyof typeof adsConfig.placements;
  slot: string;
  format?: 'auto' | 'fluid' | 'rectangle';
  style?: React.CSSProperties;
}

const AdContainer: React.FC<AdProps & { adType: string; placeholderHeight: number }> = ({
  placement,
  slot,
  format = 'auto',
  style,
  adType,
  placeholderHeight
}) => {
  const adConsent = useSettingsStore((s) => s.adConsent);
  const enabled = adsConfig.enabled && adsConfig.placements[placement];
  const publisherId = getPublisherId();

  useEffect(() => {
    if (!isDevMode() && enabled && adConsent !== 'undecided') {
      try {
        const adsbygoogle = (window as any).adsbygoogle || [];
        adsbygoogle.push({});
      } catch (e) {
        console.error('AdSense initialization error:', e);
      }
    }
  }, [enabled, adConsent]);

  if (!enabled) return null;

  // Render placeholder in Dev Mode or if consent is undecided (loading/waiting)
  if (isDevMode() || adConsent === 'undecided') {
    return (
      <div 
        className={styles.placeholder} 
        style={{ minHeight: `${placeholderHeight}px`, ...style }}
      >
        <div className={styles.placeholderBadge}>Advertisement</div>
        <div className={styles.placeholderLabel}>Google Ad Placeholder ({adType})</div>
        {adConsent === 'undecided' && (
          <div className={styles.consentNotice}>Awaiting privacy consent...</div>
        )}
      </div>
    );
  }

  // Render actual AdSense unit in Production Vercel Mode
  return (
    <div 
      className={styles.adWrapper} 
      style={{ minHeight: `${placeholderHeight}px`, ...style }}
    >
      <div className={styles.label}>Advertisement</div>
      <ins
        className="adsbygoogle"
        style={{ display: 'block', ...style }}
        data-ad-client={publisherId || ''}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
        data-request-non-personalized-ads={adConsent === 'denied' ? '1' : '0'}
      />
    </div>
  );
};

export const BannerAd: React.FC<{ placement: keyof typeof adsConfig.placements; slot?: string }> = ({
  placement,
  slot = '1234567890'
}) => (
  <AdContainer
    placement={placement}
    slot={slot}
    format="auto"
    adType="Banner 728x90"
    placeholderHeight={90}
  />
);

export const InContentAd: React.FC<{ placement: keyof typeof adsConfig.placements; slot?: string; style?: React.CSSProperties }> = ({
  placement,
  slot = '2345678901',
  style
}) => (
  <AdContainer
    placement={placement}
    slot={slot}
    format="rectangle"
    adType="Content Card 300x250"
    placeholderHeight={250}
    style={{ maxWidth: '728px', margin: '20px auto', ...style }}
  />
);

export const FooterAd: React.FC<{ placement: keyof typeof adsConfig.placements; slot?: string }> = ({
  placement,
  slot = '3456789012'
}) => (
  <AdContainer
    placement={placement}
    slot={slot}
    format="auto"
    adType="Footer Banner 970x90"
    placeholderHeight={90}
  />
);

export const SkyscraperAd: React.FC<{ placement: keyof typeof adsConfig.placements; position: 'left' | 'right'; slot?: string }> = ({
  placement,
  position,
  slot = '4567890123'
}) => {
  const containerClass = position === 'left' ? styles.skyscraperLeft : styles.skyscraperRight;
  return (
    <div className={containerClass}>
      <AdContainer
        placement={placement}
        slot={slot}
        format="auto"
        adType={`Skyscraper 160x600 - ${position.toUpperCase()}`}
        placeholderHeight={600}
        style={{ width: '160px', height: '600px' }}
      />
    </div>
  );
};
