import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const BRAND = '#241d18';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },

  server: {
    port: 5173,
    // Keeps the browser same-origin in development, so the refresh cookie and
    // relative `/api` base URL work without any CORS special-casing.
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
    },
  },

  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: '/app',
        name: 'Nurella Beauty Lounge',
        short_name: 'Nurella',
        description:
          'Book your personalized consultation at Nurella Beauty Lounge — advanced aesthetics, skin and beauty.',
        // Launching straight into the client app is what makes the installed
        // icon feel like a booking app rather than a bookmarked website.
        start_url: '/app',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f7f3ec',
        theme_color: BRAND,
        categories: ['lifestyle', 'health', 'beauty'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Book an appointment', url: '/app/book' },
          { name: 'My appointments', url: '/app/appointments' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // The API is never precached, and navigation requests must not be
        // answered from the app shell — otherwise a logged-out user could be
        // shown a stale authenticated screen.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Read-only catalogue data: fresh when online, still readable offline.
            urlPattern: ({ url, request }) =>
              request.method === 'GET' &&
              (url.pathname.startsWith('/api/services') || url.pathname.startsWith('/api/gallery')),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'nurella-catalogue',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            // Uploaded website artwork. Keys are random and never rewritten, so
            // a cached copy can only ever be the right one.
            urlPattern: ({ url, request }) =>
              request.method === 'GET' && url.pathname.startsWith('/api/media/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'nurella-media',
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'nurella-fonts',
              expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],

  build: {
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Split the vendor weight so the landing page does not pay for the
        // data-fetching and animation libraries the app screens need.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query', 'axios'],
          motion: ['framer-motion'],
        },
      },
    },
  },
});
