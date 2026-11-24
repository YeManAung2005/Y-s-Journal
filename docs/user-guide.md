# User Guide

> **Status: Phase 1.** Owner setup, sign-in, workspace locking, and preferences are available. Trading, Learning, Daily Journal, Calendar, Poster Studio, analytics, and backups are not implemented yet.

## First launch

1. Open `http://127.0.0.1:5173` (development) or `http://127.0.0.1:4000` (production build).
2. Create the owner account. This is one-time setup; registration is closed afterward.
3. Enter a display name, email, and a password of at least 12 characters containing a letter and a number.
4. You are signed in automatically. No sample data is created.

## Signing in and out

- Sign in with the owner email and password.
- Sign out from the sidebar (desktop) or header (mobile). Signing out revokes the server session.
- A session expires after 7 days without activity. Sign in again if it expires.

## Automatic lock

- The workspace locks after 15 minutes of inactivity.
- Mouse, keyboard, touch, and scroll activity reset the timer.
- Enter the owner password to unlock. The server verifies it.
- You can lock manually with **Lock** in the sidebar or **Lock now** in Settings.

## Overview

The Overview shows API and MongoDB status, uptime, session expiry, the Phase 1 security baseline, and the next planned phase. It contains no personal records.

## Settings

Open **Settings** from the navigation.

### Appearance

- Theme: Dark, Light, or System.
- Text size: 80%–150%.
- Reduce motion: disables animations and transitions.

### Time and goals

- App time zone: used for journal and learning dates. Default `Asia/Yangon`.
- Trading time zone: used for trade and session dates. Default `America/New_York`.
- Daily study target: minutes per day. Default 60.

Changes are saved only when you select **Save preferences**.

### Security

- Current session expiry.
- Lock now / Sign out.
- Change password: other sessions are signed out when the password changes.
- Security activity: recent sign-ins, failed sign-ins, unlocks, logouts, password changes, and blocked requests.

## Privacy

- Personal Journal entries are not implemented yet. When added, they will be structurally isolated from trading analytics, learning analytics, dashboard, posters, and public sharing.
- All records are scoped to the single owner account.
- Logs never include passwords, passphrases, cookies, or tokens.

## Future modules

### Trading

Post-trade journal for NQ, ES, MNQ, and MES with accounts, partial exits, fees, risk, R-multiple, screenshots, emotions, and analytics.

### Learning

Study records, categories, daily goals, streaks, resources, attachments, and long-term goals.

### Daily Journal

One private entry per day with mood, gratitude, reflection, priorities, and quick notes.

### Calendar and Poster Studio

Activity views and PNG posters using only explicitly allowed trading or learning data.
