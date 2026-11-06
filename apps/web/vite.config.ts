import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // Em dev, as chamadas /api vão para o backend.
    proxy: {
      '/api': 'http://localhost:3333',
    },
  },
});
