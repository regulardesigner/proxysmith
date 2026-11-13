import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const SCRYFALL_API = /^https:\/\/api\.scryfall\.com\//;
const DAY_SECONDS = 24 * 60 * 60;

/**
 * GitHub Pages serves project sites from /<repository>/, so the build must know
 * its base path. Local development and root deployments keep '/'.
 */
function normalizeBase(value: string | undefined): string {
  const raw = value?.trim() || '/';
  const prefixed = raw.startsWith('/') ? raw : `/${raw}`;
  return prefixed.endsWith('/') ? prefixed : `${prefixed}/`;
}

const base = normalizeBase(process.env.VITE_BASE);
const MANA_FONT_CSS = /mana-font[\\/]css[\\/]mana\.min\.css$/;
const MPLANTIN_FONT_FACE = /@font-face\{font-family:"MPlantin";[^}]*\}/g;
const MPLANTIN_FONT_FAMILY = /font-family:"MPlantin, Garamond/g;
const OFL_FONT_FAMILY = 'font-family:"EB Garamond", Garamond';

/**
 * mana-font declares a proprietary MPlantin @font-face and references it in its
 * mana symbol rules. Remove the @font-face and fall back to EB Garamond so no
 * proprietary font asset is bundled or used (AGENTS.md: OFL fonts only).
 */
function stripMplantin(): Plugin {
  return {
    name: 'proxysmith-strip-mplantin',
    enforce: 'pre',
    transform(code, id) {
      if (!MANA_FONT_CSS.test(id)) return null;

      const stripped = code
        .replace(MPLANTIN_FONT_FACE, '')
        .replace(MPLANTIN_FONT_FAMILY, OFL_FONT_FAMILY);

      return stripped === code ? null : { code: stripped, map: null };
    },
  };
}

export default defineConfig({
  base,
  plugins: [
    stripMplantin(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        id: base,
        name: 'ProxySmith — Proxies Magic à votre image',
        short_name: 'ProxySmith',
        description:
          'Créez des proxies Magic: The Gathering avec vos propres illustrations, puis exportez-les en PNG 300 DPI ou en planche A4.',
        lang: 'fr',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#0f0e0c',
        theme_color: '#0f0e0c',
        categories: ['entertainment', 'utilities'],
        icons: [
          // Relative to the manifest URL so the same build works at the root or
          // under a GitHub Pages project sub-path.
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2}'],
        // mana-font embarque les mêmes glyphes en woff, ttf et svg : seul le
        // woff est utile aux navigateurs modernes (≈ 2,3 Mo évités).
        globIgnores: ['**/assets/mana-*.svg', '**/assets/mana-*.ttf'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Le shell reste utilisable hors ligne ; les réponses Scryfall déjà
            // consultées restent disponibles 24 h, comme le cache TanStack Query.
            urlPattern: SCRYFALL_API,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'scryfall-api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 50, maxAgeSeconds: DAY_SECONDS },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
});
