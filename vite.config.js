import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // 1. Sets the base path to relative (./) for Netlify deployment
  base: './', 
  // 2. IMPORTANT: We are explicitly NOT including the 'build.rollupOptions' block anymore. 
  // This ensures the browser can find and load the Firebase modules, fixing the crash.
})
