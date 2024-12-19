import { defineConfig } from 'vite';
import path from 'path';

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    alias: {
      '@/lib': path.resolve(__dirname, 'src/main/lib'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/main/index.ts'),
    },
    rollupOptions: {
      external: ['electron', 'better-sqlite3'],
    },
  },
  plugins: [],
});
