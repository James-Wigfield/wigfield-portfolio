import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { scopePortfolioCss } from './src/portara-test/scope-portfolio-css.mjs'

// Local-only data folders, served by the dev server only (`apply: 'serve'`), so a
// production build never sees them and nothing from them is ever bundled or deployed.
//   motion-data/             PSMA motion graphics (tools/psma-motion): patient scans.
//   dissertation-diff-data/  Dissertation red pen (tools/dissertation-diff): page renders
//                            of the unsubmitted dissertation, before and after the cuts.
const MOTION_DATA = fileURLToPath(new URL('./motion-data', import.meta.url))
const MOTION_TYPES = { '.json': 'application/json', '.png': 'image/png' }
const DISS_DIFF_DATA = fileURLToPath(new URL('./dissertation-diff-data', import.meta.url))
const DISS_DIFF_TYPES = { '.json': 'application/json', '.svg': 'image/svg+xml', '.pdf': 'application/pdf' }

// `revalidate` lets the browser keep files between visits (ETag from size and mtime)
// instead of fetching every page render again; build scratch (dot-folders) is never served.
function localData(name, route, dir, types, { revalidate = false } = {}) {
  return {
    name,
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(route, (req, res) => {
        const rel = decodeURIComponent((req.url || '/').split('?')[0])
        const file = path.resolve(dir, '.' + rel)
        const type = types[path.extname(file)]
        const hidden = path.relative(dir, file).split(path.sep).some((p) => p.startsWith('.'))
        if (req.method !== 'GET' || !type || hidden || !file.startsWith(dir + path.sep)) {
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
          if (revalidate) {
            const etag = `"${st.size.toString(36)}-${st.mtimeMs.toString(36)}"`
            res.setHeader('ETag', etag)
            res.setHeader('Cache-Control', 'no-cache')
            if (req.headers['if-none-match'] === etag) {
              res.statusCode = 304
              res.end()
              return
            }
          } else {
            res.setHeader('Cache-Control', 'no-store')
          }
          res.setHeader('Content-Type', type)
          res.setHeader('Content-Length', st.size)
          fs.createReadStream(file).pipe(res)
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    localData('psma-motion-data', '/__psma-motion-data', MOTION_DATA, MOTION_TYPES),
    localData('dissertation-diff-data', '/__dissertation-diff', DISS_DIFF_DATA, DISS_DIFF_TYPES, { revalidate: true }),
  ],
  css: {
    postcss: {
      // Keeps the portfolio's global CSS off the /portara-test route. Zero
      // specificity guard, so a no-op everywhere else - see the plugin's header.
      plugins: [scopePortfolioCss()],
    },
  },
})
