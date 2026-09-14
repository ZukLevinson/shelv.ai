# Monorepo Tooling & Scripts (`scripts/`)

> **Version Synchronization & Build-Time Git Metadata Utilities**

The `scripts` directory contains cross-package automation tools for maintaining version alignment across all packages in the monorepo and generating build-time metadata.

---

## Files

```
scripts/
├── git-info.cjs        # Generates version.ts files containing Git commit & branch metadata
├── sync-version.cjs    # Synchronizes semver version across all 5 project manifests
└── README.md           # Tooling documentation
```

---

## 1. Version Synchronizer (`sync-version.cjs`)

In a multi-package repository containing web, server, and Expo mobile packages, maintaining version consistency across separate manifests is critical. `sync-version.cjs` synchronizes versions across all **5 manifest files**:

1. `package.json` (Root repository)
2. `web/package.json` (React web dashboard)
3. `server/package.json` (Express backend)
4. `mobile/package.json` (Mobile package)
5. `mobile/app.json` (Expo mobile app descriptor under `expo.version`)

### Commands & Modes

```bash
# Check if all 5 manifests have identical versions (exits 1 on discrepancy)
node scripts/sync-version.cjs --check
# or via root script:
pnpm version:check

# Synchronize all sub-packages to match root package.json version
node scripts/sync-version.cjs
# or via root script:
pnpm version:sync

# Increment patch version (e.g. 1.0.0 -> 1.0.1) across all manifests
node scripts/sync-version.cjs patch

# Increment minor version (e.g. 1.0.1 -> 1.1.0) across all manifests
node scripts/sync-version.cjs minor

# Increment major version (e.g. 1.1.0 -> 2.0.0) across all manifests
node scripts/sync-version.cjs major

# Set an explicit version across all manifests
node scripts/sync-version.cjs 1.2.3
```

---

## 2. Git Metadata Generator (`git-info.cjs`)

`git-info.cjs` extracts current repository state and generates strongly-typed `version.ts` files consumed by each application at runtime:

- **Server**: `server/src/version.ts` (exposes `/api/version` and `/health`)
- **Web**: `web/src/version.ts` (powers `VersionBadge.tsx`)
- **Mobile**: `mobile/src/version.ts` (powers `MobileVersionBadge.tsx`)

### Resolution Strategy
The script automatically detects environment context to support local development, Docker builds, and CI pipelines:

1. **Branch Name**: Checks `BRANCH_NAME`, `VITE_BRANCH_NAME`, `GITHUB_REF_NAME`, or executes `git rev-parse --abbrev-ref HEAD`.
2. **Commit SHA**: Checks `COMMIT_SHA`, `VITE_COMMIT_SHA`, `SHORT_SHA`, `GITHUB_SHA`, or executes `git rev-parse --short HEAD` (trimmed to 7 characters).
3. **App Version**: Reads the authoritative version from `package.json`.

### Output Payload
The generated files export:
```ts
export const SERVER_VERSION = '1.0.0';
export const COMMIT_SHA = 'a1b2c3d';
export const BRANCH_NAME = 'main';
export const BUILD_TIME = '2026-09-14T14:30:00.000Z';
```

---

## Usage in CI/CD & Build Pipelines

- In **Docker** (`Dockerfile`), build arguments `COMMIT_SHA`, `BRANCH_NAME`, and `APP_VERSION` are passed down to all builder stages.
- In **Expo Web Export** (`mobile/package.json`), `pnpm run prebuild` executes `git-info.cjs` before Metro bundles the application.
