import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Whether to polyfill `node:` protocol imports.
      protocolImports: true,
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  define: {
    // Some libraries use global object which is not available in browser.
    // 'global': 'window', 
    // 'process.env': {} 
  },
  resolve: {
    alias: {
      util: 'util',
      events: 'events',
    }
  }
})
