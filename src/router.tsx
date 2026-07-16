import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { AppPage } from './pages/AppPage';
import { SettingsPage } from './pages/SettingsPage';
import { AboutPage } from './pages/AboutPage';
import { VideoAudioPage } from './pages/VideoAudioPage';
import { CreatorToolsPage } from './pages/CreatorToolsPage';
import { PodcastCreatorStudioPage } from './pages/PodcastCreatorStudioPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { SupportPage } from './pages/SupportPage';
import { AdminInboxPage } from './pages/AdminInboxPage';
import { AdminLoginPage } from './pages/AdminLoginPage';

export const AppRouter: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/app" element={<AppPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/extract-audio" element={<VideoAudioPage />} />
      <Route path="/creator-tools" element={<CreatorToolsPage />} />
      <Route path="/podcast-studio" element={<PodcastCreatorStudioPage />} />
      <Route path="/privacy" element={<PrivacyPolicyPage />} />
      <Route path="/support" element={<SupportPage />} />
      <Route path="/admin" element={<AdminLoginPage />} />
      <Route path="/admin/inbox" element={<AdminInboxPage />} />
    </Routes>
  );
};

