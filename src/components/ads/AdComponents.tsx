import React, { useEffect, useRef, useState } from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import { adsConfig } from '../../config/adsConfig';
import { isGoogleBot } from '../../utils/isBot';
import styles from './AdComponents.module.css';

// Hardcoded Adsterra keys from user credentials with ENV overrides support
const ADSTERRA_KEYS = {
  banner728x90: import.meta.env.VITE_ADSTERRA_BANNER_728X90_KEY || '056b6f5b3ac5c5bc005547a1f1613d40',
  banner468x60: import.meta.env.VITE_ADSTERRA_BANNER_468X60_KEY || '226bace1e54678172826b6b6ead8de18',
  banner320x50: import.meta.env.VITE_ADSTERRA_BANNER_320X50_KEY || '49c9458e067fbd8394bfda295098c2d1',
  banner300x250: import.meta.env.VITE_ADSTERRA_BANNER_300X250_KEY || '6c75334892ff43485a022d7a91878b44',
  skyscraper160x600: import.meta.env.VITE_ADSTERRA_SKYSCRAPER_160X600_KEY || '8e8c7d94759d4be3798d8aa3231a7bd1',
  nativeScriptUrl: import.meta.env.VITE_ADSTERRA_NATIVE_SCRIPT_URL || 'https://pl30400569.effectivecpmnetwork.com/109a725aaed601a96fb86f6cdf66a947/invoke.js',
  nativeContainerId: import.meta.env.VITE_ADSTERRA_NATIVE_CONTAINER_ID || 'container-109a725aaed601a96fb86f6cdf66a947'
};

// Check if running in development mode (local)
const isDevMode = (): boolean => {
  return import.meta.env.DEV;
};

// Custom hook to detect window size for responsive ads
const useWindowWidth = () => {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return width;
};

interface AdContainerProps {
  placement: keyof typeof adsConfig.placements;
  width: number;
  height: number;
  adKey: string;
  adType: string;
  style?: React.CSSProperties;
}

// Bulletproof Ad Container using isolated iframe to prevent script collisions & global window.atOptions conflicts
const AdContainer: React.FC<AdContainerProps> = ({
  placement,
  width,
  height,
  adKey,
  adType,
  style
}) => {
  const adConsent = useSettingsStore((s) => s.adConsent);
  const enabled = adsConfig.enabled && adsConfig.placements[placement];
  const isBot = isGoogleBot();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    if (enabled && (adConsent !== 'undecided' || isBot) && iframeRef.current && adKey) {
      const iframe = iframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { margin: 0; padding: 0; overflow: hidden; background: transparent; display: flex; justify-content: center; align-items: center; }
              </style>
            </head>
            <body>
              <script type="text/javascript">
                var atOptions = {
                  'key' : '${adKey}',
                  'format' : 'iframe',
                  'height' : ${height},
                  'width' : ${width},
                  'params' : {}
                };
              </script>
              <script type="text/javascript" src="https://www.highperformanceformat.com/${adKey}/invoke.js"></script>
            </body>
          </html>
        `);
        doc.close();
      }
    }
  }, [enabled, adConsent, isBot, adKey, width, height]);

  if (!enabled) return null;

  // Render placeholder in Dev Mode or if consent is undecided (loading/waiting)
  if (isDevMode() || (adConsent === 'undecided' && !isBot)) {
    return (
      <div 
        className={styles.placeholder} 
        style={{ minHeight: `${height}px`, width: style?.width || `${width}px`, ...style }}
      >
        <div className={styles.placeholderBadge}>Advertisement</div>
        <div className={styles.placeholderLabel}>Adsterra Placeholder (${width}x${height} - ${adType})</div>
        {adConsent === 'undecided' && (
          <div className={styles.consentNotice}>Awaiting privacy consent...</div>
        )}
      </div>
    );
  }

  // Render actual Adsterra unit in Production
  return (
    <div 
      className={styles.adWrapper} 
      style={{ minHeight: `${height + 18}px`, ...style }}
    >
      <div className={styles.label}>Advertisement</div>
      <iframe
        ref={iframeRef}
        title={`Adsterra Ad ${adType}`}
        width={width}
        height={height}
        frameBorder="0"
        scrolling="no"
        style={{ border: 'none', overflow: 'hidden', display: 'block', margin: '0 auto' }}
      />
    </div>
  );
};

// Component to handle Adsterra Native Banner
const NativeAdContainer: React.FC<{ placement: keyof typeof adsConfig.placements }> = ({ placement }) => {
  const adConsent = useSettingsStore((s) => s.adConsent);
  const enabled = adsConfig.enabled && adsConfig.placements[placement];
  const isBot = isGoogleBot();
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (enabled && (adConsent !== 'undecided' || isBot)) {
      const container = document.getElementById(ADSTERRA_KEYS.nativeContainerId);
      if (container) {
        container.innerHTML = '';
        const script = document.createElement('script');
        script.src = ADSTERRA_KEYS.nativeScriptUrl;
        script.async = true;
        script.setAttribute('data-cfasync', 'false');
        container.appendChild(script);
      }
    }
  }, [enabled, adConsent, isBot]);

  if (!enabled) return null;

  if (isDevMode() || (adConsent === 'undecided' && !isBot)) {
    return (
      <div className={styles.placeholder} style={{ minHeight: '120px' }}>
        <div className={styles.placeholderBadge}>Advertisement</div>
        <div className={styles.placeholderLabel}>Adsterra Native Banner (Recommendations)</div>
        {adConsent === 'undecided' && (
          <div className={styles.consentNotice}>Awaiting privacy consent...</div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.adWrapper} style={{ minHeight: '120px', margin: '20px auto' }}>
      <div className={styles.label}>Advertisement</div>
      <div id={ADSTERRA_KEYS.nativeContainerId} ref={containerRef} style={{ width: '100%', minHeight: '90px' }} />
    </div>
  );
};

// --- Exports matching original components ---

// BannerAd: Responsive Leaderboard Banner
export const BannerAd: React.FC<{ placement: keyof typeof adsConfig.placements }> = ({
  placement
}) => {
  const width = useWindowWidth();

  let adKey = ADSTERRA_KEYS.banner728x90;
  let adWidth = 728;
  let adHeight = 90;
  let adName = 'Leaderboard 728x90';

  if (width < 480) {
    adKey = ADSTERRA_KEYS.banner320x50;
    adWidth = 320;
    adHeight = 50;
    adName = 'Mobile Banner 320x50';
  } else if (width < 768) {
    adKey = ADSTERRA_KEYS.banner468x60;
    adWidth = 468;
    adHeight = 60;
    adName = 'Tablet Banner 468x60';
  }

  return (
    <AdContainer
      placement={placement}
      width={adWidth}
      height={adHeight}
      adKey={adKey}
      adType={adName}
    />
  );
};

// InContentAd: Square Content Card
export const InContentAd: React.FC<{ 
  placement: keyof typeof adsConfig.placements; 
  style?: React.CSSProperties; 
}> = ({
  placement,
  style
}) => (
  <AdContainer
    placement={placement}
    width={300}
    height={250}
    adKey={ADSTERRA_KEYS.banner300x250}
    adType="Content Card 300x250"
    style={{ maxWidth: '728px', margin: '20px auto', ...style }}
  />
);

// FooterAd: Utilizes the Native Banner Recommendations Widget
export const FooterAd: React.FC<{ placement: keyof typeof adsConfig.placements }> = ({
  placement
}) => (
  <NativeAdContainer placement={placement} />
);

// SkyscraperAd: Tall vertical side banner
export const SkyscraperAd: React.FC<{ 
  placement: keyof typeof adsConfig.placements; 
  position: 'left' | 'right'; 
}> = ({
  placement,
  position
}) => {
  const containerClass = position === 'left' ? styles.skyscraperLeft : styles.skyscraperRight;
  return (
    <div className={containerClass}>
      <AdContainer
        placement={placement}
        width={160}
        height={600}
        adKey={ADSTERRA_KEYS.skyscraper160x600}
        adType={`Skyscraper 160x600 - ${position.toUpperCase()}`}
        style={{ width: '160px', height: '600px' }}
      />
    </div>
  );
};
