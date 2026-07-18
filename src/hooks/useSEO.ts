import { useEffect } from 'react';
import { seoConfig } from '../config/seoConfig';

interface SEOProps {
  title: string;
  description?: string;
  keywords?: string[];
  canonical?: string;
  robots?: string;
  schemas?: object[];
}

export const useSEO = ({
  title,
  description = seoConfig.defaultDescription,
  keywords = seoConfig.defaultKeywords,
  canonical,
  robots = 'index, follow',
  schemas
}: SEOProps) => {
  useEffect(() => {
    // 1. Title
    const finalTitle = title ? `${title} | DecibelCut` : seoConfig.defaultTitle;
    document.title = finalTitle;

    // Helper to update/create meta tags
    const updateOrCreateMetaTag = (nameOrProperty: string, content: string, isProperty = false) => {
      const selector = isProperty 
        ? `meta[property="${nameOrProperty}"]` 
        : `meta[name="${nameOrProperty}"]`;
      let meta = document.querySelector(selector);
      if (!meta) {
        meta = document.createElement('meta');
        if (isProperty) {
          meta.setAttribute('property', nameOrProperty);
        } else {
          meta.setAttribute('name', nameOrProperty);
        }
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', content);
    };

    // 2. Meta description
    updateOrCreateMetaTag('description', description);

    // 3. Meta keywords
    if (keywords && keywords.length > 0) {
      updateOrCreateMetaTag('keywords', keywords.join(', '));
    }

    // 4. Robots
    updateOrCreateMetaTag('robots', robots);

    // 4b. Search Engine Verification Meta Tags
    if (seoConfig.verification.google) {
      updateOrCreateMetaTag('google-site-verification', seoConfig.verification.google);
    }
    if (seoConfig.verification.bing) {
      updateOrCreateMetaTag('msvalidate.01', seoConfig.verification.bing);
    }
    if (seoConfig.verification.yandex) {
      updateOrCreateMetaTag('yandex-verification', seoConfig.verification.yandex);
    }
    if (seoConfig.verification.naver) {
      updateOrCreateMetaTag('naver-site-verification', seoConfig.verification.naver);
    }
    if (seoConfig.verification.seznam) {
      updateOrCreateMetaTag('seznam-wverify', seoConfig.verification.seznam);
    }

    // 5. Canonical Link
    const canonicalUrl = canonical || (window.location.origin + window.location.pathname);
    let linkCanonical = document.querySelector('link[rel="canonical"]');
    if (!linkCanonical) {
      linkCanonical = document.createElement('link');
      linkCanonical.setAttribute('rel', 'canonical');
      document.head.appendChild(linkCanonical);
    }
    linkCanonical.setAttribute('href', canonicalUrl);

    // 6. Open Graph
    updateOrCreateMetaTag('og:title', finalTitle, true);
    updateOrCreateMetaTag('og:description', description, true);
    updateOrCreateMetaTag('og:url', canonicalUrl, true);
    updateOrCreateMetaTag('og:type', 'website', true);
    updateOrCreateMetaTag('og:image', `${seoConfig.siteUrl}/favicon.svg`, true);

    // 7. Twitter / X Cards
    updateOrCreateMetaTag('twitter:card', 'summary_large_image');
    updateOrCreateMetaTag('twitter:title', finalTitle);
    updateOrCreateMetaTag('twitter:description', description);
    updateOrCreateMetaTag('twitter:image', `${seoConfig.siteUrl}/favicon.svg`);

    // 8. JSON-LD Structured Data
    const scriptTags: HTMLScriptElement[] = [];
    const allSchemas = schemas ? [...schemas] : [];
    
    if (allSchemas.length > 0) {
      allSchemas.forEach((schema, index) => {
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.id = `jsonld-schema-${index}`;
        script.text = JSON.stringify(schema);
        document.head.appendChild(script);
        scriptTags.push(script);
      });
    }

    // Cleanup function
    return () => {
      scriptTags.forEach(script => {
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      });
    };
  }, [title, description, keywords, canonical, robots, schemas]);
};

