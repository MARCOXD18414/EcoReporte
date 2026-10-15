import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const proxy = { '/api': { target: 'http://localhost:4000', changeOrigin: true } };

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true, proxy },
  // `npm run build && npm run preview` para probar la PWA y el modo offline
  preview: { port: 4173, host: true, proxy },
  build: { sourcemap: false, chunkSizeWarningLimit: 900 },
});
