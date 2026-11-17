import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 상대 경로로 빌드해 GitHub Pages 하위 경로(/anatomy-simulator/)와 로컬 양쪽에서 동작하게 한다
  base: './',
  server: { port: 5173, strictPort: true },
});
