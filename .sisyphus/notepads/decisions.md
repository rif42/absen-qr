# Consolidated Decisions

> Aggregated from all plan notepads in `.sisyphus/notepads/`.  
> Source tasks: admin-flow-aligned, admin-row-edit-gating, admin-date-range-filter, current-day-history-filter, calendar-day-semantics-alignment, one-time-code-fallback, real-user-seeding-and-db-sync, fix-camera-local-dev, admin-date-filter-500.

---

## Calendar-Day Semantics Alignment

- UTC midnight boundary is the canonical day rule.
- `event_date` is derived from `scanned_at` as `substr(scanned_at, 1, 10)`.
- No timezone support, no multi-event scope creep, no schema rename/removal of `event_date`, no API shape changes, no CSV column-order changes.

## Current-Day History Filter

- Keep `getConfiguredEventDate(env)` and write-side/event/admin semantics unchanged.
- Use `getCurrentUtcDate(now: Date = new Date())` as the shared runtime-day helper for history reads only.
- Freeze time in student and mentor integration tests to `2026-01-15T12:00:00.000Z` and intentionally mismatch `EVENT_DATE` to `2026-01-14` in runtime-day assertions.
- The runtime date helper is colocated in `event-day.ts` instead of a new module.
- `utcDate` is the preferred parameter name for the history-query path.
- Student `/history` uses runtime UTC day; `/scan` keeps `EVENT_DATE` for duplicate prevention and scan creation.
- Mentor `/recent-scans` uses `getCurrentUtcDate()` directly.
- Added `findStudentMentorScanRecordByEventDate()` as the write-path duplicate check helper so `/scan` stays event-day scoped.

## Admin Date-Range Filter

- Admin records table and CSV export must share one inclusive `event_date` range contract.
- Invalid or partial server-side date params fall back to configured event-day.
- Browser UI exposes exactly two visible date inputs (`startDate`, `endDate`) and one apply action.
- Docs updates are limited to PRD and implementation plan.
- Admin helpers accept inclusive start/end dates while defaulting `endDate` to `startDate` for existing route compatibility.
- Mock D1 admin branch keys on the exact range SQL shape, not the legacy single-date predicate.
- Use `startDate`, `endDate`, and `apply-filters-button` as new admin shell hooks.
- Use a local resolver in `admin.ts` that falls back to `getConfiguredEventDate(env)` when either query param is missing, malformed, or reversed.
- Keep docs scoped to an admin-only reporting enhancement over stored `event_date`, not a product-level multi-event feature.
- Use the server-returned `dateFilter` to hydrate initial admin inputs when the URL does not already provide a valid range.
- Block invalid apply attempts entirely on the client so the current table stays visible.

## Admin Flow Aligned

- Shared admin records payload is locked in the data layer as `{ eventDate, records, students, mentors }`.
- Admin table rows are normalized to `{ scanId, studentId, studentName, studentSecretId, mentorId, mentorName, eventDate, scannedAt, notes, updatedAt }`.
- List ordering fixed to `scanned_at DESC, scan_id DESC`; export ordering fixed to `scanned_at ASC, scan_id ASC`.
- Admin records route acts as a thin adapter over `getAdminRecordsPayload`.
- CSV export branch is a thin route-level serializer over `listAdminExportRows`.
- Admin PATCH parsing is locked to exact body keys `notes`, `studentId`, `mentorId`; unknown keys return `400`.
- Record correction keeps route focused on auth/validation/lookups while `admin-records.ts` owns the UPDATE and post-update refresh.
- Admin DELETE stays route-thin: `admin-records.ts` owns existence check plus DELETE, route maps success to `200` with `{ deleted: true, scanId }`.
- `public/admin/app.js` remains a plain IIFE keeping state in local closures.
- `#export-csv-button` navigates directly to `/admin/:secret/api/export.csv` so CSV stays server-owned.
- Task 9 uses Playwright `projects` with a dedicated `setup` dependency instead of `globalSetup`.
- Browser harness isolates local D1 state under `.wrangler/state/e2e` and starts Wrangler on `http://127.0.0.1:4173`.
- TypeScript typecheck for E2E files handled by adding `@types/node` plus `"node"` to `tsconfig.json` types.
- The admin action column keeps a permanent `.record-actions` wrapper; `setRowLockedState()` only swaps the wrapper's children.

## Admin Row Edit Gating

- Admin row browser tests should always enter edit mode explicitly before filling controls on a locked row.
- Save lifecycle distinguishes three paths: locked rows short-circuit, unchanged edits re-lock with neutral status and no PATCH, successful PATCHes re-lock after applying response payload.
- Delete remains available outside the request window; only the same row's actions are disabled during in-flight save.
- Adopted `data-row-state` plus `row-locked` / `row-editing` on each record row as the single DOM contract for read-only vs editing affordances.
- Kept `public/admin/index.html` untouched so the admin shell contract stays fixed.

## One-Time Code Fallback

- `ScanRecord` now carries `entry_method`; safe migration path is default `qr` plus additive selects.
- Fallback code generation uses single `Uint32Array` with modulo to get exactly 8 digits.
- `created()` helper takes raw data, not `json()` — double-wrapping causes empty response body.
- Throttling at API gateway level catches malformed codes before DB lookup.
- Throttle state persists in-memory Map; exported `resetFallbackCodeThrottle()` for test isolation.
- Duplicate same-day scan returns 409 but does NOT consume the code.
- Successful redemption atomically creates scan record then consumes code.
- Spaces in code string stripped both client-side and server-side.
- Fallback form uses `hidden` class by default; JS toggles with `classList.remove/add`.
- Reveal button styled as text link (underline, no border, muted color).
- Form input uses `inputmode="numeric"` for mobile keyboard, `maxlength="11"` to allow spaces.
- On success: show scan-feedback success, reload history, hide form, stop+reset scanner.
- On failure: 400 → generic invalid message, 409 → duplicate message, 429 → throttle message.
- EntryMethod uses partial matching (toMatchObject) in tests; CSV uses exact matching (toBe).
- Race condition test converted to sequential because mock D1 doesn't handle parallel writes.

## Real-User Seeding and DB Sync

- Task 4 importer treats remote apply as idempotent only when people already exactly matches canonical roster and `scan_records` is empty; in that state it skips backup/apply entirely.
- Post-apply evidence records both required verification queries when a destructive apply actually runs.
- Idempotent reruns short-circuit before backup/apply and report no-op summary.

## Admin Date Filter 500

- (No decisions recorded.)

## Fix Camera Local Dev

- (No decisions recorded.)

---

*Generated on 2026-04-18 from `.sisyphus/notepads/*/{decisions,issues,learnings,problems}.md`.*
