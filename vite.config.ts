import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Custom domain deploy at https://marcusr.me/ (root), so base must be '/'
export default defineConfig({
  plugins: [react()],
  base: '/',
})
