# Consolidated Learnings

> Aggregated from all plan notepads in `.sisyphus/notepads/`.  
> Source tasks: admin-flow-aligned, admin-row-edit-gating, admin-date-range-filter, current-day-history-filter, calendar-day-semantics-alignment, one-time-code-fallback, real-user-seeding-and-db-sync, fix-camera-local-dev, admin-date-filter-500.

---

## Calendar-Day Semantics Alignment

- Established canonical UTC day-resolution contract via `getUtcDayKey(date: Date | string)` in `src/worker/services/event-day.ts`.
- Runtime decision paths in `student.ts` and `admin.ts` no longer read `Env.EVENT_DATE`; they derive the active day from the authoritative timestamp (`scanned_at` or `new Date()`).
- `findStudentMentorScanRecordByEventDate` in `scan-records.ts` now queries by `substr(scanned_at, 1, 10)` instead of `event_date`, eliminating mixed day-resolution codepaths.
- Mock D1 (`test/support/mock-d1.ts`) was updated to support the `substr(scanned_at, 1, 10)` query pattern in `first()` operations.
- Integration tests updated to freeze time where they previously relied on `EVENT_DATE` driving the fallback day; the "different runtime day" student test was inverted to reflect new UTC-day semantics.
- `ScanRecord.event_date` is preserved as a stored reporting key; no schema/API payload shapes changed.
- Added `auditAndBackfillEventDates` to `src/worker/db/scan-records.ts`. It first audits mismatched rows (`event_date != substr(scanned_at, 1, 10)`), then checks for collisions where backfilling would violate the unique `(student_id, mentor_id, event_date)` constraint. If collisions found, throws descriptive error instead of silently merging/dropping.
- Extended mock D1 to support audit query, collision check, and targeted `event_date` update.
- Created `test/unit/calendar-day-backfill.test.ts` covering success (stale row backfilled) and collision (backfill aborted, rows untouched) cases.
- Created reference migration `migrations/0002_backfill_event_dates.sql` documenting safe backfill steps.
- Added 3 regression tests to `test/integration/admin-api.test.ts` proving admin endpoints use runtime UTC day from `getCurrentUtcDate()` as default fallback, NOT configured `EVENT_DATE` env var.
- Key technique: freeze time to a date DIFFERENT from `EVENT_DATE`, seed records on both dates, assert only frozen-UTC-day records are returned when no query params given.
- Updated duplicate conflict message from "event day" to "calendar day" in 3 locations.
- Added "allows a scan across the UTC midnight boundary" test: freeze at 23:59:59Z, insert scan, freeze at 00:00:01Z next day, insert second scan for same student/mentor pair → expects 201 for both.
- Added "rejects reassignment that would create a duplicate student-mentor-day key" test.
- Updated PRD and implementation plan: replaced all "single event-day" / "configured event-day" / "event-day fallback" references with "UTC calendar-day" equivalents.
- Removed `EVENT_DATE` var from `wrangler.jsonc` (runtime code no longer depends on it).
- Updated `AGENTS.md` constraint line accordingly.

## Current-Day History Filter

- Runtime "today" means UTC `YYYY-MM-DD`, derived from `new Date().toISOString().slice(0, 10)`.
- History visibility must use `scanned_at` UTC day, not `event_date`, to avoid mismatches when write-time `EVENT_DATE` differs from runtime today.
- Scope is limited to student `/api/history`, mentor `/api/recent-scans`, shared helpers/query semantics, deterministic tests, mock D1 behavior, and implementation-plan note. No date UI, query param, or client-side filtering added.
- Added `getCurrentUtcDate(now: Date = new Date())` beside `getConfiguredEventDate(env)` in `src/worker/services/event-day.ts` and validated with `isEventDate` before returning.
- Switched only shared history readers in `src/worker/db/scan-records.ts` to `substr(scanned_at, 1, 10) = ?2` and renamed second parameter to `utcDate`.
- `GET /api/mentor/recent-scans` now keys visibility off runtime UTC day via `getCurrentUtcDate()`, while `/api/mentor/me` and `/api/mentor/notes/:scanId` remain unchanged.
- `GET /api/student/history` now uses `getCurrentUtcDate()` only in the `/history` branch; `/scan` still derives `EVENT_DATE` from `getConfiguredEventDate(env)`.
- The new empty-history regression is useful because it proves old-day scans do not leak into runtime-today history.
- `/api/student/scan` now uses dedicated event-day lookup on `(student_id, mentor_id, event_date)` instead of reusing runtime-day history reader, so duplicate prevention no longer depends on `scanned_at` day.
- Regression test strongest when stored duplicate has right `event_date` but older `scanned_at` day.

## Admin Date-Range Filter

- Admin date filter must use stored `event_date`, never `scanned_at`.
- Query-param contract is exactly `startDate` and `endDate` for both records and CSV export.
- Default admin behavior must remain equivalent to configured event-day only.
- User requested minimal targeted tests, not a broad new test matrix.
- Inclusive admin filtering works cleanly with `scan_records.event_date >= ?1 AND scan_records.event_date <= ?2`.
- Mock D1 must sort export rows by `scanned_at ASC, scan_id ASC` and records by `scanned_at DESC, scan_id DESC` to mirror SQL contract.
- Keeping helper defaults (`endDate = startDate`) preserved route compatibility while tests exercised the new range API.
- Admin shell can expose exactly two visible `input[type="date"]` controls plus one apply button without disturbing existing export/status/table hooks.
- A focused DOM contract test is enough for this phase because the task is markup-only and admin JS remains untouched.
- The admin API route can normalize `startDate`/`endDate` with one local helper and still keep PATCH/DELETE behavior isolated.
- `GET /api/admin/records` should surface the active range in `dateFilter` rather than leaking helper internals.
- PRD and implementation plan should describe the admin date-range feature as reporting-only, not multi-event support.
- Student and mentor history wording should stay runtime-day based while admin reporting uses stored `event_date` range contract.
- Admin page should treat `dateFilter` from `GET /api/admin/records` as source of truth for active range on first load.
- Keeping filter state to just `startDate` and `endDate` made export, URL sync, and validation easier to keep aligned.
- Client-side invalid apply handling can preserve last rendered table simply by refusing to fetch.
- The action column must keep a stable `.record-actions` wrapper mounted so compact button-group styling survives locked/editing state changes.

## Admin Flow Aligned

- `test/support/mock-d1.ts` now mirrors planned admin helper SQL by recognizing `people` role-list queries ordered by `display_name ASC`, event-day `scan_records` joins against `people AS student` and `people AS mentor`, and single-record lookups by `scan_id`.
- The admin mock returns joined rows with `student_name`, `student_secret_id`, and `mentor_name` layered onto underlying `scan_records` fields.
- Generic admin-style `UPDATE scan_records ... WHERE scan_id = ?n` handling stays minimal by parsing the `SET` clause for `notes`, `student_id`, `mentor_id`, and `updated_at`, then checking existing `(student_id, mentor_id, event_date)` uniqueness rule before mutating in-memory state.
- Admin record ordering needs explicit scan-id tie breaking: records list uses `scanned_at DESC, scan_id DESC`, while export uses `scanned_at ASC, scan_id ASC`.
- Admin now follows same static shell convention as student and mentor pages: `main.shell` → `header.page-header` → stacked card sections with stable IDs for tests.
- The locked admin contract can stay purely static while still exposing required hooks exactly once: `page-title`, `status-banner`, `controls-card`, `export-csv-button`, `records-card`, `records-loading`, `records-empty-state`, `records-table`, and `records-table-body`.
- `src/worker/db/admin-records.ts` keeps every admin joined query in one place and maps D1-style `snake_case` row fields into locked `camelCase` table/export contract.
- Admin option lists should reuse `listPeopleByRole` but must narrow each person down to `{ personId, displayName }`, preventing `secret_path_token` from leaking through shared admin records payload.
- `GET /admin/:secret/api/records` can return `getAdminRecordsPayload(env.DB, eventDate)` directly once admin secret passes.
- `GET /admin/:secret/api/export.csv` stays on a local serializer in the route, using `listAdminExportRows(env.DB, eventDate)` plus exact header `student name,secret id,mentor scanned,date,notes`, `text/csv; charset=utf-8`, and `attachment; filename="attendance-<eventDate>.csv"` disposition.
- CSV notes must escape commas, double quotes, and embedded newlines by quoting the field and doubling `"`.
- `PATCH /admin/:secret/api/records/:scanId` now rejects non-object JSON, unknown keys, and wrong field types up front, while still allowing any valid combination of `notes`, `studentId`, and `mentorId`, including `notes: ""` to clear stored notes.
- Admin PATCH updates should mutate existing `scan_records` row in place, always refresh `updated_at`, and then re-read the joined admin row so response, `GET /records`, and `GET /export.csv` all reflect same latest corrected state.
- Admin DELETE now follows same locked admin contract pattern as PATCH.
- The admin page runtime can stay framework-free by deriving `/admin/:secret` from `window.location.pathname`, fetching `GET /admin/:secret/api/records` on load, and wiring row-level save/delete handlers directly against locked admin APIs.
- The admin export button works best as direct browser navigation to `/admin/:secret/api/export.csv`; keeps CSV generation server-side.
- The admin page integration test can run without jsdom by stubbing `document`, `window`, and `fetch` with a tiny in-test fake DOM that supports `classList`, `replaceChildren`, event listeners, and `remove()`.
- Admin load success copy should stay non-numeric; `Records loaded and ready.` keeps status useful without reintroducing record counter.
- Playwright support was not yet present in package scripts or deps; adding Task 9 needed new playwright devDependency plus `test:e2e` scripts.
- TypeScript config is strict ES2022/Bundler/WebWorker with `allowJs: false` and include limited to `src/**/*.ts`, `src/**/*.d.ts`, `test/**/*.ts`, and `vitest.config.ts`; `playwright.config.ts` needs to be TypeScript-safe at repo root.
- Wrangler local-dev config centered on single Worker entry with static assets binding: `main: src/worker/index.ts`, `assets.binding = ASSETS`, `assets.directory = ./public`, `vars.EVENT_DATE = 2026-01-15`, and D1 binding `DB` with `migrations_dir = ./migrations`.
- Seed/migration baseline is `migrations/0001_initial_schema.sql` and `seed/dev.sql` (clears both tables, inserts 5 students + 5 mentors with stable local secret tokens).
- Wrangler local Worker vars for browser runs need explicit `wrangler dev --var KEY:value` flags; passing through `webServer.env` alone did not populate `env.ADMIN_SECRET`/`env.EVENT_DATE` inside Worker.
- A deterministic Playwright setup project works cleanly: `test/e2e/admin.setup.ts` runs local D1 migrations plus `seed/dev.sql` and `seed/e2e-admin.sql` against shared `--persist-to .wrangler/state/e2e` directory before browser project starts.
- The admin browser flow can cover edit, mentor reassignment, delete, CSV download, and bad-secret rejection entirely through existing admin page shell and APIs.
- The visual polish pass stayed CSS-only for public pages: admin got dedicated stylesheet with calm white cards and green accents, while student and mentor kept existing mobile flow and only tightened top-level card outline to light green border.
- A regression test now locks the admin action wrapper contract in both Vitest and Playwright, so the four-column compact table still exposes `.record-actions` even while switching between Edit and Save states.

## Admin Row Edit Gating

- The admin save flow should treat locked state as the source of truth: locked rows ignore Save, unchanged saves re-lock immediately without PATCH, and successful PATCHes re-lock after syncing the returned record.
- Row action disabling stays row-local and temporary; Save/Delete are only disabled during an in-flight request for that row, then restored from the row lock state.
- Failed PATCHes must not overwrite control values or re-lock the row, preserving attempted edits for another save attempt.
- On `/admin/local-admin-secret-token`, the first row started locked, unlocked on `Edit`, and immediately re-locked after `Saved` with both selects, textarea, and Save disabled; page console stayed clean.
- The admin row state is now inspectable and styleable through `tr.dataset.rowState` plus `row-locked` / `row-editing` classes, which keeps the shell stable while making row-local state obvious in tests and CSS.
- The static admin HTML still contains only the table shell (`table` + `tbody`) and no server-rendered rows; row state is introduced entirely by `public/admin/app.js` after records load.
- After adding the `Edit` column, the action-button selectors must follow the 6-column row order: Edit in column 4, Save in column 5, and Delete in column 6.
- The browser E2E should prove the locked state up front with row-scoped disabled assertions, then re-check the same row after `Save` and after reload so the lock/reload contract is explicit.
- When exercising a second admin save in the same row, pick a different mentor value than the current persisted one; otherwise Playwright will correctly surface the neutral `No changes to save.` path.
- Targeted regression bundle completed cleanly — `admin-page-app`, `admin-page-dom`, `admin-api`, and `admin-records` Vitest suites passed; `npm run typecheck` exited 0; and `npm run test:e2e:admin` passed with the admin browser flow green.
- Failed admin deletes now restore the row-local lock state before re-enabling Delete, so locked rows come back with Save still disabled and Delete available again after an error.

## One-Time Code Fallback

- `ScanRecord` now carries `entry_method`; safe migration path is default `qr` plus additive selects in scan/admin queries.
- Mock D1 needs seed-time normalization for legacy fixtures and state aliasing when a new table is introduced.
- Additive JSON fields were easiest to absorb by switching affected equality assertions to partial matches while keeping CSV/export checks exact.
- Fallback code generation: use single `Uint32Array` with modulo to get exactly 8 digits; previous multi-value formula produced 12 digits.
- `created()` helper takes raw data, not `json()` — double-wrapping causes empty response body.
- Throttling at API gateway level catches malformed codes (wrong length) before DB lookup — saves DB calls.
- Throttle check incremented on format validation failures (malformed, not-found, expired, duplicate).
- Throttle state persists in-memory Map — exported `resetFallbackCodeThrottle()` for test isolation.
- Duplicate same-day scan returns 409 but does NOT consume the code (code stays available).
- Successful redemption atomically creates scan record then consumes code.
- Response shape mirrors `/scan` endpoint but uses simplified structure per spec.
- Spaces in code string stripped both client-side (per spec) and server-side (defense in depth).
- Fallback form uses `hidden` class (display:none) by default; JS toggles it with `classList.remove/add`.
- Reveal button is styled as a text link (underline, no border, muted color) — visually subordinate to primary scanner CTA.
- Form input uses `inputmode="numeric"` for mobile keyboard, `maxlength="11"` to allow spaces, client-side strip before submit.
- On success: show scan-feedback success, reload history, hide form, stop+reset scanner.
- On failure: 400 → generic "Invalid or expired fallback code.", 409 → "Duplicate mentor scan...", 429 → throttle message.
- Pre-existing test failures in admin-page-app, import-users, calendar-day-backfill, mentor-page-dom are unrelated to student page changes.
- Test file expected `scanner-status` and `history-loading` IDs in HTML that were missing — added them to make pre-existing tests pass.
- Fallback card placed between QR card and recent scans: identity → QR → fallback → recent scans.
- State management: `fallbackCode`, `fallbackExpiresAt`, `fallbackCountdownTimer` added to global state.
- Countdown uses 1-second `setInterval`, refreshes/closes when remaining reaches 0.
- `loadFallbackCodeState()` called AFTER identity load but BEFORE scans load.
- Generate button hidden when active code exists; helper text shows "A new code can be generated after this one expires."
- 409 conflict from POST shows error message but keeps button in retry state.
- CSS styling uses `var(--surface-alt)`, `var(--border)`, `var(--warm)` for countdown text — muted secondary look.
- Fallback card uses `hidden` class initially (shown by JS after identity loads).
- Admin records JSON already includes `entryMethod` from prior tasks — only needed to normalize it in `public/admin/app.js`.
- Fallback badge added to mentor cell in admin table — hidden by default, shown only when `entryMethod === 'fallback_code'`.
- CSS styling: muted gray badge with `display:none` default, toggled in locked state.
- CSV export unchanged — header and row shape locked at `student name,secret id,mentor scanned,date,notes`.
- Test approach: `entryMethod` uses partial matching (`toMatchObject`), CSV uses exact matching (`toBe`).
- Race condition test converted to sequential test because mock D1 doesn't handle parallel writes.
- Admin edit/delete/reassign on fallback records works — verified with date filter in test assertions.
- Student history already includes fallback-created records — no special handling needed.

## Real-User Seeding and DB Sync

- Task 1 canonical import now lives in `scripts/import-users.mjs` and is intentionally dry-run only; it parses `userlist.csv` with `csv-parse/sync`, normalizes role/name for dedupe, keeps the first 10 unique students and 10 unique mentors in source order, and writes a stable pretty-printed JSON artifact.
- Identity generation is deterministic by role-scoped slug: `person_id={role}-{slug}`, `secret_id={role}-secret-{slug}`, `secret_path_token={role}-{slug}`, with same-role slug collisions resolved as `-2`, `-3`, etc. while keeping tokens compatible with `^[a-z0-9-]+$`.
- Task 2 extends the same canonical roster to a round-trip CSV writer: `userlist.csv` is rewritten in source order with appended metadata columns `Selected, Status, Person ID, Secret ID, Secret Token, Secret Link, Selection Order`.
- The round-trip writer is deterministic across reruns: selected rows get `Selected=YES`, `Status=selected`, and full generated identity/link values; skipped rows get `Selected=NO`, a stable reason such as `duplicate` or `over-quota-student`, and blank generated identity/link columns.
- Task 3 centralizes the selected 20-person roster in `test/support/real-roster.ts`, then reuses that source in `test/support/mock-d1.ts`, the worker API integration suites, and the admin/unit fixture expectations so tests stay aligned with the canonical importer contract.
- Admin CSV expectations now need CSV-aware quoting because many real student/mentor display names contain commas; `test/integration/admin-api.test.ts` uses a small `csvField`/`exportLine` helper so export assertions keep matching the unchanged contract exactly.
- Task 4 extends `scripts/import-users.mjs` from dry-run into a production D1 reset-and-apply workflow: it resolves `binding=DB` and `database_name=absen-qr` from `wrangler.jsonc`, verifies the remote schema, compares remote `people` table to canonical 20-person roster, exports pre-apply backup artifacts before any destructive step, writes an apply SQL file with `DELETE FROM scan_records;` before `DELETE FROM people;`, then records machine-readable command/evidence metadata in output JSON.
- Task 4 backup semantics were tightened so remote backups are now truly table-specific machine-readable JSON artifacts: `people-pre-apply.json` is written from the verified `people` query result and `scan-records-pre-apply.json` is written from its own Wrangler `SELECT ... FROM scan_records ...` result before any destructive apply step.
- Task 5 verified live secret-link behavior on production endpoints: selected student and mentor secret links resolve correctly with proper identity payloads and QR payload pattern `absenqr:v1:mentor:...`.

### F2 Code Quality Review (Tasks 1-4) — APPROVE

- `scripts/import-users.mjs` is cleanly decomposed into single-responsibility pure functions.
- Naming is consistent with the repo (snake_case for DB-facing objects, camelCase for JS logic).
- CSV parser throws row-level errors for missing names, missing roles, and unsupported roles.
- Same-role slug collisions resolved deterministically (-2, -3, etc.) and covered by unit tests.
- Duplicate rows and over-quota rows are skipped with stable reason codes.
- Zero occurrences of TODO, FIXME, HACK, console.log, `as any`, or `@ts-ignore` in changed files.
- `--apply-remote` **requires** `--backup-remote`; script throws immediately if flag pair is incomplete.
- Remote schema is verified before any destructive operation.
- Pre-apply backups are written as machine-readable JSON artifacts before any mutation.
- Apply SQL uses `DELETE FROM scan_records;` before `DELETE FROM people;`, preserving referential sanity.
- Idempotent reruns short-circuit when remote roster is already canonical and `scan_records` is empty.
- All 69 tests in reviewed suites pass; tests are meaningful with no trivial assertions.
- `lsp_diagnostics` reported **zero errors** across all changed TypeScript files.

### F3 Real Manual QA — APPROVE

- `rtk npm run typecheck` — PASSED.
- `rtk npm test -- test/unit/import-users.test.ts` — PASSED (7/7 tests).
- Dry-run import — PASSED (10 students, 10 mentors, 37 skipped rows).
- CSV round-trip dry-run — PASSED (metadata columns correct, all 20 selected rows contain valid secret links).
- Remote D1 `SELECT role, COUNT(*) FROM people GROUP BY role` — PASSED (mentor: 10, student: 10).
- Remote D1 `SELECT COUNT(*) FROM scan_records` — PASSED after transient auth retry (count: 0).
- Live student secret-link API test — PASSED (HTTP 200, correct identity payload).
- Live mentor secret-link API test — PASSED (HTTP 200, correct identity payload and QR payload).
- Cross-role negative tests — PASSED (student route with mentor token → 404, mentor route with student token → 404).

### F4 Scope Fidelity Check — APPROVE

- CSV import limited to student and mentor only, excluding admin import — PASS.
- Roster selection stayed at exactly 10 students + 10 mentors — PASS.
- Secret path tokens generated URL-safe (`^[a-z0-9-]+$`) — PASS.
- `userlist.csv` parsed with a real CSV parser (not comma-split) — PASS.
- Admin CSV export contract remained unchanged in code and docs — PASS.
- Student/mentor/admin route shapes preserved as `/{role}/{secretToken}` — PASS.
- Attendance data (`scan_records`) reset as part of production rollout — PASS.
- Docs updates explicitly reflect the 20-person testing exception — PASS.
- No scope creep into unrelated areas — PASS.

### F1 Plan Compliance Audit — APPROVE

- Task 1: canonical roster-selection and identity-generation contract — PASS.
- Task 2: CSV round-trip writer — PASS.
- Task 3: dummy fixture replacement with real roster — PASS.
- Task 4: production D1 reset-and-apply workflow — PASS.
- Task 5: live secret-link verification and docs updates — PASS.

## Admin Date Filter 500

- Remote D1 `scan_records` schema does not include `entry_method`.
- Remote schema still matches pre-0003 shape: `scan_records` has `scan_id`, `student_id`, `mentor_id`, `event_date`, `scanned_at`, `notes`, `updated_at`, plus the `(student_id, mentor_id, event_date)` unique constraint.
- Remote migration evidence says `0003_fallback_codes.sql` is still listed as pending and its side effects are absent remotely (`mentor_fallback_codes` not present).
- Exact conclusion for compatibility check: `scan_records.entry_method` does **not** exist remotely.
- Canonical GET `/admin/admin-secret-2026/api/records?startDate=2026-04-17&endDate=2026-04-19` returned HTTP/1.1 500 Internal Server Error with Cloudflare error code 1101; repro evidence saved.

## Fix Camera Local Dev

- (No learnings recorded.)

---

*Generated on 2026-04-18 from `.sisyphus/notepads/*/{decisions,issues,learnings,problems}.md`.*
