export interface AdsConfig {
  enabled: boolean; // Global switch to turn off all ads
  placements: {
    landingPageBelowHero: boolean;
    landingPageBetweenSections: boolean;
    landingPageFooter: boolean;
    aboutPageBottom: boolean;
    privacyPageBottom: boolean;
    comingSoonPageBottom: boolean;
    skyscraperLeft: boolean;
    skyscraperRight: boolean;
  };
}

export const adsConfig: AdsConfig = {
  enabled: true, // Master ad toggle
  placements: {
    landingPageBelowHero: true,
    landingPageBetweenSections: true,
    landingPageFooter: true,
    aboutPageBottom: true,
    privacyPageBottom: true,
    comingSoonPageBottom: true,
    skyscraperLeft: true,
    skyscraperRight: true,
  },
};
