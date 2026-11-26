# User Guide

> **Status: Phase 9.** Owner security, preferences, the financial calculator, trading reference data, completed trades, private screenshots, trading analytics, the Learning tracker, the Personal Daily Journal, the Custom Dashboard, the Calendar, the Poster Studio, and offline synchronization are available. Backups and the Windows installer are not implemented yet.

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
- Enter the owner password to unlock. The server verifies it when available; offline, the locally stored verifier verifies it.
- You can lock manually with **Lock** in the sidebar or **Lock now** in Settings.

## Offline workspace

- The app shell is cached locally. If the local server is unreachable, previously viewed allowlisted records remain readable from an encrypted local cache.
- The first sign-in or onboarding on a device prepares the encrypted cache. Cached data stays encrypted until you unlock it with your owner password.
- Unlocking and all sync status messages live in **Settings → Offline and sync**. After a refresh or lock, open Settings and enter your password there. No offline reminder is shown on other pages.
- Settings shows **Offline**, **Pending**, **Syncing**, **Synced**, **Conflict**, and **Blocked**. Supported changes replay automatically when the host is reachable, or you can select **Sync now** in that section.
- Locking clears the in-memory encryption key and cached query data; signing out also clears pending operations. Changing your password invalidates old cached data.
- If a record changed on the server while your change was pending, the status changes to **Conflict** in Settings. Your local version is kept. Choose **Keep server**, **Use mine**, **Merge manually**, or **Discard**. No choice is made for you.
- Validation or sign-in problems appear as **Blocked** with the server message in Settings.
- Large uploads can exceed browser storage quota. If that happens, the error is shown in Settings and pending changes are not silently removed.
- Open **Settings → App update** to check for a newer app shell or activate one that is ready. The app shell is only the workspace HTML, CSS, JavaScript, and fonts; your records and settings are unchanged. No PWA installation is required.

## Page layout

Trading Setup, Analytics, Learning, and Daily Journal open in view or analytics mode. Lists, summaries, charts, and saved records appear first; entry and edit forms stay hidden until you choose a deliberate action such as **Add account**, **New record**, **Add adjustment**, or **Write today’s entry**. Optional fields are grouped behind **Show optional fields**, so the first view stays compact.

The Calendar remains available at `/calendar`, but it is no longer linked from the desktop sidebar or the mobile header.

## Dashboard

Open **Dashboard** from the navigation. It opens at `/` and replaces the old Foundation/Overview page.

- The default layout shows four widgets: **Trading summary**, **Study rhythm**, **Activity calendar**, and **Goals in progress**.
- Trading summary shows trade count, selected-basis P&L, win rate, and average R for a configurable number of days. Net P&L stays **Unavailable** when fees are missing.
- Study rhythm shows today's minutes against your daily target, current and longest streaks, and the period total.
- Activity calendar is a full-width GitHub-style heatmap for the last 12 months. Days with trading or study activity fill with color; darker cells mean more activity. Hover a cell to see the date and totals.
- Goals in progress lists up to five active learning goals with server-calculated progress.
- No Personal Journal content appears in any dashboard widget.

Use the layout selector to switch layouts. Select **New layout** to reveal a compact name field and add a layout; this replaces the larger layout form. **Set default** changes the default, and **Delete** removes a non-default layout. The current default layout cannot be deleted; set another layout as default first.

Select **Customize** to show or hide widgets, change their size (Small, Medium, or Large), reorder them with the arrow buttons, and adjust the trading widget's basis (Gross or Net) and the trading/study day window (7–365 days). The Activity calendar is always full width, so its size control shows **Full width** instead of a size selector. Save the changes together; if another tab changed the layout, reload and retry instead of overwriting it.

## Trading setup

Open **Trading setup** from the navigation. The calculator result and reference-data lists load first. Use **Open calculator** to reveal the calculator form, and use each section's **Add** action to reveal its entry form.

- **Financial calculator** previews gross P&L, net P&L, R, and weighted average exit using the server's approved formulas. It stores nothing. Fees, initial stop, and manual risk are behind **Show optional fields**.
- **Trading accounts** starts with one editable `Main Account` at `$0.00`. Add more live or demo accounts, set a default, and archive unused accounts.
- **Instruments** includes NQ, MNQ, ES, and MES with approved specifications. You may edit specifications; historical trades will keep their own snapshots.
- **Tags** organize setups, market conditions, and custom labels.
- **Trading sessions** name the sessions you trade.
- **Pre-trade checklist** holds your own rules and reminders.

Use **Show archived** to view and restore archived records. Missing fees and missing risk are shown as **Unavailable**, never as zero.

## Trading journal

Open **Trading journal** from the navigation, then select **New trade**.

- Enter one account, instrument, direction, date, entry price, and total quantity.
- Add one or more partial exits. Exit quantities must add exactly to the total quantity.
- Enter actual total fees. If fees are left blank, net P&L, per-exit net values, and net outcome stay **Unavailable**.
- Add an initial stop or a manual risk amount to see R. Missing risk stays **Unavailable**.
- Choose a trading session, tags, checklist answers, emotions, rule violations, notes, lessons, and review fields.
- Attach up to five JPEG, PNG, or WebP screenshots per trade, each 10 MB or smaller. Images are re-encoded without metadata and served only to the owner.

The server recomputes every financial value and stores immutable snapshots of the account, instrument, session, tags, and checklist. Editing uses a version check, so a stale screen cannot silently overwrite a newer trade. Deleting a trade moves it and its screenshots to the trash; restoring the trade also restores screenshots deleted with it.

Select a trade in the list to see gross P&L, net P&L, gross R, weighted average exit, per-exit fee allocation, review notes, and screenshots.

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

### Reminders

- Daily journal reminder: off by default. When enabled, the Daily Journal page shows a local reminder after the chosen time if today's entry is missing.
- Reminder time: a 24-hour time in the app time zone. Default `20:00`.
- Reminders are local UI notices only; they contain no journal content.

### Privacy

- Calendar journal marker: off by default. When enabled, the Calendar shows a neutral marker on days with your active journal entries. No journal content is shown.

Changes are saved only when you select **Save preferences**.

### Security

- Current session expiry.
- Lock now / Sign out.
- Change password: other sessions are signed out when the password changes.
- Security activity: recent sign-ins, failed sign-ins, unlocks, logouts, password changes, and blocked requests.

## Privacy

- Personal Journal entries use separate models, services, routes, and UI. They are never read by trading analytics, learning analytics, dashboard widgets, posters, or public sharing.
- Learning records and attachments are owner-scoped and are never read by trading analytics or the dashboard.
- The Calendar can show a neutral journal-day marker when you enable it, but it never returns journal text, mood, gratitude, notes, priorities, or attachments. Other owners' entries are never marked.
- All records are scoped to the single owner account.
- Logs never include passwords, passphrases, cookies, or tokens.

## Trading analytics

Open **Analytics** from the navigation. Metrics, equity, breakdowns, and comparisons load first. Use **Add adjustment** in the Account adjustments card to reveal the adjustment form; the note is behind **Show optional fields**.

- Choose gross or net basis, date range, account, instrument, session, tag, direction, and outcome. All cards use the same filters.
- The summary shows selected-basis P&L, win rate, profit factor, average win/loss, average R with coverage, maximum drawdown, daily outcomes, and current/longest streaks.
- The equity card shows cumulative net P&L from `$0`. Select one account to include starting balance, deposits, withdrawals, corrections, and account balance.
- **Account adjustments** records deposits, withdrawals, and signed corrections. Deposits and withdrawals require positive amounts; corrections may be negative.
- Breakdowns group results by instrument, session, direction, tag, account, or day of week.
- Set a second date range to compare two periods with the same filters.

Net aggregates stay **Unavailable** when any selected trade is missing fees, and average R reports how many trades had valid risk. Analytics reads completed trades and account adjustments only; it never reads Daily Journal data.

## Learning

Open **Learning** from the navigation (or the book icon in the mobile header). Study rhythm, saved records, categories, and goals load first. Forms stay hidden until you use **Add category**, **New record**, or **New goal**. No sample categories, records, or goals are created for you.

### Categories

- Use **Add category** to reveal the name form. The color is behind **Show optional fields**. Add a category before recording study sessions.
- Edit the name or color, or archive a category you no longer use. **Show archived** reveals archived categories so you can restore them.
- Existing records and goals keep a snapshot of the category as it was when they were created, so renaming or archiving does not change history.

### Study records

Select **New record** to record a study session:

- Choose the date, category, topic, and study minutes. Dates use the app time zone.
- Use **Show optional fields** to reveal the linked goal, key takeaways, free-form notes, HTTP(S) resource links, and attachments.
- Attach up to five JPEG, PNG, or WebP images, each 10 MB or smaller. Images are re-encoded without metadata, stored locally, and served only to you through authenticated file URLs.
- Edit a record with **Edit**, or move it to the trash with the delete button. Deleting a record also hides its attachments; restoring the record restores them. Manually deleted images stay deleted.

Use the filters to narrow records by date range, category, or linked goal. Expand **Notes, links, and attachments** on a record to view its details or remove individual images.

### Streaks and goals

The **Study rhythm** card shows today's minutes, current and longest streaks, total recorded minutes, and a 14-day activity chart.

- A day counts toward a streak when its total study minutes reach your daily study target in Settings. If the target is `0`, any positive study time counts.
- Multiple records on the same date are added together.
- The current streak uses today when today qualifies; otherwise it keeps yesterday's streak until the gap is broken. The longest streak uses your full history.
- Date filters change the totals shown, but streaks always use all active records.

In **Goals and milestones**, use **New goal** to reveal the title form, then **Show optional fields** for its category, target date, status, and description. Add milestones and tasks from the saved goal card; a milestone due date is optional. Check items off to update progress; progress is the percentage of completed milestones and tasks calculated by the server. Mark a goal complete or reopen it at any time. Moving a goal to the trash hides it from the workspace; it can be restored.

## Daily Journal

Open **Daily Journal** from the navigation (or the notebook icon in the mobile header). The page opens with today's entry status, quick notes, search, and recent entries. No sample entries or notes are created.

### Daily entry

- One entry per date. Choose **Write today’s entry** or **Edit today’s entry** to reveal the form instead of creating a duplicate.
- Start with free writing. Use **Show optional fields** to reveal mood, highlights, challenges, lessons, gratitude, reflection, and tomorrow's priorities. Dates use the app time zone.
- After saving, the form closes and a confirmation appears, so saved text is not left in the input fields. Use **Edit today's entry** or **Edit** on a recent entry to reopen it; the page scrolls back to the form automatically.
- Moving an entry to the trash hides it; expand the deleted section to restore it.
- If another active entry already uses a date, that entry cannot be restored until the date is free.

### Quick notes

- Use **Add note** to reveal the note form. Start with the note text; the date is behind **Show optional fields** and defaults to today.
- Edit a note in place, or move it to the trash and restore it later.

### Search and reminders

- Search runs only over your own active entries and quick notes. Choose all results, entries only, or notes only. Deleted records are excluded.
- If the daily reminder is enabled in Settings, a local banner appears on this page after the reminder time when today's entry is missing. It can be dismissed for the current visit.

Journal content is private: it is never included in trading analytics, learning streaks, dashboards, posters, or exports.

## Calendar

Open the Calendar at `/calendar`. It is no longer linked from the desktop sidebar or the mobile header. Dates use the app time zone.

- Move between months with the arrow buttons or return to the current month with **Today**.
- The month view shows dot markers for days with trades and days with study time. Select a day to see trade count, gross and net P&L, study minutes, and study record count.
- Net P&L is **Unavailable** on days with no trades or when any trade that day has missing fees.
- If **Calendar journal marker** is enabled in Settings, an additional neutral dot marks days with your active journal entries. Selecting such a day only confirms that an entry exists; no journal content is displayed.

Calendar totals are derived from your own active trades and learning records. The optional marker is a boolean only and never includes journal text, mood, gratitude, notes, priorities, or attachments.

## Poster Studio

Open **Poster Studio** from the navigation (or the image icon in the mobile header). It opens at `/posters`.

- Choose **Trading performance**, **Study momentum**, or **Single trade ROI** as the poster data source.
- Pick a template: **Midnight**, **Paper**, or **Ember**. Choose a canvas size: square 1080×1080, portrait 1080×1350, or story 1080×1920.
- Set an accent color and logo placement. The logo is a small private workspace monogram; choose **No logo** to hide it.
- For trading or study posters, set the period from 7 to 365 days. For a single-trade poster, choose one of your completed trades.
- Trading and single-trade posters can use gross or net P&L; net stays **Unavailable** when fees are missing.
- Single-trade posters show ROI on risk, selected-basis P&L, R multiple, and risked amount. ROI is selected-basis P&L ÷ selected risk; it stays **Unavailable** when the trade has no valid risk value.
- Override the headline, subtitle, and footer if you want different text. Empty fields use the generated defaults.
- The live preview is rendered at full export resolution on a canvas. Select **Export PNG** to download the same design locally.
- Select **Save poster** to keep a design, or **Update poster** after changing it. Saved posters can be reopened or deleted. Names are unique and version-checked, so a stale tab cannot overwrite a newer save.
- Select **New poster** to start a fresh design without deleting the current one.

Poster data uses only explicitly allowlisted trading analytics, learning summaries, or completed-trade totals. Journal content and private trade notes, lessons, reviews, emotions, rule violations, and screenshots are never read; the PNG is generated in your browser and no poster image is uploaded.

## Future modules

Backups, the storage dashboard, trash/audit/exports, localization, and the Windows installer are planned for later phases.
