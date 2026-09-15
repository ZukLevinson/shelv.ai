# shelv.ai Server (`server/`)

> **Express 4 + TypeScript Backend Engine for Inventory Audits, Real-Time WebSockets & Vision AI**

The `server` package provides the backend REST API, database persistence engine, real-time WebSocket broadcast hub, and background services for the `shelv.ai` platform.

---

## Architecture & Directory Structure

```
server/
├── src/
│   ├── auth/           # JWT authentication middleware & password utilities
│   │   ├── authMiddleware.ts   # authenticateToken, requireRole
│   │   └── authUtils.ts        # Password hashing & JWT generation
│   ├── db/             # SQLite connection, proxy, schema & migrations
│   │   └── database.ts         # better-sqlite3 singleton proxy and migrations
│   ├── routes/         # Express REST API routes
│   │   ├── actionRoutes.ts     # Action history & undo / revert endpoints
│   │   ├── anomalyRoutes.ts    # Discrepancy calculations & anomaly resolutions
│   │   ├── authRoutes.ts       # Login, register, profile, coupled holder
│   │   ├── inventoryRoutes.ts  # Rooms, holders, official baseline, masha registry
│   │   ├── sweepRoutes.ts      # Active sweeps, scan observations, scanner presence
│   │   └── userRoutes.ts       # User management, roles, and onboarding
│   ├── services/       # Core business logic & external integrations
│   │   ├── actionService.ts          # State tracking & reversible actions
│   │   ├── anomalyService.ts         # Discrepancy & anomaly detection algorithms
│   │   ├── emailAlertService.ts      # Email notifications for discrepancies
│   │   ├── excelExportService.ts     # In-memory Excel export generation
│   │   ├── excelImportService.ts     # Ingestion of baseline inventory workbooks
│   │   ├── gcsStorageService.ts      # SQLite online backup & restore from GCS
│   │   ├── geminiVisionService.ts    # Vertex AI Gemini 3 (3.8 Flash & 3.1 Flash Lite) OCR & Vision
│   │   ├── scanExcelImportService.ts # Batch sweep observation imports from Excel
│   │   └── sweepService.ts           # Sweep session lifecycle & room progress
│   ├── sockets/        # Real-time WebSocket broadcasting
│   │   └── socketServer.ts     # WebSocket server (/ws) & broadcast helpers
│   ├── utils/          # Formatting & utility functions
│   │   └── mashaUtils.ts       # Normalization & parsing of MASHA identifiers
│   ├── server.ts       # Main entry point & static asset mounter
│   └── version.ts      # Runtime server version & commit metadata
├── test/               # Server unit tests
│   └── scanExcelImportService.test.ts
├── package.json
└── tsconfig.json
```

---

## Database & Persistence (`src/db/database.ts`)

- **Engine**: SQLite managed via `better-sqlite3` in WAL (`Write-Ahead Logging`) mode.
- **Connection Proxy**: `db` is exported as a transparent ES Proxy around `openDatabase()`. This allows the server to download the latest SQLite snapshot from Google Cloud Storage *before* any query runs, without altering standard `db.prepare(...)` syntax.
- **Auto-Persistence (GCS)**:
  - When running in cloud containers, `restoreDatabaseFromGCS()` downloads `shelv.db` upon server boot.
  - A global Express middleware intercepts modifying HTTP requests (`POST`, `PUT`, `DELETE`, `PATCH`) and invokes `scheduleDebouncedBackup()`.
  - Checkpointed snapshots are created via `db.backup(...)` and uploaded to `gs://${GCS_BUCKET_NAME}/${GCS_DB_OBJECT_NAME}`.

### Database Tables

| Table | Purpose |
| :--- | :--- |
| `inventory_holders` | Custodians / asset owners (name, personal_number, email, phone) |
| `rooms` | Physical storage spaces assigned to holders (name, code, holder_id) |
| `official_inventory` | Ground-truth expected baseline (masha, serial_number, description, room_id, holder_id) |
| `sweep_sessions` | Audit sessions per room (room_id, swept_by, status, timestamps) |
| `sweep_observations` | Individual scans recorded in a room (sweep_id, room_id, masha, serial_number, OCR text) |
| `anomaly_resolutions` | Resolutions applied to discrepancies (transfer approvals, manual corrections) |
| `masha_registry` | Global catalog mapping MASHA numbers to descriptions and categories |
| `excel_imports` | History of uploaded baseline Excel files |
| `users` | User accounts with roles (`manager`, `inventory_owner`, `scanner`) and personal numbers |
| `action_history` | Audit log tracking operations with serialized previous states for undo/reversal |
| `email_alerts` | Log of sent discrepancy notifications |

---

## REST API Overview

All API endpoints are mounted under `/api`:

### Authentication & Users (`/api/auth`, `/api/users`)
- `POST /api/auth/login`: Authenticate email/password, returns JWT token and user profile.
- `POST /api/auth/register`: Register new user account.
- `GET /api/auth/me`: Fetch authenticated user profile and coupled holder info.
- `POST /api/auth/onboarding`: Complete initial user profile setup.
- `GET /api/users`: List all users (Manager only).
- `PATCH /api/users/:id/role`: Update user permissions and manager flag.

### Inventory & Baseline (`/api/inventory`)
- `GET /api/inventory/baseline`: Query official items with optional room, holder, or search filters.
- `GET /api/inventory/holders`: List holders with room counts and item statistics.
- `POST /api/inventory/holders`: Create or edit an inventory holder.
- `GET /api/inventory/rooms`: List rooms and sweep completion metrics.
- `POST /api/inventory/rooms`: Create or update room assignments.
- `GET /api/inventory/masha-registry`: List known MASHA entries and classifications.
- `POST /api/upload-excel`: Ingest organizational Excel sheet to establish official baseline.
- `GET /api/export-excel`: Download complete inventory export workbook.
- `GET /api/sample-excel`: Download blank template for baseline imports.

### Sweep Audits (`/api/sweep`)
- `POST /api/sweep/scan`: Record a new scan observation (barcode / MASHA / OCR) in a room.
- `GET /api/sweep/observations`: Query recent sweep observations.
- `DELETE /api/sweep/scans/:id`: Delete / revert an incorrect scan.
- `POST /api/sweep/scanners/heartbeat`: Register active mobile scanner presence.
- `POST /api/sweep/scanners/disconnect`: Explicit scanner disconnect notification.
- `GET /api/sweep/scanners`: List online scanners.

### Anomalies & Discrepancies (`/api/anomalies`)
- `GET /api/anomalies`: Compute and return unauthorized transfers, quota mismatches, missing items, and internal moves.
- `POST /api/anomalies/resolve`: Apply official resolution (transfer item, update baseline, or dismiss).
- `GET /api/anomalies/investigate/:sn`: Detailed history of a serial number across sweeps.

### Actions & Audit Log (`/api/actions`)
- `GET /api/actions`: Retrieve recent action history log.
- `POST /api/actions/:id/revert`: Undo/revert a previously executed action using its stored before-state.

---

## Real-Time WebSocket Server (`/ws`)

The WebSocket engine (`src/sockets/socketServer.ts`) broadcasts real-time system events to connected web clients:

- `INVENTORY_SYNCED`: Emitted when baseline imports complete.
- `ANOMALIES_UPDATED`: Emitted when scans or resolutions change discrepancy states.
- `SWEEP_UPDATED`: Emitted when a physical scan observation is added or deleted.
- `ACTION_LOGGED`: Emitted when an audit action is recorded.
- `SCANNER_PRESENCE_UPDATE`: Emitted when mobile scanners connect, heartbeat, or disconnect.

---

## External Integrations

### 1. Google Vertex AI (Gemini 3)
- Implemented in [`src/services/geminiVisionService.ts`](file:///c:/dev/shelv.ai/server/src/services/geminiVisionService.ts).
- Provides server-side OCR parsing of equipment labels, extracting MASHA codes, serial numbers, product names, and owner tags directly from captured photos using `gemini-3.8-flash`.
- Features lightning-fast live mobile camera stream qualification using `gemini-3.1-flash-lite`.
- Configured with `thinkingBudget: 0` for ultra-low latency response times without deliberation delay.

### 2. Google Cloud Storage
- Implemented in [`src/services/gcsStorageService.ts`](file:///c:/dev/shelv.ai/server/src/services/gcsStorageService.ts).
- Provides durable automated persistence for the embedded SQLite database on serverless runtimes.

---

## Environment Variables

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `PORT` | HTTP & WebSocket listen port | `4000` (Local) / `8080` (Cloud Run) |
| `DB_PATH` | Filepath to SQLite database file | `server/shelv.db` |
| `GCS_BUCKET_NAME` | Cloud Storage bucket for automated DB backups | `shelv-ai-db-<project-id>` |
| `GCS_DB_OBJECT_NAME` | Name of database snapshot file in GCS | `shelv.db` |
| `GOOGLE_CLOUD_PROJECT` | GCP project ID for Vertex AI and GCS | `shelv-ai` |
| `VERTEX_LOCATION` | Region for Vertex AI API requests | `us-central1` |
| `VERTEX_MODEL` | Primary Gemini model for image OCR and PDF table analysis | `gemini-3.8-flash` |
| `VERTEX_FAST_MODEL` | Fast Gemini model for real-time mobile camera frame triage | `gemini-3.1-flash-lite` |
| `JWT_SECRET` | Secret key for JWT token signing | `shelv-ai-super-secret-key-...` |
| `CLIENT_BUILD_PATH` | Path to built web dashboard static files | `../web/dist` |
| `MOBILE_BUILD_PATH` | Path to built mobile scanner PWA static files | `../mobile/dist` |

---

## Development Commands

```bash
# Start server in watch mode with tsx
pnpm dev

# Compile TypeScript to dist/
pnpm build

# Start compiled server
pnpm start

# Run unit tests
pnpm test
```
