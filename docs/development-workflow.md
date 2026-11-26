# Development Workflow

## Approval gates

The project is built in phases. After each phase:

1. Run the relevant automated tests.
2. Run lint and production build.
3. Fix failures.
4. Verify functionality manually.
5. Update documentation.
6. Show what changed.
7. Wait for explicit approval before the next phase.

## Local workspace rules

- Keep all work in the local workspace; no remote repository workflow.
- Keep `.env` files, secrets, database files, screenshots, backups, certificates, keys, OAuth credentials, and runtime data local.
- Do not rewrite or delete user work without investigation.

## Service worker behavior

- Development does not register an app-shell service worker. Stale dev workers and cached app files are removed on each dev page load so old and new UI chunks cannot mix.
- The production build still registers the Workbox app shell. Use `npm.cmd run build` followed by `npm.cmd start` to test app updates.

## Code style

- JavaScript and JSX only; no TypeScript source.
- ES modules.
- Single package with `src/client`, `src/server`, and `src/shared`.
- 2-space indentation.
- Single quotes.
- No semicolons.
- Prettier and ESLint must pass.
- Zod at API boundaries.
- Stable error codes.
- JSDoc where shared contracts need description.

## Security rules

- Server-side authorization on every request.
- Ownership checks on records and files.
- No secrets in logs.
- No permissive CORS in production.
- No direct filesystem paths from clients.
- No `eval` or dynamic script execution.
- Personal Journal data must not leak into other modules.
- Security-sensitive changes require tests.

## Financial rules

- Integer micro-USD, ticks, and hundredths for stored values.
- Server recomputes all trade values.
- Historical trades use immutable instrument, account, session, and tag snapshots.
- Missing fees are never treated as zero.
- Missing risk never produces an invented R.
- Financial formula changes require an explicit migration and documentation update.

## Documentation rules

- Documentation must match implemented behavior.
- Mark planned features clearly.
- Update API, schema, financial, security, backup, and testing docs in the same phase as the code.
- Keep `CHANGELOG.md` current.

## Definition of done

- Feature works end-to-end.
- Tests pass.
- Lint passes.
- Production build passes.
- Accessibility checked for new UI.
- Security and privacy impact reviewed.
- Documentation updated.
- Changes shown to the user.
- Approval requested before continuing.
