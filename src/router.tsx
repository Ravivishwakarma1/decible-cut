import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { AppPage } from './pages/AppPage';
import { SettingsPage } from './pages/SettingsPage';
import { AboutPage } from './pages/AboutPage';
import { VideoAudioPage } from './pages/VideoAudioPage';
import { ComingSoonPage } from './pages/ComingSoonPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';

export const AppRouter: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/app" element={<AppPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/extract-audio" element={<VideoAudioPage />} />
      <Route path="/creator-tools" element={<ComingSoonPage tool="creator" />} />
      <Route path="/podcast-studio" element={<ComingSoonPage tool="podcast" />} />
      <Route path="/privacy" element={<PrivacyPolicyPage />} />
    </Routes>
  );
};

