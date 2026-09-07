import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { execSync } from 'child_process'
import fs from 'fs'

// Determine App Version: env var, or git tag, or fallback to package.json
let appVersion = process.env.VITE_APP_VERSION || process.env.APP_VERSION || ''
if (!appVersion) {
  try {
    const gitTag = execSync('git describe --tags --always', { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim()
    if (/^v?\d+\.\d+\.\d+/.test(gitTag)) {
      appVersion = gitTag.replace(/^v/, '')
    }
  } catch {
    // fallback
  }
}
if (!appVersion) {
  try {
    const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
    if (pkg.version) {
      appVersion = pkg.version
    }
  } catch {
    appVersion = '1.0.0'
  }
}

// Determine Branch Name: env var, or git rev-parse, or git branch, or fallback to 'main'
let branchName = process.env.VITE_BRANCH_NAME || process.env.BRANCH_NAME || process.env.GITHUB_REF_NAME || ''
if (!branchName || branchName === 'HEAD') {
  try {
    branchName = execSync('git rev-parse --abbrev-ref HEAD', { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    branchName = ''
  }
}
if (!branchName || branchName === 'HEAD') {
  try {
    branchName = execSync('git branch --show-current', { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    branchName = ''
  }
}
if (!branchName || branchName === 'HEAD') {
  branchName = 'main'
}

// Determine commit SHA: from env var, or local git rev-parse, or fallback to empty string
let commitSha = process.env.VITE_COMMIT_SHA || process.env.COMMIT_SHA || process.env.SHORT_SHA || process.env.GITHUB_SHA || ''
if (!commitSha || commitSha === 'dev') {
  try {
    commitSha = execSync('git rev-parse --short HEAD', { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    commitSha = ''
  }
}
if (commitSha === 'dev') {
  commitSha = ''
} else if (commitSha.length > 7) {
  commitSha = commitSha.slice(0, 7)
}

const buildTime = process.env.VITE_BUILD_TIME || process.env.BUILD_TIME || new Date().toISOString()

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __BRANCH_NAME__: JSON.stringify(branchName),
    __COMMIT_SHA__: JSON.stringify(commitSha),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
})
