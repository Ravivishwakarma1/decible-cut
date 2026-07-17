import React, { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from './router';
import { useSettingsStore } from './store/settingsStore';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { ConsentBanner } from './components/ads/ConsentBanner';
import { isGoogleBot } from './utils/isBot';
import { adsConfig } from './config/adsConfig';
import './styles/globals.css';

export const App: React.FC = () => {
  const theme = useSettingsStore((s) => s.theme);
  const adConsent = useSettingsStore((s) => s.adConsent);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      root.setAttribute('data-theme', theme);
    }
  }, [theme]);

  // Dynamically load Adsterra global scripts (Popunder & Social Banner) depending on consent
  useEffect(() => {
    const isBot = isGoogleBot();
    const shouldLoadAds = 
      !import.meta.env.DEV && 
      adsConfig.enabled && 
      (adConsent !== 'undecided' || isBot);

    if (shouldLoadAds) {
      // 1. Popunder Script
      const popunderUrl = 'https://pl30400568.effectivecpmnetwork.com/b7/9e/a5/b79ea502d19af7e39fb2c69c1a486c0b.js';
      const existingPopunder = document.querySelector(`script[src="${popunderUrl}"]`);
      if (!existingPopunder) {
        const script = document.createElement('script');
        script.src = popunderUrl;
        script.async = true;
        script.crossOrigin = 'anonymous';
        document.head.appendChild(script);
      }

      // 2. Social Banner Script
      const socialUrl = 'https://pl30400570.effectivecpmnetwork.com/f0/ba/8a/f0ba8ab934bc6140b822ec2ae111fe1f.js';
      const existingSocial = document.querySelector(`script[src="${socialUrl}"]`);
      if (!existingSocial) {
        const script = document.createElement('script');
        script.src = socialUrl;
        script.async = true;
        script.crossOrigin = 'anonymous';
        document.head.appendChild(script);
      }
    }
  }, [adConsent]);

  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AppRouter />
        <ConsentBanner />
      </ErrorBoundary>
    </BrowserRouter>
  );
};
