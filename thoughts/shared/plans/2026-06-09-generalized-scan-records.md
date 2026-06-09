---
date: 2026-06-09
topic: "Generalized Scan Records Implementation"
status: draft
---

## 1. File Inventory

Files to modify, grouped by layer.

### Database
- `migrations/0004_generalize_scan_records.sql` — new migration

### Backend — Types
- `src/worker/types.ts` — `ScanRecord` interface

### Backend — DB Layer
- `src/worker/db/scan-records.ts` — all SQL queries
- `src/worker/db/admin-records.ts` — admin JOINs, export query, update logic

### Backend — Service Layer
- `src/worker/services/scan-submission.ts` — remove role restriction, use from/to

### Backend — Routes
- `src/worker/routes/student.ts` — scan and history endpoints
- `src/worker/routes/mentor.ts` — scan and recent-scans endpoints
- `src/worker/routes/admin.ts` — records listing, export, reassign, delete

### Frontend
- `public/student/app.js` — history rendering
- `public/mentor/app.js` — recent scans rendering
- `public/admin/app.js` — table columns, CSV export format

### Tests
- `test/support/mock-d1.ts` — mock schema, query parser, duplicate logic
- `test/unit/scan-submission.test.ts` — remove same-role rejection, add peer scan
- `test/unit/admin-records.test.ts` — new column names
- `test/integration/student-api.test.ts` — scan + history
- `test/integration/mentor-api.test.ts` — scan + recent-scans
- `test/integration/admin-api.test.ts` — records + export

### Seed Data
- `seed/dev.sql`
- `seed/e2e-admin.sql`

## 2. Migration SQL

Create `migrations/0004_generalize_scan_records.sql`.

```sql
-- Rename role-specific columns to generalized from/to columns
ALTER TABLE scan_records RENAME COLUMN student_id TO from_id;
ALTER TABLE scan_records RENAME COLUMN mentor_id TO to_id;

-- Add role columns
ALTER TABLE scan_records ADD COLUMN from_role TEXT;
ALTER TABLE scan_records ADD COLUMN to_role TEXT;

-- Backfill roles by joining the people table
UPDATE scan_records
SET from_role = (SELECT role FROM people WHERE person_id = from_id),
    to_role   = (SELECT role FROM people WHERE person_id = to_id);

-- Make role columns NOT NULL after backfill
ALTER TABLE scan_records ALTER COLUMN from_role SET NOT NULL;
ALTER TABLE scan_records ALTER COLUMN to_role   SET NOT NULL;

-- Drop old indexes
DROP INDEX IF EXISTS idx_scan_records_student_date;
DROP INDEX IF EXISTS idx_scan_records_mentor_date;

-- Create new indexes
CREATE INDEX idx_scan_records_from_date ON scan_records(from_id, event_date);
CREATE INDEX idx_scan_records_to_date   ON scan_records(to_id, event_date);

-- Drop old unique constraint (D1 does not support named-constraint DROP directly;
-- rely on the fact that RENAME COLUMN keeps the underlying unique index).
-- Recreate unique constraint on new column names.
-- D1 note: SQLite allows re-adding UNIQUE via table recreation if needed.
-- For D1 compatibility, we trust that the old unique index was rebuilt automatically
-- by the RENAME COLUMN operations above. If not, run:
--   CREATE UNIQUE INDEX idx_scan_records_unique ON scan_records(from_id, to_id, event_date);
```

**Note on D1 compatibility:** D1 uses SQLite under the hood. `RENAME COLUMN` is supported in SQLite 3.25+. If D1’s SQLite version is older, replace the `RENAME` steps with:
1. `CREATE TABLE scan_records_new (...)` with the desired schema.
2. `INSERT INTO scan_records_new SELECT ... FROM scan_records`.
3. `DROP TABLE scan_records`.
4. `ALTER TABLE scan_records_new RENAME TO scan_records`.

## 3. Type Changes

In `src/worker/types.ts`, replace the `ScanRecord` interface.

**Before:**
```typescript
export type ScanRecord = {
  scan_id: string;
  student_id: string;
  mentor_id: string;
  event_date: string;
  scanned_at: string;
  entry_method: "qr" | "fallback_code";
  notes: string;
  updated_at: string;
};
```

**After:**
```typescript
export type ScanRecord = {
  scan_id: string;
  from_id: string;
  to_id: string;
  from_role: "student" | "mentor";
  to_role: "student" | "mentor";
  event_date: string;
  scanned_at: string;
  entry_method: "qr" | "fallback_code";
  notes: string;
  updated_at: string;
};
```

## 4. DB Query Rewrites

### `src/worker/db/scan-records.ts`

**`createScanRecord`** — Update input type and SQL.
- Input becomes `{ scanId, fromId, toId, fromRole, toRole, eventDate, scannedAt, entryMethod? }`.
- SQL `INSERT` lists `from_id, to_id, from_role, to_role` instead of `student_id, mentor_id`.
- Return object uses new keys.

**`isDuplicateScanRecordError`** — Keep as-is (still checks `unique constraint failed` + `scan_records`).

**`listStudentHistory`** → rename to **`listPersonHistory`**.
- Query: `WHERE (from_id = ?1 OR to_id = ?1) AND event_date = ?2 ORDER BY scanned_at DESC`.
- Remove the `substr(scanned_at, 1, 10)` filter; use `event_date` directly (it is already normalized).

**`findStudentMentorScanRecordByEventDate`** → rename to **`findScanRecordByPairAndDate`**.
- Query: `WHERE from_id = ?1 AND to_id = ?2 AND event_date = ?3`.
- This enforces **directed** uniqueness: A→B and B→A are distinct records.

**`listMentorRecentScans`** → rename to **`listOutgoingScans`** (or keep generic `listScansByFromId`).
- Query: `WHERE from_id = ?1 AND event_date = ?2 ORDER BY scanned_at DESC`.

**`findMentorScanRecordById`** → rename to **`findScanRecordByFromIdAndId`**.
- Query: `WHERE from_id = ?1 AND scan_id = ?2`.

**`updateScanRecordNotes`** → rename to **`updateScanRecordNotesByFromId`**.
- Query: `SET notes = ?1, updated_at = ?2 WHERE from_id = ?3 AND scan_id = ?4`.

**`auditAndBackfillEventDates`** — Update collision check query to use `from_id` and `to_id`.

### `src/worker/db/admin-records.ts`

**`buildAdminRecordSelectQuery`** — Replace JOINs.
- Replace `JOIN people AS student ON student.person_id = scan_records.student_id AND student.role = 'student'` with:
  - `JOIN people AS from_person ON from_person.person_id = scan_records.from_id`
  - `JOIN people AS to_person   ON to_person.person_id   = scan_records.to_id`
- Select `from_person.display_name AS from_name`, `to_person.display_name AS to_name`.
- Remove `student_secret_id` from the admin select; if still needed for export, fetch it via a separate lookup or add `from_person.secret_id`.

**`AdminRecord` type** — Update fields:
- `fromId`, `fromName`, `fromRole`, `toId`, `toName`, `toRole`.

**`AdminExportRow` type** — Update fields:
- `fromName`, `fromRole`, `toName`, `toRole`, `eventDate`, `notes`, `entryMethod`.

**`updateAdminRecord`** — Allow updating `from_id` and `to_id` (replacing `student_id`/`mentor_id`).
- Add `fromId?` and `toId?` to `UpdateAdminRecordInput`.
- In `applyAdminScanRecordUpdate` (mock), update column checks from `student_id`/`mentor_id` to `from_id`/`to_id`.

**`listAdminExportRows`** — Replace JOINs to use `from_person`/`to_person`.
- CSV column order: `from_name, from_role, to_name, to_role, event_date, notes, entry_method`.

## 5. Service & Route Changes

### `src/worker/services/scan-submission.ts`

**Remove the opposite-role check:**
- Delete `if (scannerPerson.role === scannedRole) return badRequest("You can only scan the opposite role.")`.
- Keep self-scan prevention.

**Remove student/mentor ID inference:**
- Delete `const studentId = scannerPerson.role === "student" ? ... : ...`.
- Delete `const mentorId = scannerPerson.role === "mentor" ? ... : ...`.

**Use from/to directly:**
- `fromId` = `scannerPerson.person_id`
- `toId` = `scannedPerson.person_id`
- `fromRole` = `scannerPerson.role`
- `toRole` = `scannedPerson.role`

**Return shape:**
```typescript
interface ScanSubmissionResult {
  scan: {
    scanId: string;
    fromId: string;
    toId: string;
    fromRole: string;
    toRole: string;
    eventDate: string;
    scannedAt: string;
    entryMethod: string;
  };
  scannedPerson: {
    personId: string;
    displayName: string;
  };
}
```

**Duplicate check:** Call `findScanRecordByPairAndDate(db, fromId, toId, eventDate)`.

### `src/worker/routes/student.ts`

**`POST /api/scan`** — No logic change beyond calling the updated `submitScan`.
- The service now returns `fromId/toId`; return those keys to the frontend.

**`GET /api/history`** — Replace `listStudentHistory` with `listPersonHistory`.
- Query parameter `person_id` comes from authenticated scanner.
- Return array of scan objects with a `direction` field:
  - `"outgoing"` if `from_id === person_id`
  - `"incoming"` if `to_id === person_id`

### `src/worker/routes/mentor.ts`

**`POST /api/scan`** — Same as student route; the service is role-agnostic.

**`GET /api/recent-scans`** — Replace `listMentorRecentScans` with `listOutgoingScans`.
- Return scans where `from_id === mentorPerson.person_id`.

**`POST /api/scan/:scanId/notes`** — Replace `updateScanRecordNotes` with `updateScanRecordNotesByFromId`.
- Ensure mentor can only update scans they initiated (`from_id` check).

### `src/worker/routes/admin.ts`

**`GET /api/admin/records`** — Return new `AdminRecord` shape (`fromId`, `fromName`, `fromRole`, etc.).

**`GET /api/admin/export`** — Update CSV header and row mapping to new columns.

**`PUT /api/admin/records/:scanId`** — Accept `fromId` and `toId` in body instead of `studentId` and `mentorId`.

## 6. Frontend Changes

### `public/student/app.js`

**History rendering:**
- Iterate over history items.
- For each item:
  - If `direction === "outgoing"`: show "You scanned {toName} ({toRole})"
  - If `direction === "incoming"`: show "{fromName} ({fromRole}) scanned you"
- Remove hardcoded "mentor" labels.

**Scan success feedback:**
- Update to read `result.scan.fromId` / `toId` if needed (likely no visible change).

### `public/mentor/app.js`

**Recent scans rendering:**
- Show outgoing scans only (the API already filters by `from_id`).
- Display: "You scanned {toName} ({toRole}) at {time}".

**Notes editing:**
- No structural change; still PATCH/POST to `/api/scan/{scanId}/notes`.

### `public/admin/app.js`

**Records table:**
- Columns become: Scanner Name, Scanner Role, Scanned Name, Scanned Role, Date, Method, Notes, Actions.
- Reassign dropdowns need both student and mentor lists for **both** `from` and `to` sides, OR a single unified people dropdown with role labels.
  - Simpler approach: two dropdowns (“Scanner” and “Scanned”), each listing all people grouped by role.

**CSV export:**
- Header: `scanner_name,scanner_role,scanned_name,scanned_role,date,notes,entry_method`

## 7. Test Updates

### `test/support/mock-d1.ts`

**`MockState.ScanRecord` shape:** Update to new keys (`from_id`, `to_id`, `from_role`, `to_role`).

**`buildAdminJoinedRow`:** Replace `student`/`mentor` lookups with `from_person`/`to_person` lookups based on `from_id`/`to_id`.

**Query parser regexes:** Update every `normalizedSql.includes(...)` check:
- `student_id` → `from_id`
- `mentor_id` → `to_id`
- `WHERE mentor_id = ?1 AND scan_id = ?2` → `WHERE from_id = ?1 AND scan_id = ?2`
- `WHERE student_id = ?1 AND substr(...)` → `WHERE (from_id = ?1 OR to_id = ?1) AND event_date = ?2`
- `WHERE mentor_id = ?1 AND substr(...)` → `WHERE from_id = ?1 AND event_date = ?2`

**`applyAdminScanRecordUpdate`:** Update column checks from `student_id`/`mentor_id` to `from_id`/`to_id`.

**`run()` insert logic:** Map params to new `from_id`, `to_id`, `from_role`, `to_role` fields.

### `test/unit/scan-submission.test.ts`

- **Remove** tests asserting `"You can only scan the opposite role."`.
- **Add** test: student scans another student → succeeds, creates record with `fromRole: "student"`, `toRole: "student"`.
- **Add** test: mentor scans another mentor → succeeds.
- **Keep** self-scan rejection test.
- **Keep** duplicate rejection test.
- Update assertions to check `result.scan.fromId` and `toId`.

### `test/unit/admin-records.test.ts`

- Update mock seed data to use `from_id`/`to_id`.
- Update assertions checking `studentName`/`mentorName` to `fromName`/`toName`.
- Update `updateAdminRecord` calls to pass `fromId`/`toId`.

### `test/integration/student-api.test.ts`

- Update scan request body/response expectations to new shape.
- Update history response to expect `direction` field.
- Add integration test: two students scan each other; each sees the scan in their history with correct direction.

### `test/integration/mentor-api.test.ts`

- Same pattern as student integration tests.
- Add test: mentor→mentor scan works.

### `test/integration/admin-api.test.ts`

- Update export CSV header assertion.
- Update records list to assert `fromName`, `toName`, etc.

## 8. Seed Data Updates

In `seed/dev.sql` and `seed/e2e-admin.sql`, update every `INSERT INTO scan_records` statement:

**Before:**
```sql
INSERT INTO scan_records (scan_id, student_id, mentor_id, event_date, scanned_at, notes, updated_at)
VALUES ('s1', 'stu-1', 'men-1', '2024-01-15', '2024-01-15T10:00:00Z', '', '2024-01-15T10:00:00Z');
```

**After:**
```sql
INSERT INTO scan_records (scan_id, from_id, to_id, from_role, to_role, event_date, scanned_at, entry_method, notes, updated_at)
VALUES ('s1', 'stu-1', 'men-1', 'student', 'mentor', '2024-01-15', '2024-01-15T10:00:00Z', 'qr', '', '2024-01-15T10:00:00Z');
```

If seed data uses `student_id`/`mentor_id` in `JOIN` queries (e.g., to generate sample history), rewrite those `JOIN`s to use `from_id`/`to_id`.

## 9. Execution Order

Run the following steps in order. Do not skip test checkpoints.

### Step 1 — Migration & Types
1. Write `migrations/0004_generalize_scan_records.sql`.
2. Update `src/worker/types.ts`.
3. **Test checkpoint:** Run `npm test` — expect compilation errors in DB layer (expected; proceed).

### Step 2 — DB Layer
4. Rewrite `src/worker/db/scan-records.ts`.
5. Rewrite `src/worker/db/admin-records.ts`.
6. **Test checkpoint:** Unit tests for DB layer still fail because mock D1 is out of date; proceed.

### Step 3 — Service & Routes
7. Rewrite `src/worker/services/scan-submission.ts`.
8. Update `src/worker/routes/student.ts`, `mentor.ts`, `admin.ts`.
9. **Test checkpoint:** `npm test` — compilation passes; integration tests fail due to mock D1.

### Step 4 — Mock D1 & Unit Tests
10. Update `test/support/mock-d1.ts`.
11. Update `test/unit/scan-submission.test.ts`.
12. Update `test/unit/admin-records.test.ts`.
13. **Test checkpoint:** `npm run test:unit` — all unit tests pass.

### Step 5 — Integration Tests
14. Update `test/integration/student-api.test.ts`.
15. Update `test/integration/mentor-api.test.ts`.
16. Update `test/integration/admin-api.test.ts`.
17. **Test checkpoint:** `npm run test:integration` — all integration tests pass.

### Step 6 — Frontend
18. Update `public/student/app.js`.
19. Update `public/mentor/app.js`.
20. Update `public/admin/app.js`.
21. **Test checkpoint:** Manual browser verification or existing DOM tests.

### Step 7 — Seed Data
22. Update `seed/dev.sql` and `seed/e2e-admin.sql`.
23. **Test checkpoint:** `npm run db:seed` (or equivalent) succeeds.

### Step 8 — Final Verification
24. Full test suite: `npm test`.
25. Verify admin CSV export format manually if no automated assertion covers header order.

## 10. Rollback Plan

If the migration is applied and needs reversal:

1. **Before deploying code:** The migration renames columns. Rolling back requires:
   - `ALTER TABLE scan_records RENAME COLUMN from_id TO student_id;`
   - `ALTER TABLE scan_records RENAME COLUMN to_id TO mentor_id;`
   - `ALTER TABLE scan_records DROP COLUMN from_role;`
   - `ALTER TABLE scan_records DROP COLUMN to_role;`
   - Recreate old indexes.

2. **Data loss risk:** `from_role` and `to_role` are derived columns. Dropping them loses no irrecoverable data (they can be re-derived from `people`).

3. **Code rollback:** Revert git commit. The old code expects `student_id`/`mentor_id`; it will work immediately after the column renames above.

4. **Deployment strategy:** Apply migration first, then deploy new code. This avoids old code failing against new schema. If rollback is needed, revert code first, then apply reverse migration.
