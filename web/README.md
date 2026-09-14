# shelv.ai Web Dashboard (`web/`)

> **React 19 + Vite + Tailwind CSS v4 Administrative & Auditing Dashboard**

The `web` package contains the desktop and tablet web dashboard used by managers, inventory owners, and auditors. It provides real-time visibility into warehouse sweeps, displays anomaly alerts, manages custodians and storage rooms, and coordinates baseline Excel imports.

---

## Tech Stack

- **UI Library**: [React 19](https://react.dev/)
- **Build Tool**: [Vite 8](https://vite.dev/) with Fast Refresh
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) with `@tailwindcss/postcss`
- **Routing**: [React Router v7](https://reactrouter.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **HTTP Client**: [Axios](https://axios-http.com/)
- **Spreadsheet Processing**: [SheetJS (xlsx)](https://docs.sheetjs.com/)
- **Linter**: [Oxlint](https://oxc.rs/)

---

## Directory Structure

```
web/src/
├── assets/          # Static logos and graphic assets
├── components/      # UI components and modals
│   ├── layout/      # Navbar, sidebar, and container layout wrappers
│   ├── ui/          # Generic atomic UI elements (buttons, badges, inputs)
│   ├── ActionHistoryModal.tsx   # Reversible audit log & undo panel
│   ├── AnomaliesCenter.tsx      # Discrepancy triage & resolution center
│   ├── CategoryLogo.tsx         # Visual category icons & badges
│   ├── CategoryPicker.tsx       # Equipment category selector
│   ├── EditPersonalNumberModal.tsx
│   ├── ExcelUploadModal.tsx     # Ingest official baseline spreadsheets
│   ├── HoldersManagement.tsx    # Custodian cards & assigned room view
│   ├── InventoryCatalog.tsx     # Filterable baseline inventory table
│   ├── LiveFeed.tsx             # Real-time WebSocket observation stream
│   ├── LoginScreen.tsx          # User login and registration view
│   ├── MashaCreateModal.tsx     # Add new catalog item to MASHA registry
│   ├── MashaEditModal.tsx       # Modify existing MASHA definition
│   ├── MashaRegistryTable.tsx   # Global catalog table
│   ├── OnboardingModal.tsx      # First-time profile & personal number setup
│   ├── RoomGrid.tsx             # Visual grid of physical rooms & audit status
│   ├── RoomManagementModal.tsx  # Add / edit rooms & custodian assignments
│   ├── ScanExcelUploadModal.tsx # Ingest bulk scan observations from Excel
│   ├── ScanManagement.tsx       # Audit observation browser
│   ├── UndoToast.tsx            # Floating action undo notification
│   ├── UserManagement.tsx       # User listing, roles & manager toggle
│   └── VersionBadge.tsx         # Git commit SHA, branch & version display
├── constants/       # App constants and category definitions
├── context/         # React Context providers
│   └── AuthContext.tsx          # JWT authentication, session, and user profile
├── hooks/           # Custom React hooks
│   ├── useAppModals.ts          # Centralized modal open/close state
│   ├── useExcelExport.ts        # Client-side workbook export triggers
│   ├── useInventoryData.ts      # Fetching & caching baseline, rooms & holders
│   ├── useInventoryFilter.ts    # Search, category, and room filtering logic
│   └── usePageTitle.ts          # Document title synchronizer
├── pages/           # Page route components
│   ├── HoldersPage.tsx          # Custodian & holder directory
│   ├── ItemsPage.tsx            # Baseline inventory items catalog
│   ├── MashaRegistryPage.tsx    # Standard equipment catalog
│   ├── OverviewPage.tsx         # Dashboard KPI overview & live panels
│   ├── ScansPage.tsx            # Recent scan observations feed
│   └── UsersPage.tsx            # User permissions & administration
├── routes/          # Route declarations
│   └── AppRoutes.tsx            # Page routing & protected route wrappers
├── types/           # Navigation and localized type definitions
├── config.ts        # API base URL and WebSocket endpoint configuration
├── types.ts         # TypeScript models matching backend entities
└── version.ts       # Git commit SHA, branch, and version string
```

---

## Core Features & Workflows

### 1. Real-Time Overview Dashboard (`OverviewPage.tsx`)
- Displays top-level audit statistics: Total expected baseline items, verified items, active scanners, and open discrepancies.
- Houses the **LiveFeed** component, listening to WebSocket events for real-time audit scans happening on the mobile scanner.
- Embeds the **AnomaliesCenter** for rapid triage of misplaced equipment.

### 2. Anomaly Resolution Center (`AnomaliesCenter.tsx`)
Automatically classifies discrepancies into actionable categories:
- **Unauthorized Transfers**: Displays items physically discovered in a room assigned to a different custodian, with quick actions to reassign or investigate.
- **Quota Discrepancies**: Highlights differences between expected item quantities and actual observed counts for each holder.
- **Missing Items**: Lists items present in the baseline that have not yet been discovered in any sweep.
- **Internal Moves**: Tracks items that moved between rooms belonging to the same holder.

### 3. Baseline Inventory Management (`ItemsPage.tsx` & `ExcelUploadModal.tsx`)
- Allows managers to upload official organizational spreadsheets (`.xlsx`).
- Maps columns (MASHA, Serial Number, Description, Room, Holder).
- Generates instant reports on baseline additions and updates.

### 4. Custodians & Storage Rooms (`HoldersPage.tsx`)
- Organizes physical spaces by assigned holder (e.g. personal number, name, phone).
- Tracks audit progress per room: shows the percentage of expected items scanned.

### 5. Action History & Undo (`ActionHistoryModal.tsx`)
- Every critical mutation (resolving an anomaly, deleting a scan, updating an item) writes an audit record.
- The **UndoToast** and **ActionHistoryModal** allow managers to immediately reverse unintentional changes with a single click.

---

## Real-Time WebSocket Integration

The web dashboard connects to the backend WebSocket server at `/ws` (configured in [`src/config.ts`](file:///c:/dev/shelv.ai/web/src/config.ts)).

When messages arrive:
- `INVENTORY_SYNCED`: Invalidates baseline caches and updates metrics.
- `ANOMALIES_UPDATED`: Refreshes the active anomaly list in place.
- `SWEEP_UPDATED`: Prepends new observations to the `LiveFeed` without full page refresh.
- `SCANNER_PRESENCE_UPDATE`: Updates the active scanner badge in the header.

---

## Development & Build Commands

```bash
# Start Vite development server with HMR (port 5173)
pnpm dev

# Typecheck and build optimized production bundle (to dist/)
pnpm build

# Run Oxlint on frontend source code
pnpm lint

# Preview production build locally
pnpm preview
```

### Production Integration
In Docker / production deployments, `pnpm build` outputs to `web/dist`. The Express backend mounts this folder to serve the single-page application at `/`.
