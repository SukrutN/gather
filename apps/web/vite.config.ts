import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages serves the repo at /gather/. Local dev stays at the root.
const base = process.env.GITHUB_ACTIONS === "true" ? "/gather/" : "/"

export default defineConfig({
  base,
  plugins: [react()],
})
