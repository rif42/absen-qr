# Implementation Plan: scan_records Schema Migration

## Source Design
- `thoughts/shared/designs/2026-06-09-scan-records-schema-migration-design.md`

## Goal
Migrate `scan_records` from `(student_id, mentor_id)` to `(from_id, to_id, from_role, to_role)` while preserving API contracts, data integrity, and all tests.

## Step 1: Database Migration

**File:** `migrations/0004_directional_scan_records.sql`

1. Add columns:
   - `from_id TEXT`
   - `to_id TEXT`
   - `from_role TEXT`
   - `to_role TEXT`
2. Backfill existing rows:
   - `from_id = student_id`, `to_id = mentor_id`
   - `from_role = 'student'`, `to_role = 'mentor'`
3. Drop old columns: `student_id`, `mentor_id`
4. Drop old unique constraint on `(student_id, mentor_id, event_date)`
5. Add new unique constraint: `(from_id, to_id, from_role, to_role, event_date)`
6. Drop old indexes: `idx_scan_records_student_date`, `idx_scan_records_mentor_date`
7. Add new indexes:
   - `idx_scan_records_from_date` on `(from_id, from_role, event_date)`
   - `idx_scan_records_to_date` on `(to_id, to_role, event_date)`
   - `idx_scan_records_pair_date` on `(from_id, to_id, event_date)`
8. Add CHECK constraints:
   - `CHECK (from_role IN ('student', 'mentor'))`
   - `CHECK (to_role IN ('student', 'mentor'))`

## Step 2: Update TypeScript Types

**File:** `src/worker/types.ts`

Replace `ScanRecord` fields:
- Remove: `student_id: string`, `mentor_id: string`
- Add: `from_id: string`, `to_id: string`, `from_role: 'student' | 'mentor'`, `to_role: 'student' | 'mentor'`

## Step 3: Update DB Layer — scan-records.ts

**File:** `src/worker/db/scan-records.ts`

1. `CreateScanRecordInput`: replace `studentId`/`mentorId` with `fromId`, `toId`, `fromRole`, `toRole`
2. `createScanRecord`: UPDATE INSERT statement to use new columns and bind params
3. `listStudentHistory`: UPDATE WHERE to `(from_id = ?1 AND from_role = 'student') OR (to_id = ?1 AND to_role = 'student')`
4. `findStudentMentorScanRecordByEventDate`: UPDATE to query `(from_id, to_id, from_role, to_role, event_date)`
5. `listMentorRecentScans`: UPDATE WHERE to `(from_id = ?1 AND from_role = 'mentor') OR (to_id = ?1 AND to_role = 'mentor')`
6. `findMentorScanRecordById`: UPDATE WHERE to check mentor ownership via role-aware columns
7. `updateScanRecordNotes`: UPDATE WHERE to use role-aware ownership check
8. `auditAndBackfillEventDates`: UPDATE collision check to use new unique constraint columns
9. `isDuplicateScanRecordError`: keep as-is (matches on "unique constraint failed" + "scan_records")

## Step 4: Update DB Layer — admin-records.ts

**File:** `src/worker/db/admin-records.ts`

1. `buildAdminRecordSelectQuery`: UPDATE JOINs to derive student/mentor via role-aware matching:
   - `JOIN people AS student ON (student.person_id = scan_records.from_id AND scan_records.from_role = 'student') OR (student.person_id = scan_records.to_id AND scan_records.to_role = 'student')`
   - Similar for mentor JOIN
2. `UpdateAdminRecordInput`: keep `studentId`/`mentorId` for API contract
3. `updateAdminRecord`: Map `studentId` -> `from_id` with `from_role = 'student'`, `mentorId` -> `to_id` with `to_role = 'mentor'` (assuming admin always sees student->mentor direction; if not, determine from existing record)
4. `listAdminExportRows`: Same JOIN update as `buildAdminRecordSelectQuery`

## Step 5: Update Scan Submission Service

**File:** `src/worker/services/scan-submission.ts`

1. `ScanSubmissionResult`: keep `studentId`/`mentorId` in return type for API contract
2. `submitScan`:
   - Determine `from_id`/`to_id` based on scanner/scanned
   - Set `from_role = scannerPerson.role`, `to_role = scannedRole`
   - Pass to `createScanRecord` with new input shape
   - Map back to `studentId`/`mentorId` in return value

## Step 6: Update Routes — API Contract Shim

**Files:** `src/worker/routes/student.ts`, `src/worker/routes/mentor.ts`, `src/worker/routes/admin.ts`

### student.ts
- `/history`: For each `ScanRecord`, determine if student is `from` or `to`. Fetch opposite party from `people`. Return `{ scanId, mentorId, mentorName, scannedAt, entryMethod, notes }`
- `/scan`: Pass through `submitScan` result (already stable contract)
- `/redeem-code`: Call `createScanRecord` with directional fields. Map `studentId`/`mentorId` appropriately.

### mentor.ts
- `/recent-scans`: For each record, determine if mentor is `from` or `to`. Fetch opposite party. Return stable shape.
- `/notes/:scanId`: Ownership check must use role-aware columns.

### admin.ts
- `/records`: Return stable `AdminRecord` shape with `studentId`/`mentorId`
- `PATCH /records/:scanId`: Accept `studentId`/`mentorId` in body. Map to directional columns before DB update.
- `/export.csv`: Same JOIN logic as admin records list.

## Step 7: Update Mock D1

**File:** `test/support/mock-d1.ts`

1. Update `ScanRecord` usage throughout to use new field names
2. Update `normalizeSql` regex matches:
   - `insert into scan_records` bind handling: expect 10 params (added `from_role`, `to_role`)
   - `where from_id = ?1 and from_role = 'student'` (and similar patterns)
   - `where to_id = ?1 and to_role = 'mentor'` (and similar patterns)
   - `where from_id = ?1 and to_id = ?2 and from_role = ?3 and to_role = ?4 and event_date = ?5`
   - Admin JOIN patterns with role-aware conditions
3. Update `applyAdminScanRecordUpdate` to handle `from_id`, `to_id`, `from_role`, `to_role`
4. Update duplicate/conflict detection to check `(from_id, to_id, from_role, to_role, event_date)`
5. Update `buildAdminJoinedRow` to resolve student/mentor via roles

## Step 8: Update Tests

### Unit Tests
- `test/unit/scan-submission.test.ts`: Update mocks and assertions to use new `ScanRecord` shape
- `test/unit/mock-d1-admin.test.ts`: Update SQL patterns and expected columns
- `test/unit/admin-records.test.ts`: Update expected `AdminRecord` derivation
- `test/unit/calendar-day-backfill.test.ts`: Update collision check assertions

### Integration Tests
- `test/integration/student-api.test.ts`: Verify `/history` and `/scan` responses remain stable
- `test/integration/mentor-api.test.ts`: Verify `/recent-scans` and notes updates
- `test/integration/admin-api.test.ts`: Verify PATCH reassign, export CSV, record list

## Step 9: Update Seed SQL

**Files:** `seed/dev.sql`, `seed/e2e-admin.sql`

Replace all `INSERT INTO scan_records (scan_id, student_id, mentor_id, ...)` with explicit `from_id`, `to_id`, `from_role`, `to_role` values.

## Step 10: Verification

1. Run `npm run typecheck` — ensure TypeScript compiles
2. Run `npm test` — all unit and integration tests pass
3. Run `npm run d1:migrate:local` — migration applies cleanly
4. Run `npm run seed:local` — seeds insert correctly
5. Manual smoke test:
   - Student scans mentor → success
   - Student views history → shows mentor name
   - Mentor views recent scans → shows student name
   - Admin views records → shows both names
   - Admin reassigns record → updates correctly
   - Admin exports CSV → correct column order

## Step 11: Deployment

1. Apply migration to remote D1: `wrangler d1 migrations apply absen-qr --remote`
2. Deploy worker: `wrangler deploy`
3. Verify production behavior

## Files to Modify (22 files)

1. `migrations/0004_directional_scan_records.sql` (new)
2. `src/worker/types.ts`
3. `src/worker/db/scan-records.ts`
4. `src/worker/db/admin-records.ts`
5. `src/worker/services/scan-submission.ts`
6. `src/worker/routes/student.ts`
7. `src/worker/routes/mentor.ts`
8. `src/worker/routes/admin.ts`
9. `test/support/mock-d1.ts`
10. `test/unit/scan-submission.test.ts`
11. `test/unit/mock-d1-admin.test.ts`
12. `test/unit/admin-records.test.ts`
13. `test/unit/calendar-day-backfill.test.ts`
14. `test/integration/student-api.test.ts`
15. `test/integration/mentor-api.test.ts`
16. `test/integration/admin-api.test.ts`
17. `seed/dev.sql`
18. `seed/e2e-admin.sql`

## Files NOT to Modify

- `public/student/app.js` (API contract stable)
- `public/mentor/app.js` (API contract stable)
- `public/admin/app.js` (API contract stable)
- `wrangler.jsonc` (no schema references)
- `scripts/import-users.mjs` (no scan_records references)
- `src/worker/db/fallback-codes.ts` (unaffected table)
- `src/worker/services/event-day.ts` (no scan column references)
- `migrations/0002_backfill_event_dates.sql` (historical)
- `migrations/0003_fallback_codes.sql` (historical)

## Risk Mitigation

- **Mock D1 parity**: After modifying any SQL in `src/worker/db/`, immediately update matching regex in `test/support/mock-d1.ts`
- **API contract drift**: Integration tests enforce response shapes
- **Migration safety**: D1 migrations are transactional; backfill is deterministic
- **Rollback**: If deploy fails, revert worker code and restore old schema (requires manual D1 migration reversal)
