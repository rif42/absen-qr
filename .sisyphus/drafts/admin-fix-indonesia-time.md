# Draft: Admin Panel Fix + Indonesia Time Migration

## Problem 1: Missing Button IDs Crash Admin Panel
- `public/admin/index.html` buttons lack `id="apply-filters-button"` and `id="export-csv-button"`
- `public/admin/app.js` expects these IDs and crashes on `addEventListener` before `loadRecords()` runs
- This is why scanned records never appear on the admin panel
- Tests in `test/integration/admin-page-dom.test.ts` already expect these IDs

## Problem 2: EVENT_DATE + UTC Time Mismatch
- Current code uses UTC calendar day for all date logic (`getUtcDayKey`, `getCurrentUtcDate`)
- `EVENT_DATE` exists in `types.ts`, test fixtures, `package.json` dev script, and README
- `getConfiguredEventDate(env)` is defined but never actually used in production routes
- Admin fallback currently defaults to current UTC day, not Indonesia (GMT+7) day

## Files Affected by Timezone Change
- `src/worker/services/event-day.ts` - core date functions
- `src/worker/routes/admin.ts` - admin date range resolution
- `src/worker/routes/student.ts` - scan event_date and history filtering
- `src/worker/routes/mentor.ts` - recent scans filtering
- `src/worker/types.ts` - EVENT_DATE in Env type
- `test/integration/admin-api.test.ts` - tests for admin date fallback
- `test/integration/student-api.test.ts` - test env fixtures
- `test/integration/mentor-api.test.ts` - test env fixtures
- `test/unit/calendar-day-semantics.test.ts` - unit tests for getUtcDayKey
- `package.json` - dev:e2e script with EVENT_DATE
- `README.md` - docs mention EVENT_DATE

## User Decisions
1. **scanned_at storage**: `YYYY-MM-DD HH:mm:ss` format (e.g. `2026-04-17 14:30:00`)
2. **updated_at storage**: Same Indonesia local time format as scanned_at
3. **Admin default filter**: Yesterday → Tomorrow (3-day window)
4. **EVENT_DATE**: Completely remove from types, tests, docs, and scripts
5. **Duplicate prevention**: Use Indonesia (GMT+7) calendar day
6. **Timezone**: Hard-coded `Asia/Jakarta` (GMT+7, no DST)

## Additional Findings
- `public/admin/app.js` uses emoji button labels (✏️ 💾 ❌) but tests expect text ("Edit", "Save", "Delete")
- `test/e2e/admin-flow.spec.ts` uses Playwright `getByRole("button", { name: "Edit" })` etc.
- `styles.css` references `#export-csv-button` which is missing in HTML
- All day-boundary tests must be rewritten: Indonesia midnight = `17:00:00Z` of previous day
- DB queries in `src/worker/db/scan-records.ts` use `substr(scanned_at, 1, 10)` — the `YYYY-MM-DD HH:mm:ss` format preserves this
- `auditAndBackfillEventDates` also uses `substr(scanned_at, 1, 10)` and must switch to Jakarta day
