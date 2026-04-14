## 2026-04-14T09:10:14.3153641+07:00 Task: session-init
- Runtime "today" for this task means UTC `YYYY-MM-DD`, derived from `new Date().toISOString().slice(0, 10)`.
- History visibility must use `scanned_at` UTC day, not `event_date`, to avoid mismatches when write-time `EVENT_DATE` differs from runtime today.
- Scope is limited to student `/api/history`, mentor `/api/recent-scans`, shared helpers/query semantics, deterministic tests, mock D1 behavior, and the implementation-plan note.
- Do not add any date UI, query param, or client-side filtering.

## 2026-04-14T09:13:27+07:00 Task: foundation-complete
- Added `getCurrentUtcDate(now: Date = new Date())` beside `getConfiguredEventDate(env)` in `src/worker/services/event-day.ts` and validated the runtime UTC slice with `isEventDate` before returning.
- Switched only the shared history readers in `src/worker/db/scan-records.ts` to `substr(scanned_at, 1, 10) = ?2` and renamed the second parameter to `utcDate`.
- Updated `test/support/mock-d1.ts` so the history query branches mirror `scanRecord.scanned_at.slice(0, 10)` semantics.
- Verification passed: typecheck and targeted student/mentor integration suites were green.

## 2026-04-14T09:19:40+07:00 Task: mentor-recent-scans-runtime-day
- `GET /api/mentor/recent-scans` now keys visibility off the runtime UTC day via `getCurrentUtcDate()`, while `/api/mentor/me` and `/api/mentor/notes/:scanId` remain unchanged.
- Mentor integration coverage now freezes time at `2026-01-15T12:00:00.000Z`, overrides `EVENT_DATE` per test, and proves both newest-first ordering and the empty-list case when only non-today scans exist.
- The response payload still uses `recentScans` entries with `scanId`, `studentId`, `studentName`, `scannedAt`, and `notes`.

## 2026-04-14T09:18:45+07:00 Task: student-history-runtime-day
- `src/worker/routes/student.ts` now uses `getCurrentUtcDate()` only in the `/history` branch; `/scan` still derives `EVENT_DATE` from `getConfiguredEventDate(env)`.
- `test/integration/student-api.test.ts` needs a frozen UTC clock plus an `EVENT_DATE` override to prove history visibility ignores configured event day while scan creation still reports `eventDate`.
- The new empty-history regression is useful because it proves old-day scans do not leak into runtime-today history.

## 2026-04-14T09:23:58+07:00 Task: plan-alignment
- The implementation plan now states that student `/api/student/history` and mentor `/api/mentor/recent-scans` visibility is based on the runtime UTC day via `scanned_at`, while scan creation, duplicate prevention, and admin correction semantics remain event-day scoped.
- The student and mentor UI responsibility bullets were kept narrow and only reworded to match the runtime-day history behavior.

## 2026-04-14T09:40:00+07:00 Task: duplicate-precheck-fix
- `/api/student/scan` now uses a dedicated event-day lookup on `(student_id, mentor_id, event_date)` instead of reusing the runtime-day history reader, so duplicate prevention no longer depends on `scanned_at` day.
- The regression test is strongest when the stored duplicate has the right `event_date` but an older `scanned_at` day; that reproduces the exact failure mode from the final-wave review.
