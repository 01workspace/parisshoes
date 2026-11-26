import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: process.env.APPDEPLOY_VITE_OUT_DIR || 'dist',
    sourcemap:
      process.env.APPDEPLOY_VITE_SOURCEMAP === 'hidden' ? 'hidden' : false,
    target: ['chrome87', 'edge88', 'firefox78', 'safari14'],
    rollupOptions: {
      input: {
        storefront: resolve(process.cwd(), 'index.html'),
        admin: resolve(process.cwd(), 'admin/index.html'),
      },
    },
  },
});
