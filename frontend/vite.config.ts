import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // Global env stays node (default) so existing logic tests are unchanged;
    // DOM tests opt in per-file via `// @vitest-environment jsdom`.
    setupFiles: './src/test/setup.ts',
  },
})
