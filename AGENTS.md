# Agent Developer Guide (AGENTS.md)

This document is the authoritative orientation playbook for autonomous agents, code-generation tools, and human developers contributing to `shelv.ai`.

---

## 1. System Map & Core Principles

`shelv.ai` reconciles real-world physical assets against an official organizational baseline.

```
shelv.ai/
├── server/          # Express 4 + better-sqlite3 + ws (Port 4000)
│   ├── src/db/      # SQLite schema, migrations, connection proxy
│   ├── src/routes/  # REST endpoints (auth, inventory, sweep, anomalies, actions)
│   ├── src/services/# Business logic (anomalies, vertex ai, gcs, excel, email)
│   ├── src/sockets/ # WebSocket server for live updates
│   └── test/        # Server unit tests
├── web/             # React 19 + Vite + Tailwind v4 Dashboard (Port 5173)
│   ├── src/pages/   # Overview, Items, Holders, Masha Registry, Scans, Users
│   ├── src/components/ # Modals, data tables, live feed, anomaly center
│   ├── src/context/ # AuthContext and state
│   └── src/hooks/   # Data fetching & modal management hooks
├── mobile/          # Expo 52 (React Native Web) Mobile Scanner (Port 8081 / /scanner)
│   ├── App.tsx      # Main camera & barcode scanning UI
│   └── src/services/# API client, label parser, scanner presence/heartbeat
├── scripts/         # Monorepo version synchronization & git info generators
└── cloudbuild.yaml  # Google Cloud Build & Cloud Run continuous deployment
```

### Invariants Agents Must Respect
1. **Monorepo Version Parity**: The version string across all 5 manifest files (`package.json`, `web/package.json`, `server/package.json`, `mobile/package.json`, `mobile/app.json`) must remain identical at all times.
2. **SQLite Single-Instance Proxy**: Database access in the server *must* use the exported `db` proxy in [`server/src/db/database.ts`](file:///c:/dev/shelv.ai/server/src/db/database.ts). Never instantiate new `better-sqlite3` handles.
3. **Stateless Cloud Run + GCS Snapshot Sync**: The production backend runs on Cloud Run. Any state mutation triggers debounced checkpointing to GCS. Keep writes clean and transactional.
4. **Broadcast on Mutation**: When backend data changes (sweep scans, baseline uploads, manual moves, anomaly resolutions), always emit a WebSocket broadcast so connected dashboards update in real time.
5. **Hebrew / RTL Support**: Asset names, room names, holder names, and MASHA descriptions are commonly in Hebrew. Preserve UTF-8 encoding, Hebrew string parsing, and RTL UI compatibility.

---

## 2. Backend & Database Engineering Guidelines

### Database Architecture (`better-sqlite3`)
- **Connection**: Synchronous API with WAL (`Write-Ahead Logging`) mode and foreign key constraints enabled.
- **Proxy Pattern**: `export const db = new Proxy(...)` in `database.ts` handles lazy database initialization and GCS restore.
- **Schema Migrations**:
  - We do not use an external migration runner like Prisma or Knex.
  - All migrations are written defensively inside `initDatabase()` in [`server/src/db/database.ts`](file:///c:/dev/shelv.ai/server/src/db/database.ts).
  - When introducing columns or indexes, inspect existing schema via `PRAGMA table_info(table_name)` or use `CREATE ... IF NOT EXISTS`.
  ```ts
  // Example schema migration pattern in database.ts:
  const cols = db.prepare("PRAGMA table_info(my_table)").all() as Array<{ name: string }>;
  if (!cols.some(c => c.name === 'new_field')) {
    db.exec("ALTER TABLE my_table ADD COLUMN new_field TEXT;");
  }
  ```

### Cloud Persistence (`gcsStorageService.ts`)
- On startup, `restoreDatabaseFromGCS()` downloads the latest snapshot from `GCS_BUCKET_NAME`.
- The Express middleware schedules a debounced backup (`scheduleDebouncedBackup()`) after any successful `POST`, `PUT`, `DELETE`, or `PATCH`.
- Online backups use `db.backup(tempPath)` followed by GCS upload to ensure zero-lock, ACID consistency.

### WebSocket Communication (`socketServer.ts`)
The server broadcasts events using `broadcast(event, data)`:

| Event Name | Trigger | Payload |
| :--- | :--- | :--- |
| `INVENTORY_SYNCED` | Baseline Excel imported or items modified | Summary counts / diff |
| `ANOMALIES_UPDATED` | Scans performed or resolutions logged | Full recalculation of anomalies |
| `SWEEP_UPDATED` | Observation recorded or deleted | Scan record + room stats |
| `ACTION_LOGGED` | Reversible action created | Action history entry |
| `SCANNER_PRESENCE_UPDATE` | Scanner heartbeat / disconnect | Active online scanners array |

---

## 3. Frontend Web Guidelines (`web/`)

### Stack
- **Framework**: React 19 + TypeScript + Vite 8
- **Styling**: Tailwind CSS v4 with PostCSS. Use CSS variables and `@theme` directives rather than Tailwind v3 plugin configurations.
- **Icons**: `lucide-react`
- **Routing**: `react-router-dom` v7 with hash or browser history depending on environment.

### Component Conventions
- Pages are organized in [`web/src/pages/`](file:///c:/dev/shelv.ai/web/src/pages).
- Stateful business components reside in [`web/src/components/`](file:///c:/dev/shelv.ai/web/src/components).
- Custom hooks in [`web/src/hooks/`](file:///c:/dev/shelv.ai/web/src/hooks) decouple API querying, modal toggles, and Excel exports from presentation components.
- Always handle both Hebrew and English strings gracefully. Ensure tables with Hebrew text have appropriate text alignment (`text-right` or RTL wrappers where needed).

---

## 4. Mobile Scanner Guidelines (`mobile/`)

### Stack & Build Target
- **Framework**: Expo 52 (React Native) targeting **Web / PWA**.
- **Production Export**: `pnpm build:web` outputs static assets to `mobile/dist`.
- **Mount Point**: The backend Express server mounts `mobile/dist` at `/scanner` and static assets at `/_expo`.

### Scanning Pipeline
1. **Camera Feed**: Utilizes `expo-camera` or HTML5 `<video>` feed on web.
2. **Barcode Engine**: `@zxing/browser` and `@zxing/library` detect 1D/2D barcodes (Code 128, Code 39, QR).
3. **OCR Engine**:
   - Primary: Client-side `tesseract.js` for on-device serial number and label detection.
   - Cloud AI Fallback: If OCR is ambiguous or enabled by user, images can be sent to Google Cloud Vertex AI (Gemini 2.5 Flash) via `geminiVisionService.ts`.
4. **Heartbeat / Presence**: The scanner periodically hits `/api/sweep/scanners/heartbeat` so the web dashboard displays active scanners in real time.

---

## 5. Versioning & Monorepo Tooling (`scripts/`)

Always keep manifest versions in sync. Never manually bump a single `package.json` without bumping the rest.

- **Check Parity**:
  ```bash
  pnpm version:check
  ```
- **Synchronize / Bump**:
  ```bash
  # Automatically increments patch (1.0.0 -> 1.0.1) across all manifests
  pnpm version:bump patch

  # Minor or major bumps:
  pnpm version:bump minor
  pnpm version:bump major
  ```
- **Git Metadata**:
  `scripts/git-info.cjs` writes `version.ts` files containing commit SHA, branch name, and version number for server, web, and mobile during prebuild or CI.

---

## 6. Development Checklist for Agents

When implementing new features or fixes:

1. **Schema Change?**
   - Update `initDatabase()` in `server/src/db/database.ts` with idempotent migration logic.
   - Verify foreign key constraints and index additions.
2. **API Endpoint Change?**
   - Update the respective router in `server/src/routes/`.
   - Ensure role check (`requireRole(['manager'])`) is applied if the action is restricted.
   - Call `broadcast(...)` if the change should reflect immediately on the dashboard.
   - Update frontend API clients in `web/src/` and `mobile/src/services/api.ts`.
3. **Type Parity?**
   - Keep TypeScript interfaces aligned between `server/src/`, `web/src/types.ts`, and `mobile/src/services/api.ts`.
4. **Verification**:
   - Run `pnpm version:check` to ensure package metadata is intact.
   - Run `pnpm --dir server build` to ensure backend TypeScript compiles.
   - Run `pnpm --dir web build` (or `pnpm --dir web lint`) to verify frontend health.
