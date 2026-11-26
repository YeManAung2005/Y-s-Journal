# Environment and Version Report

Inspection date: 2026-11-24

## Host

| Check            | Result                                                                   |
| ---------------- | ------------------------------------------------------------------------ |
| OS               | Windows 11 Home Single Language, 64-bit, build 26300                     |
| CPU              | 12 logical processors                                                    |
| Memory           | 7.3 GB                                                                   |
| Disk             | `C:` 102.51 GB free at inspection time                                   |
| Time zone        | `Asia/Yangon` (UTC+06:30)                                                |
| Hostname         | `whiteDemon`                                                             |
| Wi-Fi            | `192.168.100.12/24`                                                      |
| Network profile  | **Public** at inspection time; must be changed to Private for LAN access |
| Firewall         | Enabled for Domain, Private, and Public profiles                         |
| Windows Defender | Antivirus and real-time protection enabled                               |

## Runtime and tools

| Tool                   | Version / state                                                              |
| ---------------------- | ---------------------------------------------------------------------------- |
| Node.js                | `26.13.0` LTS (“Lithium”), x64                                               |
| npm                    | `11.20.0`                                                                    |
| npm PowerShell shim    | `npm.ps1` blocked by execution policy; use `npm.cmd`                         |
| MongoDB Community      | `9.0.4`                                                                      |
| MongoDB service        | Running, Automatic, `NT AUTHORITY\NetworkService`                            |
| MongoDB binding        | `127.0.0.1:27017`                                                            |
| MongoDB config         | `C:\Program Files\MongoDB\Server\9.0\bin\mongod.cfg`                         |
| MongoDB data           | `C:\Program Files\MongoDB\Server\9.0\data`                                   |
| `mongosh`              | Not installed                                                                |
| MongoDB PATH           | PATH references a missing `8.0` directory; use absolute paths or the service |
| Chrome                 | `158.0.8127.36`                                                              |
| Edge                   | `158.0.4370.33`                                                              |
| OpenSSL                | Available locally                                                            |
| Inno Setup             | Not installed; planned for Phase 13                                          |
| NSSM / service wrapper | Not installed; planned for Phase 13                                          |

## Approved runtime decisions

- Project path: `C:\Users\real_yezz\Documents\YsJournal`
- Local workspace only; no remote repository or cloud service is used.
- Use existing local MongoDB 9.0.4 and create only the `ys_journal` database.
- Do not expose MongoDB to the LAN.
- Keep standalone MongoDB for the first release; use idempotency, optimistic concurrency, staging, and safety backups instead of multi-document transactions.
- Use a trusted local HTTPS certificate in the Windows setup phase.
- Install a background application service in Phase 13.
- Use the approved hybrid backup key strategy: passphrase-wrapped backup key plus optional Windows DPAPI auto-unlock wrapper.
- Strict missing-fee behavior: net values are unavailable until fees are entered.
- Create one editable default trading account with a starting balance of `$0.00`; no sample trades.

## Pinned package versions

| Package                      | Version  |
| ---------------------------- | -------- |
| React / React DOM            | 19.3.1   |
| Vite                         | 8.3.8    |
| Tailwind CSS / Vite plugin   | 4.3.5    |
| TanStack Router              | 1.170.46 |
| TanStack Router plugin       | 1.169.0  |
| TanStack Query               | 5.108.4  |
| Dexie                        | 4.4.7    |
| `vite-plugin-pwa` / Workbox  | 2.0.0    |
| `fake-indexeddb` (test)      | 6.2.8    |
| Express                      | 5.3.0    |
| Mongoose                     | 9.13.0   |
| decimal.js                   | 10.6.0   |
| Argon2id (`@node-rs/argon2`) | 2.2.2    |
| Express rate limit           | 8.7.5    |
| Multer                       | 2.5.0    |
| Sharp                        | 0.35.5   |
| Zod                          | 4.6.7    |
| Helmet                       | 8.3.0    |
| Pino                         | 10.4.0   |
| Pino HTTP                    | 11.0.0   |
| Vitest                       | 5.1.1    |
| Supertest                    | 7.3.2    |
| React Testing Library        | 16.3.3   |
| ESLint                       | 10.15.0  |
| Prettier                     | 3.10.1   |
| Lucide React                 | 1.78.0   |
| Radix Slot                   | 1.5.0    |

Offline dependencies are installed and pinned above. Future-phase dependencies such as Google APIs, ExcelJS, PDFKit, and `react-grid-layout` are documented in the approved plan and will be installed and pinned when their phase begins. The `vite-plugin-pwa` install reports four moderate advisories in development-only transitive packages; do not run an automatic major upgrade without review.
