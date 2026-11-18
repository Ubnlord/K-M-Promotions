import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@appdeploy/client': fileURLToPath(new URL('./src/lib/appdeploy-compat.ts', import.meta.url))
    }
  },
  base: '/',
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: ['chrome87', 'edge88', 'firefox78', 'safari14']
  }
});
