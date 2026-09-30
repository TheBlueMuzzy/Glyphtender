import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/glyphtender/' : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Glyphtender',
        short_name: 'Glyphtender',
        description: 'A cozy hex-garden word game — the best speller doesn’t always win',
        theme_color: '#141a2e',
        background_color: '#141a2e',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2,csv}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  build: {
    rollupOptions: {
      // Prototypes (code sketches) are extra pages: /glyphtender/sketches/<name>/
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        moveCast: resolve(import.meta.dirname, 'sketches/move-cast/index.html'),
      },
    },
  },
  server: {
    host: true, // expose on local network for phone testing
  },
})
