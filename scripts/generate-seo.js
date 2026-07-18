import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to load env variables from .env files manually (no external dependency)
function loadEnv() {
  const env = { ...process.env };
  const envFiles = ['.env.production', '.env.local', '.env'];
  for (const file of envFiles) {
    const fullPath = path.resolve(__dirname, '..', file);
    if (fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');
        for (const line of lines) {
          // Match key=value ignoring comments
          const match = line.match(/^\s*(VITE_[A-Z0-9_]+)\s*=\s*([^#\r\n]*)/);
          if (match) {
            const key = match[1].trim();
            let val = match[2].trim();
            // Strip surrounding quotes
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.substring(1, val.length - 1);
            }
            if (env[key] === undefined) {
              env[key] = val;
            }
          }
        }
      } catch (err) {
        console.warn(`Could not read env file ${file}:`, err.message);
      }
    }
  }
  return env;
}

const env = loadEnv();

// Read src/config/seoConfig.json
const configPath = path.resolve(__dirname, '../src/config/seoConfig.json');
if (!fs.existsSync(configPath)) {
  console.error('SEO Configuration file not found at:', configPath);
  process.exit(1);
}

let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (err) {
  console.error('Failed to parse seoConfig.json:', err.message);
  process.exit(1);
}

// Override with env variables if present
const siteUrl = env.VITE_SITE_URL || config.siteUrl || 'https://deciblecut.vercel.app';
const googleVerification = env.VITE_GOOGLE_VERIFICATION || config.verification?.google;
const bingVerification = env.VITE_BING_VERIFICATION || config.verification?.bing;
const yandexVerification = env.VITE_YANDEX_VERIFICATION || config.verification?.yandex;
const naverVerification = env.VITE_NAVER_VERIFICATION || config.verification?.naver;
const seznamVerification = env.VITE_SEZNAM_VERIFICATION || config.verification?.seznam;

// Make sure public directory exists
const publicDir = path.resolve(__dirname, '../public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 1. Generate verification files
const verificationFiles = config.verificationFiles || [];

// Add files dynamically from environment variables if specified
// For example, Google site verification files usually follow the format "google[hash].html"
if (googleVerification && googleVerification.startsWith('google') && googleVerification.endsWith('.html')) {
  // If the env VITE_GOOGLE_VERIFICATION is the filename itself (e.g. google5a54cb3b57db1ade.html)
  if (!verificationFiles.some(f => f.filename === googleVerification)) {
    verificationFiles.push({
      filename: googleVerification,
      content: `google-site-verification: ${googleVerification}`
    });
  }
}

verificationFiles.forEach((file) => {
  if (file.filename && file.content) {
    const filePath = path.join(publicDir, file.filename);
    fs.writeFileSync(filePath, file.content, 'utf8');
    console.log(`[SEO] Generated verification file: public/${file.filename}`);
  }
});

// 2. Generate robots.txt
const robotsPath = path.join(publicDir, 'robots.txt');
const robotsContent = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /admin/inbox
Disallow: /admin

Sitemap: ${siteUrl}/sitemap.xml
`;
fs.writeFileSync(robotsPath, robotsContent, 'utf8');
console.log('[SEO] Generated robots.txt');

// 3. Generate sitemap.xml
const sitemapPath = path.join(publicDir, 'sitemap.xml');
const currentDate = new Date().toISOString().split('T')[0];

const publicPages = [
  { path: '', changefreq: 'daily', priority: '1.0' },
  { path: 'app', changefreq: 'weekly', priority: '0.9' },
  { path: 'extract-audio', changefreq: 'weekly', priority: '0.8' },
  { path: 'creator-tools', changefreq: 'weekly', priority: '0.8' },
  { path: 'podcast-studio', changefreq: 'weekly', priority: '0.8' },
  { path: 'audio-to-text', changefreq: 'weekly', priority: '0.8' },
  { path: 'about', changefreq: 'monthly', priority: '0.6' },
  { path: 'support', changefreq: 'monthly', priority: '0.6' },
  { path: 'privacy', changefreq: 'monthly', priority: '0.4' }
];

let sitemapUrls = '';
publicPages.forEach((page) => {
  const url = `${siteUrl}/${page.path}`;
  sitemapUrls += `  <url>
    <loc>${url}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>\n`;
});

const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls}</urlset>
`;
fs.writeFileSync(sitemapPath, sitemapContent, 'utf8');
console.log('[SEO] Generated sitemap.xml');
