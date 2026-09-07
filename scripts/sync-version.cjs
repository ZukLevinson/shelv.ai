const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');

const manifestPaths = [
  { name: 'Root package.json', path: path.join(repoRoot, 'package.json'), type: 'package' },
  { name: 'Web package.json', path: path.join(repoRoot, 'web', 'package.json'), type: 'package' },
  { name: 'Server package.json', path: path.join(repoRoot, 'server', 'package.json'), type: 'package' },
  { name: 'Mobile package.json', path: path.join(repoRoot, 'mobile', 'package.json'), type: 'package' },
  { name: 'Mobile app.json', path: path.join(repoRoot, 'mobile', 'app.json'), type: 'expo' },
];

function readVersions() {
  const versions = [];
  for (const m of manifestPaths) {
    if (!fs.existsSync(m.path)) {
      versions.push({ ...m, version: null, error: 'File not found' });
      continue;
    }
    try {
      const content = JSON.parse(fs.readFileSync(m.path, 'utf8'));
      const ver = m.type === 'expo' ? content.expo?.version : content.version;
      versions.push({ ...m, version: ver });
    } catch (e) {
      versions.push({ ...m, version: null, error: e.message });
    }
  }
  return versions;
}

function bumpSemver(currentVersion, bumpType) {
  const match = currentVersion.match(/^(\d+)\.(\d+)\.(\d+)(.*)$/);
  if (!match) {
    throw new Error(`Invalid semver version: "${currentVersion}"`);
  }
  let [, major, minor, patch, prerelease] = match;
  let maj = parseInt(major, 10);
  let min = parseInt(minor, 10);
  let pat = parseInt(patch, 10);

  if (bumpType === 'major') {
    maj += 1;
    min = 0;
    pat = 0;
  } else if (bumpType === 'minor') {
    min += 1;
    pat = 0;
  } else if (bumpType === 'patch') {
    pat += 1;
  } else {
    throw new Error(`Unknown bump type: ${bumpType}`);
  }

  return `${maj}.${min}.${pat}`;
}

function writeVersion(targetVersion) {
  for (const m of manifestPaths) {
    if (!fs.existsSync(m.path)) continue;
    const content = JSON.parse(fs.readFileSync(m.path, 'utf8'));
    if (m.type === 'expo') {
      if (!content.expo) content.expo = {};
      content.expo.version = targetVersion;
    } else {
      content.version = targetVersion;
    }
    fs.writeFileSync(m.path, JSON.stringify(content, null, 2) + '\n', 'utf8');
    console.log(`✓ Updated ${m.name} -> v${targetVersion}`);
  }
}

function main() {
  const args = process.argv.slice(2);
  const isCheck = args.includes('--check');
  const createGitTag = args.includes('--git-tag');
  const targetArg = args.find(a => !a.startsWith('--'));

  const currentVersions = readVersions();
  const rootVer = currentVersions.find(v => v.type === 'package' && v.name.includes('Root'))?.version;

  if (isCheck) {
    console.log('Verifying version unanimity across all monorepo manifests:');
    let hasMismatch = false;
    for (const item of currentVersions) {
      const match = item.version === rootVer;
      if (!match) hasMismatch = true;
      console.log(`  [${match ? '✓' : '✗'}] ${item.name.padEnd(22)}: ${item.version || 'ERROR'}`);
    }

    if (hasMismatch) {
      console.error('\n❌ Version mismatch detected! Run "pnpm run version:sync" to synchronize.');
      process.exit(1);
    } else {
      console.log(`\n✨ All components are unanimously at v${rootVer}`);
      return;
    }
  }

  let nextVersion = targetArg;
  if (!nextVersion) {
    nextVersion = rootVer;
    console.log(`No version specified. Synchronizing all manifests to root version: v${nextVersion}`);
  } else if (['patch', 'minor', 'major'].includes(nextVersion.toLowerCase())) {
    nextVersion = bumpSemver(rootVer, nextVersion.toLowerCase());
    console.log(`Bumping version from v${rootVer} to v${nextVersion} (${targetArg})...`);
  }

  writeVersion(nextVersion);

  if (createGitTag) {
    const tagName = `v${nextVersion}`;
    try {
      execSync(`git tag -a ${tagName} -m "Release ${tagName}"`, { cwd: repoRoot, stdio: 'inherit' });
      console.log(`✓ Created git tag ${tagName}`);
    } catch (err) {
      console.warn(`Could not create git tag ${tagName}:`, err.message);
    }
  }

  console.log(`\n🎉 Success! All monorepo manifests are now unanimous at v${nextVersion}.`);
}

main();
