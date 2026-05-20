import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    {
      name: 'static-pages',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/docs' || req.url === '/docs/') {
            req.url = '/docs/index.html';
          }
          if (req.url === '/explorer' || req.url === '/explorer/') {
            req.url = '/explorer/index.html';
          }
          next();
        });
      },
    },
    react(),
  ],
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
