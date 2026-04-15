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
