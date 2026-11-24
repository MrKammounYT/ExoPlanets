import { defineConfig } from 'vite';

// The site reads data/catalog.json and assets/ from the project root,
// one level up, so the dev server must be allowed to serve that folder.
export default defineConfig({
  base: './',
  server: {
    fs: { allow: ['..'] },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      }
    }
  },
  build: { outDir: 'dist', emptyOutDir: true }
});
