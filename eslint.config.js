import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // **/.wrangler = wrangler's local dev/build scratch (gitignored), not source.
  globalIgnores(['dist', 'mcp-pixel-gif', '**/.wrangler/']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  // Cloudflare Workers runtime globals — not part of globals.browser.
  {
    files: ['workers/**/*.js', 'mcp-portal/src/**/*.js'],
    languageOptions: {
      globals: { WebSocketPair: 'readonly', WebSocket: 'readonly' },
    },
  },
  // Node scripts (headless checks, test harnesses).
  {
    files: ['tools/**/*.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },
])
