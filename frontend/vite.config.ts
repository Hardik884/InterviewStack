import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Split large third-party libraries into separate vendor chunks so the
    // initial bundle is small and long-term browser caching is effective.
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('monaco') || id.includes('y-monaco')) return 'vendor-monaco'
          if (id.includes('livekit')) return 'vendor-livekit'
          if (id.includes('yjs') || id.includes('y-protocols') || id.includes('lib0')) return 'vendor-yjs'
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts'
          if (id.includes('framer-motion')) return 'vendor-motion'
          if (id.includes('react-markdown') || id.includes('remark') || id.includes('micromark') || id.includes('mdast') || id.includes('hast')) return 'vendor-markdown'
          if (id.includes('react') || id.includes('scheduler')) return 'vendor-react'
          return 'vendor'
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
})
