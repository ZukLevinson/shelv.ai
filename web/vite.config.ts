import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { execSync } from 'child_process'
import fs from 'fs'

// Read version from package.json
let appVersion = '1.0.0'
try {
  const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
  if (pkg.version) {
    appVersion = pkg.version
  }
} catch {
  // fallback default
}

// Determine commit SHA: from env var, or local git rev-parse, or fallback to 'dev'
let commitSha = process.env.VITE_COMMIT_SHA || process.env.COMMIT_SHA || ''
if (!commitSha) {
  try {
    commitSha = execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    commitSha = 'dev'
  }
} else if (commitSha.length > 7) {
  commitSha = commitSha.slice(0, 7)
}

const buildTime = process.env.VITE_BUILD_TIME || new Date().toISOString()

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __COMMIT_SHA__: JSON.stringify(commitSha),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
})
