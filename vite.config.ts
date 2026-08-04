import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// base: './' keeps asset URLs relative so the built bundle works from any
// subpath (e.g. https://<user>.github.io/Spanish_trainer/) without extra config.
export default defineConfig({
  base: './',
  plugins: [react()],
})
