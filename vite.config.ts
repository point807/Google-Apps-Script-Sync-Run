import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt'],
      manifest: {
        name: 'ScriptVault — Apps Script Sync & Version Control',
        short_name: 'ScriptVault',
        description:
          'Web app to download, edit, run, and back up Google Apps Script projects with local history, Drive snapshots, and GitHub sync',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // Monaco ts.worker is ~6MB
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } }
          }
        ]
      }
    }),
    visualizer({
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true,
      open: false
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, '.')
    }
  },
  server: {
    port: 3000,
    host: true,
    // Allow any host so the app works behind preview proxies (dev server only).
    allowedHosts: true
  },
  build: {
    // Budget check: warn if chunk > 1MB (monaco workers are large but async)
    chunkSizeWarningLimit: 1024
  }
});
