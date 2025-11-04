import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // Explicitly mark Firebase modules as external to prevent Netlify build failure.
      // This is a crucial step when bundling React/Vite with Firebase SDK v9+ imports.
      external: [
        'firebase/app',
        'firebase/auth',
        'firebase/firestore',
        'firebase/storage'
      ],
    },
  },
})
