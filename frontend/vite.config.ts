import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // "/" in dev and for user/org Pages; the deploy workflow sets VITE_BASE to "/<repo>/"
  // for project Pages so assets resolve under the subpath.
  base: process.env.VITE_BASE || '/',
  plugins: [react(), tailwindcss()],
  test: {
    // Global env stays node (default) so existing logic tests are unchanged;
    // DOM tests opt in per-file via `// @vitest-environment jsdom`.
    setupFiles: './src/test/setup.ts',
  },
})
