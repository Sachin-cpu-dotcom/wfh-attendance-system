import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// If deploying to GitHub Pages as a project site (username.github.io/REPO-NAME/),
// set base to '/REPO-NAME/'. If deploying to Netlify, your own domain, or a
// company server root, leave it as '/'.
export default defineConfig({
  base: '/wfh-attendance-system/',
  plugins: [react()],
})
