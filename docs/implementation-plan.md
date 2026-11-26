# Approved Implementation Plan

The project is implemented one approved phase at a time. Each phase ends with tests, lint, build, documentation, local verification, and a review gate.

**Completed:** Phase 0 (foundation), Phase 1 (security and settings), Phase 2 (financial engine and reference data), Phase 3 (trading journal core), Phase 4 (trading analytics), Phase 5 (learning tracker), Phase 6 (Personal Daily Journal), Phase 7 (custom dashboard and calendar), and Phase 8 (Poster Studio).

Phase 7 replaced the Foundation/Overview page with the Custom Dashboard at `/` and enabled the Calendar at `/calendar`. Dashboard layouts are owner-scoped and versioned; widget data and calendar totals are derived only from trading, learning, and activity data. The optional neutral journal marker is controlled by the owner's `calendarJournalIndicator` setting and never exposes journal content.

Phase 8 added Poster Studio at `/posters`: owner-scoped poster configurations, three visual templates, three canvas sizes, live canvas preview, and local PNG export. It also added a single-trade ROI poster that selects one owner-scoped completed trade and computes selected-basis P&L ÷ selected risk. Poster data uses an explicit allowlist of trading analytics, learning summaries, or completed-trade totals; journal models, journal content fields, and private trade content fields are never imported.

## Approved defaults

- Coding environment: OpenCode.
- Project path: `C:\Users\real_yezz\Documents\YsJournal`.
- Database: existing local MongoDB 9.0.4, database `ys_journal`.
- Network/system changes: performed only when the relevant phase requires them, with explicit prompts for elevated actions.
- Backup keys: random Backup Data Key wrapped by the user passphrase plus optional Windows DPAPI auto-unlock wrapper.
- Missing fees: strict. Net values and calculated balance are unavailable until fees are entered.
- Google Drive: OAuth client configured by the user during onboarding or later.
- Version control: local workspace only; no remote repository workflow.
- Account: one editable default account with a `$0.00` starting balance and no sample trades.
- MongoDB: standalone; no multi-document transactions. Use idempotency, optimistic concurrency, staging, and safety backups.

## Phases

| Phase | Scope                                                                                |
| ----- | ------------------------------------------------------------------------------------ |
| 0     | Foundation, documentation, app/API shell, health check, test tooling                 |
| 1     | Owner onboarding, authentication, sessions, auto-lock, security logs, settings       |
| 2     | Financial engine, instruments, accounts, tags, sessions, checklist, reference data   |
| 3     | Trading journal core, partial exits, fees, risk, screenshots, emotions, reviews      |
| 4     | Trading analytics, filters, comparisons, equity curves, drawdown, streaks            |
| 5     | Learning records, categories, streaks, goals, milestones, attachments                |
| 6     | Personal Daily Journal, quick notes, search, reminders, privacy isolation            |
| 7     | Custom dashboard, widget library, calendar views                                     |
| 8     | Poster Studio, templates, live preview, PNG export                                   |
| 9     | Offline cache, encrypted IndexedDB, queued mutations, conflict resolution, auto-lock |
| 10    | Google Drive backups, encryption, verification, recovery key, safe restore           |
| 11    | Storage dashboard, limit warnings, trash, audit, exports, localization               |
| 12    | Security, privacy, accessibility, responsive, performance, browser hardening         |
| 13    | Windows installer, local HTTPS, firewall, service, startup, health, updates          |
| 14    | Final acceptance, full test pass, backup/restore drill, documentation, release tag   |

Phases 0–9 are implemented and verified. Phase 9 added shell-only service worker caching, encrypted IndexedDB records, queued idempotent mutations, conflict resolution, and offline-aware locking. Phases 10–14 remain planned.

## Phase gate

1. Run tests.
2. Run lint.
3. Run production build.
4. Fix failures.
5. Verify functionality.
6. Update docs.
7. Show changes.
8. Wait for approval.

No phase may silently skip requirements, replace real functionality with mock data, change financial formulas, or add unresolved security risks.
