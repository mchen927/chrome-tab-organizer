import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite configuration for building the Chrome extension popup
// This builds a React app that will be loaded as the extension's popup
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    // Ensure we get a single HTML file and bundled assets
    rollupOptions: {
      input: {
        main: './index.html',
      },
    },
  },
})

