import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../');

function resolveVersion(): string {
  if (process.env.APP_VERSION && process.env.APP_VERSION !== 'dev') {
    return process.env.APP_VERSION.replace(/^v/, '');
  }
  try {
    const gitTag = execSync('git describe --tags --always', {
      cwd: repoRoot,
      stdio: ['pipe', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    if (/^v?\d+\.\d+\.\d+/.test(gitTag)) {
      return gitTag.replace(/^v/, '');
    }
  } catch {
    // fallback
  }

  // Fallback to package.json
  const candidatePaths = [
    path.join(__dirname, '../package.json'),
    path.join(repoRoot, 'package.json'),
  ];
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (pkg.version) return pkg.version;
      } catch {}
    }
  }

  return '1.0.0';
}

function resolveBranch(): string {
  let branch =
    process.env.BRANCH_NAME ||
    process.env.VITE_BRANCH_NAME ||
    process.env.GITHUB_REF_NAME ||
    '';

  if (!branch || branch === 'HEAD') {
    try {
      branch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: repoRoot,
        stdio: ['pipe', 'pipe', 'ignore'],
      })
        .toString()
        .trim();
    } catch {
      branch = '';
    }
  }

  if (!branch || branch === 'HEAD') {
    try {
      branch = execSync('git branch --show-current', {
        cwd: repoRoot,
        stdio: ['pipe', 'pipe', 'ignore'],
      })
        .toString()
        .trim();
    } catch {
      branch = '';
    }
  }

  return branch && branch !== 'HEAD' ? branch : 'main';
}

function resolveCommit(): string {
  let commit =
    process.env.COMMIT_SHA ||
    process.env.VITE_COMMIT_SHA ||
    process.env.SHORT_SHA ||
    process.env.GITHUB_SHA ||
    '';

  if (!commit || commit === 'dev') {
    try {
      commit = execSync('git rev-parse --short HEAD', {
        cwd: repoRoot,
        stdio: ['pipe', 'pipe', 'ignore'],
      })
        .toString()
        .trim();
    } catch {
      commit = '';
    }
  }

  if (commit === 'dev') {
    commit = '';
  } else if (commit.length > 7) {
    commit = commit.slice(0, 7);
  }

  return commit || 'production';
}

export const SERVER_VERSION = resolveVersion();
export const BRANCH_NAME = resolveBranch();
export const COMMIT_SHA = resolveCommit();

export function getVersionPayload() {
  return {
    version: SERVER_VERSION,
    branch: BRANCH_NAME,
    commit: COMMIT_SHA,
    timestamp: new Date().toISOString(),
  };
}
