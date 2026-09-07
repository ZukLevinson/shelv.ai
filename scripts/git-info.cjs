const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function getGitInfo(repoRoot = path.resolve(__dirname, '..')) {
  // 1. Branch Name
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

  if (!branch || branch === 'HEAD') {
    branch = 'main';
  }

  // 2. Commit SHA
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

  // 3. App Version
  let version =
    process.env.APP_VERSION ||
    process.env.VITE_APP_VERSION ||
    '';

  if (!version) {
    try {
      const gitTag = execSync('git describe --tags --always', {
        cwd: repoRoot,
        stdio: ['pipe', 'pipe', 'ignore'],
      })
        .toString()
        .trim();

      if (/^v?\d+\.\d+\.\d+/.test(gitTag)) {
        version = gitTag.replace(/^v/, '');
      }
    } catch {
      // fallback
    }
  }

  if (!version) {
    try {
      const rootPkg = JSON.parse(
        fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')
      );
      if (rootPkg.version) {
        version = rootPkg.version;
      }
    } catch {
      version = '1.0.0';
    }
  }

  const buildTime =
    process.env.BUILD_TIME ||
    process.env.VITE_BUILD_TIME ||
    new Date().toISOString();

  return {
    version,
    branch,
    commit,
    buildTime,
  };
}

if (require.main === module) {
  const info = getGitInfo();
  const arg = process.argv[2];
  if (arg && info[arg] !== undefined) {
    process.stdout.write(info[arg]);
  } else {
    console.log(JSON.stringify(info, null, 2));
  }
}

module.exports = { getGitInfo };
