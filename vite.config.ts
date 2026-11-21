import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' 让构建产物可以放在任意子路径下（GitHub Pages、Qoder Sites 等静态托管）
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // three 体积最大且几乎不变，单独分包后改业务代码不会让用户重新下载它
        manualChunks: { three: ['three'] },
      },
    },
  },
  server: {
    port: 5173,
  },
});
