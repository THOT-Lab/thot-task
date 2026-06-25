import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' → chemins relatifs, fonctionne sur GitHub Pages quel que soit le nom
// du dépôt (combiné au HashRouter côté React).
export default defineConfig({
  plugins: [react()],
  base: './',
})
