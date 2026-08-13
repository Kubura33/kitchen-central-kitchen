/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
  },
  server: {
    port: 5173,
    strictPort: true,

    proxy: {
      '/api': {
        target: 'https://api.centralkitchen.rs',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
