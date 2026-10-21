import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Sous Docker sur Windows, les modifications de fichiers ne sont pas signalées, il faut les sonder.
    watch: process.env.VITE_USE_POLLING ? { usePolling: true } : undefined,
  },
});
