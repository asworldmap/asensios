import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Multi-page, no router, no SPA fallback. Each entry is a real file on disk, so
// every route resolves on a plain static host and a wrong URL 404s instead of
// silently rendering the homepage:
//   index.html            -> /
//   trajectory/index.html -> /trajectory
//   games/index.html      -> /games
export default defineConfig({
  appType: 'mpa',
  build: {
    target: 'es2019',
    cssMinify: true,
    rollupOptions: {
      input: {
        home: resolve(__dirname, 'index.html'),
        trajectory: resolve(__dirname, 'trajectory/index.html'),
        games: resolve(__dirname, 'games/index.html'),
      },
    },
  },
});
