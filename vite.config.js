import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { scopePortfolioCss } from './src/portara-test/scope-portfolio-css.mjs'

// PSMA motion graphics data (tools/psma-motion): patient scans exported to the gitignored
// motion-data/ folder. Served by the dev server only (`apply: 'serve'`), so a production
// build never sees it and nothing from it is ever bundled or deployed.
const MOTION_DATA = fileURLToPath(new URL('./motion-data', import.meta.url))
const MOTION_TYPES = { '.json': 'application/json', '.png': 'image/png' }

function psmaMotionData() {
  return {
    name: 'psma-motion-data',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__psma-motion-data', (req, res) => {
        const rel = decodeURIComponent((req.url || '/').split('?')[0])
        const file = path.resolve(MOTION_DATA, '.' + rel)
        const type = MOTION_TYPES[path.extname(file)]
        if (req.method !== 'GET' || !type || !file.startsWith(MOTION_DATA + path.sep)) {
          res.statusCode = 404
          res.end()
          return
        }
        fs.stat(file, (err, st) => {
          if (err || !st.isFile()) {
            res.statusCode = 404
            res.end()
            return
          }
          res.setHeader('Content-Type', type)
          res.setHeader('Content-Length', st.size)
          res.setHeader('Cache-Control', 'no-store')
          fs.createReadStream(file).pipe(res)
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), psmaMotionData()],
  css: {
    postcss: {
      // Keeps the portfolio's global CSS off the /portara-test route. Zero
      // specificity guard, so a no-op everywhere else - see the plugin's header.
      plugins: [scopePortfolioCss()],
    },
  },
})
