# Y's Journal

A private, locally hosted personal productivity workspace combining a **Trading Journal**, a **Learning Tracker**, and a **Personal Daily Journal**.

> **Current status: Phase 0 — Foundation only.** The application shell, API health endpoint, local MongoDB connectivity check, test tooling, and documentation foundations exist. Trading, Learning, Personal Journal, analytics, backups, offline sync, and the Windows installer are **not implemented yet**. No sample data has been created.

## Product boundaries

- Trading, Learning, and Personal Journal are separate modules with separate schemas, services, routes, and exports.
- Personal Journal data is private and must never appear in trading analytics, learning analytics, dashboard widgets, posters, or public sharing.
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
| Offline      | Service Worker + IndexedDB (planned)                                    |
| Backups      | Google Drive OAuth + AES-256-GCM (planned)                              |
| Testing      | Vitest, Supertest, React Testing Library, Playwright (planned)          |

Exact versions are pinned in `package.json` and `package-lock.json`. The approved version matrix and environment report are in [docs/environment.md](docs/environment.md).

## Requirements

- Windows 11 x64
- Node.js **26.x LTS**
- npm **11.x**
- MongoDB Community **9.x** running locally on `127.0.0.1:27017`
- Chrome or Edge

The current host has Node `26.13.0`, npm `11.20.0`, Git `2.56.0`, and MongoDB `9.0.4`.

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
src/shared     Shared constants, validation, and financial engine (future phases)
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

- `.env`, database files, screenshots, attachments, backups, certificates, encryption keys, and OAuth credentials are ignored by Git.
- MongoDB currently listens only on `127.0.0.1`. It must never be exposed to the LAN.
- Express is the only intended LAN-facing service.
- LAN access will use trusted local HTTPS in the Windows setup phase. The current development server is HTTP on loopback only.
- Authentication, CSRF protection, session management, rate limiting, and file authorization are planned for Phase 1 and later. Do not expose the current development API to other devices.

## GitHub

The local repository is initialized on `main`. Creating the private `ys-journal` repository requires GitHub CLI authentication, which is pending.
