import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';
import mkcert from 'vite-plugin-mkcert';
import tsconfigPaths from 'vite-tsconfig-paths';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern',
      },
    },
  },
  plugins: [
    react(),
    tsconfigPaths(),
    process.env.HTTPS && mkcert(),
  ],
  build: {
    target: 'esnext',
    minify: 'terser',
  },
  publicDir: './public',
  server: {
    host: true,
    port: 5173,
    allowedHosts: ['.trycloudflare.com', 'tg-beta.shakha.uz'],
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://backend:8000',
        changeOrigin: true,
      },
    },
  },
});
