# Y's Journal

A private, locally hosted personal productivity workspace combining a **Trading Journal**, a **Learning Tracker**, and a **Personal Daily Journal**.

> **Current status: Phase 9 — offline synchronization.** Owner security, settings, the server-authoritative financial engine, reference data, completed trades with partial exits/fees/risk/reviews, private screenshots, trading analytics, account adjustments, the Learning tracker, the private Personal Daily Journal with quick notes, search, and reminder settings, the Custom Dashboard, the Calendar, and the Poster Studio are implemented. Poster Studio includes trading, study, and single-trade ROI posters rendered locally to PNG. The app shell is cached offline, sensitive records and queued mutations are encrypted in IndexedDB, conflicts are user-resolved, and auto-lock clears the local key. Backups and the Windows installer are **not implemented yet**. No sample trades, learning records, or journal entries have been created.

## Product boundaries

- Trading, Learning, and Personal Journal are separate modules with separate schemas, services, routes, and exports.
- Trading Setup, Analytics, Learning, and Daily Journal open in view mode; entry forms appear only through deliberate actions, with optional fields behind **Show optional fields**. The Calendar remains available at `/calendar` but is no longer linked from the sidebar.
- Personal Journal data is private and must never appear in trading analytics, learning analytics, dashboard widgets, calendar responses, posters, or public sharing. The optional calendar journal marker is a neutral boolean only.
- The first release is English-only, with translation architecture prepared for future Burmese localization.
- Financial calculations are server-authoritative and use integer units, not JavaScript floating point.
- The app is browser-only. No PWA installation is required.
- No Docker, no MongoDB Atlas, no cloud database, no live market-data dependency, and no prop-firm tracking.

## Technology

| Layer        | Choice                                                                  |
| ------------ | ----------------------------------------------------------------------- |
| Frontend     | React 19, Vite 8, JavaScript/JSX, Tailwind CSS 4, shadcn/ui conventions |
| Routing      | TanStack Router                                                         |
| Server state | TanStack Query                                                          |
| Backend      | Node.js 26 LTS, Express 5, JavaScript                                   |
| Database     | MongoDB Community 9.0.4 via Mongoose 9                                  |
| Validation   | Zod 4                                                                   |
| Calculations | `decimal.js` with integer micro-USD, ticks, and quantity hundredths     |
| Screenshots  | Sharp re-encoding and authenticated private file delivery               |
| Offline      | Workbox service worker + encrypted Dexie IndexedDB cache                |
| Backups      | Google Drive OAuth + AES-256-GCM (planned)                              |
| Testing      | Vitest, Supertest, React Testing Library, Playwright (planned)          |

Exact versions are pinned in `package.json` and `package-lock.json`. The approved version matrix and environment report are in [docs/environment.md](docs/environment.md).

## Requirements

- Windows 11 x64
- Node.js **26.x LTS**
- npm **11.x**
- MongoDB Community **9.x** running locally on `127.0.0.1:27017`
- Chrome or Edge

The current host has Node `26.13.0`, npm `11.20.0`, and MongoDB `9.0.4`.

## Local development

PowerShell may block `npm.ps1`; use `npm.cmd` on this machine.

```powershell
cd C:\Users\real_yezz\Documents\YsJournal
Copy-Item .env.example .env
npm.cmd install
npm.cmd run check:mongo
npm.cmd run dev
```

Open `http://127.0.0.1:5173`.

The Vite development server proxies `/api` to the Express API on `http://127.0.0.1:4000`.

### Scripts

| Command                     | Purpose                                              |
| --------------------------- | ---------------------------------------------------- |
| `npm.cmd run dev`           | Run API and Vite together                            |
| `npm.cmd run dev:server`    | Run only the Express API with watch mode             |
| `npm.cmd run dev:client`    | Run only Vite                                        |
| `npm.cmd run check:mongo`   | Verify MongoDB connectivity and print server version |
| `npm.cmd run lint`          | ESLint                                               |
| `npm.cmd run format`        | Prettier write                                       |
| `npm.cmd run test`          | Vitest                                               |
| `npm.cmd run test:coverage` | Vitest with coverage                                 |
| `npm.cmd run build`         | Production client build                              |
| `npm.cmd run start`         | Production server after build                        |
| `npm.cmd run verify`        | Lint, test, and build                                |

## Project layout

```text
src/client     React application
src/server     Express API
src/shared     Shared constants, validation, and financial conversions
tests          Unit, integration, security, and E2E tests
scripts        Operational scripts
docs           Architecture, security, backup, testing, and setup documentation
installer      Windows installer assets (Phase 13)
```

## Documentation

- [Environment and version report](docs/environment.md)
- [Approved implementation plan](docs/implementation-plan.md)
- [Architecture](docs/architecture.md)
- [Database schema](docs/database-schema.md)
- [API reference](docs/api.md)
- [Financial calculations](docs/financial-calculations.md)
- [Security](docs/security.md)
- [Backup and recovery](docs/backup-recovery.md)
- [Offline synchronization](docs/offline-sync.md)
- [Testing](docs/testing.md)
- [Development workflow](docs/development-workflow.md)
- [Installation](docs/installation.md)
- [Windows setup](docs/windows-setup.md)
- [User guide](docs/user-guide.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Changelog](CHANGELOG.md)

## Security notes

- `.env`, database files, screenshots, attachments, backups, certificates, encryption keys, and OAuth credentials stay local and are never served by the app.
- MongoDB currently listens only on `127.0.0.1`. It must never be exposed to the LAN.
- Express is the only intended LAN-facing service.
- LAN access will use trusted local HTTPS in the Windows setup phase. The current development server is HTTP on loopback only.
- Authentication, CSRF protection, session management, rate limiting, security logging, auto-lock, owner settings, and private trade/file handling are implemented in Phases 1–3; Phases 4–8 add analytics, Learning, Personal Journal, dashboard, calendar, and poster isolation checks.
- Production uses `__Host-ysj_sid` and `__Host-ysj_csrf` Secure cookies; development uses non-prefixed cookies over local HTTP because HTTPS arrives in Phase 13.

## Local-only workflow

All work stays in this workspace. No remote repository or cloud service is used. Runtime data stays in the `ys_journal` MongoDB database and under `storage/`.
