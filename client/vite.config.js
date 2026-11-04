import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { env } from 'node:process'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', setupFiles: './src/test/setup.js', include: ['src/test/**/*.test.{js,jsx}'] },
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': env.API_PROXY_TARGET || 'http://127.0.0.1:5000' },
  },
})
