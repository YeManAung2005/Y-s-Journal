# Installation

> **Status: Phase 0 development installation only.** The one-click Windows installer is planned for Phase 13.

## Development installation

1. Confirm Node.js 26 LTS is installed:

```powershell
node --version
```

2. Confirm MongoDB 9 is running locally:

```powershell
Get-Service MongoDB
```

3. Enter the project:

```powershell
cd C:\Users\real_yezz\Documents\YsJournal
```

4. Create local configuration:

```powershell
Copy-Item .env.example .env
```

5. Install dependencies using `npm.cmd` because `npm.ps1` is blocked on this host:

```powershell
npm.cmd install
```

6. Check MongoDB connectivity:

```powershell
npm.cmd run check:mongo
```

Expected output:

```json
{
  "ok": true,
  "database": "ys_journal",
  "host": "127.0.0.1",
  "port": 27017,
  "serverVersion": "9.0.4"
}
```

7. Start development:

```powershell
npm.cmd run dev
```

8. Open `http://127.0.0.1:5173`.

## Production-like local run

```powershell
npm.cmd run build
npm.cmd run start
```

Open `http://127.0.0.1:4000`.

Production-like mode still uses HTTP on loopback in Phase 0. HTTPS, LAN binding, and background service installation are introduced in Phase 13.

## Configuration

`.env` is ignored by Git.

| Variable      | Default                                | Notes                                                      |
| ------------- | -------------------------------------- | ---------------------------------------------------------- |
| `NODE_ENV`    | `development`                          | Production start script sets `production`                  |
| `HOST`        | `127.0.0.1`                            | Do not change to `0.0.0.0` before HTTPS and firewall setup |
| `PORT`        | `4000`                                 | Express API                                                |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/ys_journal` | Local database only                                        |
| `LOG_LEVEL`   | `info`                                 | Pino log level                                             |

## Verification

```powershell
npm.cmd run verify
```

This runs lint, tests, and the production build.

## Future Windows installer

The Phase 13 installer will:

- Check Windows compatibility.
- Detect Node.js and MongoDB.
- Request approval before installing missing components.
- Configure HTTPS with a trusted local certificate.
- Configure Windows Firewall for Private networks only.
- Install the application service.
- Configure automatic startup and service recovery.
- Provide health checks and recovery instructions.
- Never silently download or install external components.
