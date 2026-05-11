import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Required for Docker
    port: 3000,
    proxy: {
      // In development, proxy /api calls to the backend container
      '/api': {
        target: 'http://backend:3001',
        changeOrigin: true,
      },
    },
  },
});
