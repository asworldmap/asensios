import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Multi-page setup. Each entry becomes a clean route on static hosts:
//   index.html          -> /
//   business/index.html -> /business
//   games/index.html    -> /games
//   trajectory.html     -> /trajectory.html (legacy redirect, kept for backwards compat)
export default defineConfig({
  appType: 'mpa',
  build: {
    target: 'es2019',
    cssMinify: true,
    rollupOptions: {
      input: {
        home: resolve(__dirname, 'index.html'),
        business: resolve(__dirname, 'business/index.html'),
        games: resolve(__dirname, 'games/index.html'),
        trajectory: resolve(__dirname, 'trajectory.html'),
      },
    },
  },
});
