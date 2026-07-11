export const isGoogleBot = (): boolean => {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent.toLowerCase();
  return (
    ua.includes('googlebot') ||
    ua.includes('mediapartners-google') ||
    ua.includes('adsbot-google') ||
    ua.includes('google-adwords')
  );
};
