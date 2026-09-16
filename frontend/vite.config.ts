import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages -projektisivu palvelee osoitteesta /<repo-nimi>/, ei
  // juuresta — ilman tätä build viittaisi assetteihin väärillä poluilla.
  base: '/sakkokassa/',
  plugins: [react()],
})
