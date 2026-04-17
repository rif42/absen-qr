# Calendar-Day Semantics Alignment — Learnings

## 2026-04-15 10:42

- Established canonical UTC day-resolution contract via `getUtcDayKey(date: Date | string)` in `src/worker/services/event-day.ts`.
- Runtime decision paths in `student.ts` and `admin.ts` no longer read `Env.EVENT_DATE`; they derive the active day from the authoritative timestamp (`scanned_at` or `new Date()`).
- `findStudentMentorScanRecordByEventDate` in `scan-records.ts` now queries by `substr(scanned_at, 1, 10)` instead of `event_date`, eliminating mixed day-resolution codepaths.
- Mock D1 (`test/support/mock-d1.ts`) was updated to support the `substr(scanned_at, 1, 10)` query pattern in `first()` operations.
- Integration tests were updated to freeze time where they previously relied on `EVENT_DATE` driving the fallback day, and the "different runtime day" student test was inverted to reflect the new UTC-day semantics.
- `ScanRecord.event_date` is preserved as a stored reporting key; no schema/API payload shapes changed.

## 2026-04-15 10:53

- Added `auditAndBackfillEventDates` to `src/worker/db/scan-records.ts`.
- The utility first audits mismatched rows (`event_date != substr(scanned_at, 1, 10)`), then checks for collisions where backfilling would violate the unique `(student_id, mentor_id, event_date)` constraint.
- If collisions are found, it throws a descriptive error listing each collision instead of silently merging or dropping rows.
- Extended `test/support/mock-d1.ts` to support the audit query (`event_date != substr(scanned_at, 1, 10)`), collision check (`student_id + mentor_id + event_date + scan_id !=`), and targeted `event_date` update.
- Created `test/unit/calendar-day-backfill.test.ts` covering success (stale row backfilled) and collision (backfill aborted, rows untouched) cases.
- Created reference migration `migrations/0002_backfill_event_dates.sql` documenting the safe backfill steps.
- Evidence saved to `.sisyphus/evidence/task-3-backfill-success.txt` and `.sisyphus/evidence/task-3-backfill-collision.txt`.
- `npm run typecheck` passes cleanly.

## 2026-04-15 12:42

- Added 3 regression tests to test/integration/admin-api.test.ts proving admin endpoints (/records and /export.csv) use runtime UTC day from getCurrentUtcDate() as default fallback, NOT the configured EVENT_DATE env var.
- Key technique: freeze time to a date DIFFERENT from EVENT_DATE (2026-01-20 vs 2026-01-15), seed records on both dates, assert only the frozen-UTC-day records are returned when no query params are given.
- Also tested that explicit startDate/endDate query params override the fallback correctly, even when they differ from both the frozen time and EVENT_DATE.
- All 26 tests pass (23 existing + 3 new), typecheck clean.
- Evidence saved to .sisyphus/evidence/task-4-admin-default-day.txt and .sisyphus/evidence/task-4-admin-range.txt.

## 2026-04-15 12:53

- Updated duplicate conflict message from "event day" to "calendar day" in 3 locations: student.ts:93, student.ts:108, admin.ts:16 (`DUPLICATE_SCAN_ERROR_MESSAGE`).
- All existing test assertions (3 across student-api.test.ts and admin-api.test.ts) updated to match the new wording.
- Added "allows a scan across the UTC midnight boundary" test: freeze at 23:59:59Z, insert scan, freeze at 00:00:01Z next day, insert second scan for same student/mentor pair → expects 201 for both.
- Added "rejects reassignment that would create a duplicate student-mentor-day key" test: seed two records on same UTC day with different student/mentor pairs but same mentor, PATCH only studentId of source to match target's studentId → expects 409 with DUPLICATE_SCAN_ERROR_MESSAGE.
- Key insight for admin reassignment collision test: source must already share the same mentor as the target, so PATCHing only studentId creates the full (student, mentor, day) key collision.
- Grep confirmed zero "event day" references remain in src/ conflict messages.
- All 37 tests pass (10 student + 27 admin), typecheck clean.
- Evidence saved to .sisyphus/evidence/task-5-student-midnight.txt and .sisyphus/evidence/task-5-admin-reassign-conflict.txt.

## 2026-04-15 (Task 6)

- Updated PRD (`docs/prd/mentor-student-qr-attendance-v1.md`): replaced "single event-day" → "single UTC calendar-day" in scope line, "single event-day workflow" → "UTC calendar-day workflow", all "configured event-day" references → "current UTC calendar day", and "event-day fallback" → "current UTC calendar-day fallback" in constraints.
- Updated implementation plan (`docs/implementation/mentor-student-qr-attendance-v1-plan.md`): replaced split "runtime-day reads / event-day writes" description at line 41 with unified "all use UTC calendar-day semantics derived from `scanned_at` via `getUtcDayKey()`". Updated scope, locked constraints, and Phase 4 exit criteria to reflect current UTC calendar day fallback instead of configured event-day.
- Removed `EVENT_DATE` var from `wrangler.jsonc` (runtime code no longer depends on it; `getCurrentUtcDate()` is the fallback).
- Updated `AGENTS.md` constraint line: "single event-day" → "single UTC calendar-day".
- Grep verification confirms zero stale references to "configured event-day", "EVENT_DATE", or "single event-day" across docs/, wrangler.jsonc, and AGENTS.md.
- `docs/README.md` file references remain valid (both linked files exist).
- `npm run typecheck` passes cleanly.
- Evidence saved to `.sisyphus/evidence/task-6-docs-calendar-day.txt` and `.sisyphus/evidence/task-6-docs-links.txt`.
