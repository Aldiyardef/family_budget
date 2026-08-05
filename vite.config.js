import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/family_budget/',
  plugins: [react()],
  build: {
    outDir: 'docs',
  },
})