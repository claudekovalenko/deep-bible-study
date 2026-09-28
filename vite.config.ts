import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// BASE_PATH lets the same build serve from a sub-path (e.g. GitHub Pages: /deep-bible-study/).
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.svg', 'icons/*.png'],
      manifest: {
        name: 'Deep Study — Bible',
        short_name: 'Deep Study',
        description: 'A lifelong, personal place to study the Word deeply.',
        theme_color: '#f6f1e7',
        background_color: '#f6f1e7',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            // Bundled Bible data (KJV, SBLGNT, lexicon): cache as it is read, forever.
            urlPattern: ({ url }) => url.pathname.includes('/data/'),
            handler: 'CacheFirst',
            options: { cacheName: 'bible-data', expiration: { maxEntries: 200 } },
          },
        ],
      },
    }),
  ],
});
