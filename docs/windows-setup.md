# Windows Setup

> **Status: environment reviewed; production setup planned for Phase 13.**

## Current host configuration

- Windows 11 Home Single Language, 64-bit.
- Node.js 26.13.0 LTS.
- npm 11.20.0.
- Git 2.56.0.
- MongoDB Community 9.0.4, running as an Automatic Windows service.
- MongoDB bound to `127.0.0.1:27017`.
- Chrome and Edge installed.
- Wi-Fi `192.168.100.12/24`.
- Network profile: **Public** at inspection time.

## Required future changes, with approval

### Network profile

Change Wi-Fi to Private before LAN access:

```powershell
Set-NetConnectionProfile -InterfaceAlias "Wi-Fi" -NetworkCategory Private
```

This is an administrator-level system change and will be requested explicitly.

### Firewall

Allow only Express HTTPS on TCP 443, only on Private networks and the local subnet:

```powershell
New-NetFirewallRule `
  -DisplayName "Y's Journal HTTPS" `
  -Direction Inbound `
  -Protocol TCP `
  -LocalPort 443 `
  -Profile Private `
  -RemoteAddress LocalSubnet `
  -Action Allow
```

Do not create an inbound rule for MongoDB port 27017.

### HTTPS certificate

Generate a local CA and a server certificate with SANs for:

- `localhost`
- `127.0.0.1`
- The current LAN IP

Install the root CA on the host. Export the root for secondary devices and provide trust instructions. If the LAN IP changes, regenerate the leaf certificate.

### Background service

- Run the API as a Windows service.
- Start automatically.
- Restart after failure.
- Keep the browser closed until the user launches the shortcut.
- Expose health status in the app.
- Reconnect to MongoDB after sleep/wake.

### MongoDB

- Keep the service running.
- Keep it bound to `127.0.0.1`.
- Use only the `ys_journal` database.
- Do not expose it directly to the LAN.
- Do not open a firewall port for it.

### LAN access

- Host must be powered on and connected to Wi-Fi.
- Router client isolation must be disabled for the devices to communicate.
- No router port forwarding.
- No public internet exposure.
- Secondary devices must trust the local CA.

## Known environment issues

- `npm.ps1` is blocked by execution policy; use `npm.cmd`.
- `gh` is installed but not authenticated.
- MongoDB PATH references a missing 8.0 installation; use the service or absolute binary path.
- `mongosh` is not installed; it is optional.
- Inno Setup and a service wrapper are not installed yet.
