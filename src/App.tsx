import React, { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from './router';
import { useSettingsStore } from './store/settingsStore';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { ConsentBanner } from './components/ads/ConsentBanner';
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

  // Dynamically load Google AdSense script depending on consent
  useEffect(() => {
    const publisherId = 
      import.meta.env.VITE_GOOGLE_ADSENSE_ID || 
      import.meta.env.NEXT_PUBLIC_GOOGLE_ADSENSE_ID ||
      'ca-pub-6264045340585631';

    // Load only in production mode when consent is decided (either granted or denied)
    const shouldLoadAdSense = 
      !import.meta.env.DEV && 
      publisherId && 
      adConsent !== 'undecided';

    if (shouldLoadAdSense) {
      const existingScript = document.querySelector('script[src*="pagead2.googlesyndication.com"]');
      if (!existingScript) {
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisherId}`;
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
