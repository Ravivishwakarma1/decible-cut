import rawConfig from './seoConfig.json';

export interface SEOConfig {
  siteUrl: string;
  defaultTitle: string;
  defaultDescription: string;
  defaultKeywords: string[];
  verification: {
    google?: string;
    bing?: string;
    yandex?: string;
    naver?: string;
    seznam?: string;
  };
  verificationFiles: Array<{
    filename: string;
    content: string;
  }>;
  analytics: {
    googleAnalyticsId?: string;
    clarityProjectId?: string;
  };
}

export const seoConfig: SEOConfig = {
  ...rawConfig,
  verification: {
    google: import.meta.env.VITE_GOOGLE_VERIFICATION || rawConfig.verification.google,
    bing: import.meta.env.VITE_BING_VERIFICATION || rawConfig.verification.bing,
    yandex: import.meta.env.VITE_YANDEX_VERIFICATION || rawConfig.verification.yandex,
    naver: import.meta.env.VITE_NAVER_VERIFICATION || rawConfig.verification.naver,
    seznam: import.meta.env.VITE_SEZNAM_VERIFICATION || rawConfig.verification.seznam,
  },
  analytics: {
    googleAnalyticsId: import.meta.env.VITE_GA4_TRACKING_ID || rawConfig.analytics.googleAnalyticsId,
    clarityProjectId: import.meta.env.VITE_CLARITY_PROJECT_ID || rawConfig.analytics.clarityProjectId,
  }
};
