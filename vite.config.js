import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { scopePortfolioCss } from './src/portara-test/scope-portfolio-css.mjs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      // Keeps the portfolio's global CSS off the /portara-test route. Zero
      // specificity guard, so a no-op everywhere else - see the plugin's header.
      plugins: [scopePortfolioCss()],
    },
  },
})
