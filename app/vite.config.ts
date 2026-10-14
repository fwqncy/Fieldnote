import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// React Native components render on the web through react-native-web.
// `.web.tsx` files are platform-specific implementations (Three.js, canvas).
const extensions = ['.web.tsx', '.web.ts', '.tsx', '.ts', '.web.js', '.mjs', '.js', '.jsx', '.json'];

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { 'react-native': 'react-native-web' }, extensions },
  optimizeDeps: { esbuildOptions: { resolveExtensions: extensions } },
  server: { port: 5173, proxy: { '/api': 'http://localhost:7878' } },
  build: { chunkSizeWarningLimit: 1200 },
});
