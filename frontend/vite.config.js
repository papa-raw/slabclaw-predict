import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@lib': path.resolve(__dirname, '../lib'),
    },
  },
  server: {
    proxy: {
      '/api': { target: 'http://localhost:3001' },
      '/ws': { target: 'ws://localhost:3001', ws: true },
    },
  },
});
