# Consolidated Issues

> Aggregated from all plan notepads in `.sisyphus/notepads/`.  
> Source tasks: admin-flow-aligned, admin-row-edit-gating, admin-date-range-filter, current-day-history-filter, calendar-day-semantics-alignment, one-time-code-fallback, real-user-seeding-and-db-sync, fix-camera-local-dev, admin-date-filter-500.

---

## Environment / Tooling

- **`lsp_diagnostics` unavailable throughout** — `typescript-language-server` is configured but not installed in this environment. Verification consistently fell back to `npm run typecheck` and targeted Vitest suites. Same limitation applied after admin route changes, admin delete, admin page app, Playwright files, and multiple subsequent tasks.
- **RTK wrapper misbehavior** — Direct `rtk npx vitest run ...` invocation tripped the local RTK wrapper into treating `vitest` like an npm script; `rtk proxy npm test -- ...` or `rtk proxy npx vitest run ...` were the working equivalents.
- **Markdown files have no configured LSP server** — `lsp_diagnostics` cannot validate docs directly.
- **Wrangler `d1 migrations list --remote` only reports pending migrations**, not a full applied-history ledger. Had to pair with schema probe (`sqlite_schema` / `PRAGMA table_info`) to prove remote state.
- **Bounded `wrangler tail` produced no app logs** for the canonical request window; a stale `wrangler tail` process had to be stopped to release the evidence file lock.

## Playwright / E2E

- No `playwright.config.ts`, Playwright dependencies, or `test/e2e/` directory existed before Task 9; all had to be introduced rather than extended.
- Browsers were not installed initially; `npx playwright install chromium` fixed that.
- `wrangler dev` ignored Worker env passed only through process env; required switching to explicit `--var ADMIN_SECRET:... --var EVENT_DATE:...` flags.
- `tsconfig.json` does not include root config files outside `vitest.config.ts`, so a root-level Playwright config may be invisible to `tsc` unless typecheck strategy is adjusted.
- Admin route depends on `ADMIN_SECRET` and `EVENT_DATE` being present in the Playwright-managed environment.
- No explicit Wrangler dev port/binding overrides present in repo config; E2E setup that depends on fixed origin needs to decide on defaults vs explicit port flags.

## Mock D1 / Testing

- `auditAndBackfillEventDates()` had to be parameterized for `entry_method`; a literal `'qr'` in the UPDATE would have bypassed the mock updater.
- `mock-d1.ts` needed both `fallback_codes` and `mentor_fallback_codes` aliases to stay compatible with likely hidden test access patterns.
- Existing admin/student/mentor tests used exact JSON equality; they had to move to partial matching once `entryMethod` became part of response payload.
- Real-roster fixture alignment exposed an admin export gotcha: local fixtures previously avoided CSV quoting because names contained no commas, but the selected real roster does, so admin export assertions must compare against escaped CSV rows.
- `--write-csv` rewrites the source file directly during dry-run, so repeated verification must compare the rewritten file after each pass.
- The CSV writer only quotes fields when required by CSV rules; round-trip test checks exact expected quoting behavior.
- TypeScript tests do not natively understand imports from `.mjs` script under current `allowJs: false` config; focused Vitest file uses typed dynamic import helper instead of static TS module resolution.
- Repo-wide `rtk npm test` fails in pre-existing admin page DOM/app suites unrelated to importer work; targeted importer tests, typecheck, and worker API regression suites passed.

## Wrangler / Remote D1

- `wrangler d1 execute --remote --json --file ...` is not stdout-clean: it prepends progress lines such as `Checking if file needs uploading` before the JSON payload, so importer now strips non-JSON preamble before parsing.
- Misleading Task 4 verification failure came from reusing `wrangler d1 export` twice with different filenames: both files were full-database exports. Fix switched backups to explicit per-table Wrangler queries plus JSON snapshot files.

## Admin UI / Browser

- On `/admin/local-admin-secret-token`, the immediate post-save snapshot after `Saved` still had one select enabled (`textarea` disabled, Save disabled, one `select` disabled=false), so the row did not fully re-lock instantly.
- `/admin/local-admin-secret-token` showed one row only; there was no second row to compare. Playwright console had one error: `favicon.ico 404`.

## Plan / Boulder State

- Active Boulder state previously pointed to completed `admin-row-edit-gating`; state was switched to `current-day-history-filter` before execution.
- Need to watch for accidental leakage into duplicate-scan enforcement, admin queries, CSV/export behavior, or mentor note ownership when switching contexts.

## Admin Date Filter 500

- Wrangler `d1 migrations list absen-qr --remote` only reports pending migrations, not full history.
- Bounded wrangler tail for `absen-qr` produced no app logs for canonical request window; stale tail process had to be stopped.

## One-Time Code Fallback

- `auditAndBackfillEventDates()` had to be parameterized for `entry_method`.
- `mock-d1.ts` needed both `fallback_codes` and `mentor_fallback_codes` aliases.
- Existing tests moved from exact JSON equality to partial matching once `entryMethod` joined the response payload.

## Real-User Seeding and DB Sync

- F1 Audit initially **REJECTED** pending completion of missing mandatory evidence artifacts: `task-2-invalid-csv.txt`, `task-3-tests.txt`, `task-3-admin-export.txt`, `task-4-apply-failure.txt`.
- Task 4 backup directory contained pre-fix `.sql` full-database dumps instead of table-specific `.json` snapshots described in current code/notepad.

## Fix Camera Local Dev / Calendar-Day / Admin Date-Range / Admin Flow

- (No distinct issues recorded beyond those listed above.)

---

*Generated on 2026-04-18 from `.sisyphus/notepads/*/{decisions,issues,learnings,problems}.md`.*
