import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };

// Matches the dark interface so the installed app's title bar blends in.
const APP_DARK = '#1c1d21';

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_BUILD__: JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? new Date().toISOString().slice(0, 16)),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
  plugins: [
    react(),
    // Publishes the release notes as /releases.json, so a version that is still running can show
    // what a waiting update brings before installing it (src/lib/whatsNew.ts). Not precached.
    {
      name: 'release-notes',
      configureServer(server) {
        server.middlewares.use('/releases.json', (_req, res) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(readFileSync('src/config/releases.json'));
        });
      },
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'releases.json', source: readFileSync('src/config/releases.json', 'utf8') });
      },
    },
    VitePWA({
      // The app shows its own "new version available" prompt (src/components/pwa/UpdatePrompt.tsx),
      // so a new service worker only takes over when staff choose to reload.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'favicon-32x32.png', 'apple-touch-icon.png', 'brand/philrads-emblem.png'],
      manifest: {
        id: '/',
        name: 'PHILRADS Staff Portal',
        short_name: 'PHILRADS',
        description:
          'Internal staff portal for Philippine Relief and Development Services, Inc. Serving People in Jesus’ Name.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: APP_DARK,
        background_color: APP_DARK,
        categories: ['productivity', 'business'],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'maskable-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache only the built app shell and static assets.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,mp3}'],
        navigateFallback: '/index.html',
        // /about.html and /privacy.html are plain public pages (Google's sign-in screen links to them), not the app.
        navigateFallbackDenylist: [/^\/api\//, /^\/(about|privacy)\.html$/],
        cleanupOutdatedCaches: true,
        // Runtime caching is limited to public font files and map tiles. Supabase, Google Drive and any
        // authenticated API traffic is deliberately NOT listed, so it always goes to the network
        // and is never written to a service-worker cache.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
          {
            // Live Map tiles (public map pictures, no personal data): areas already viewed
            // keep showing with a weak or no signal in the field.
            // (Place names drawn over the weather come from Esri's reference tiles.)
            urlPattern: ({ url }) => url.origin === 'https://tile.openstreetmap.org' || url.href.startsWith('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'live-map-tiles',
              expiration: { maxEntries: 800, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Live Map weather (public forecasts): the last one fetched still shows with a weak signal.
            urlPattern: ({ url }) => url.origin === 'https://api.open-meteo.com',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'live-map-weather',
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 12 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
});
