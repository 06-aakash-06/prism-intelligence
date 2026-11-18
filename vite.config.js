import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import express from 'express';
import { createApi } from './server/api.mjs';

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/zrender/')) return 'chart-renderer';
        },
      },
    },
  },
  plugins: [
    react(), tailwindcss(),
    {
      name: 'prism-local-evidence',
      configureServer(server) {
        const app = express();
        const { api, close } = createApi();
        app.use('/api', api);
        server.middlewares.use((req, res, next) => {
          if (req.url?.startsWith('/api/')) app(req, res, next);
          else next();
        });
        server.httpServer?.once('close', close);
      },
    },
  ],
});
