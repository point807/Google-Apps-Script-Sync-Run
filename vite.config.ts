import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, '.'),
    },
  },
  server: {
    port: 3000,
    host: true,
    // Allow any host so the app works behind preview proxies (dev server only).
    allowedHosts: true,
  },
});
