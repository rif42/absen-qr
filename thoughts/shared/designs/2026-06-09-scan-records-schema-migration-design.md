---
date: 2026-06-09
topic: "scan_records schema migration: (student_id, mentor_id) -> (from_id, to_id, from_role, to_role)"
status: validated
---

## Problem Statement

The current `scan_records` schema hardcodes a **student→mentor directional assumption** with explicit `student_id` and `mentor_id` columns. This prevents the system from supporting:
- Bidirectional scan initiation (either role scanning the other)
- Future multi-role expansions
- Generic relationship tracking between any two people

We need to migrate to a **role-agnostic directional schema** using `(from_id, to_id, from_role, to_role)` while preserving all existing behavior, API contracts, and data integrity.

## Constraints

- **Zero downtime** (Cloudflare Workers + D1 — no blue/green deploys)
- **Preserve existing API responses** so frontend JS does not require coordinated deployment
- **All tests must pass** after migration, including mock D1 infrastructure
- **Data integrity**: existing scan records must be backfilled without loss
- **Duplicate scan rejection** must continue working exactly as before (one scan per unique pair per calendar day)
- **Admin export column order** must remain: `student name, secret id, mentor scanned, date, notes`
- **Single UTC calendar-day** semantics unchanged

## Approach

### Chosen Approach: **In-place column migration with API contract shim**

1. **New migration file** adds `from_id`, `to_id`, `from_role`, `to_role` columns
2. **Backfill** existing rows: `from_id = student_id`, `to_id = mentor_id`, `from_role = 'student'`, `to_role = 'mentor'`
3. **Drop** `student_id`, `mentor_id` columns after backfill
4. **Update unique constraint** from `(student_id, mentor_id, event_date)` to `(from_id, to_id, from_role, to_role, event_date)`
5. **Update indexes** to cover new columns
6. **Keep backend types** (`ScanRecord`) matching new schema
7. **Keep API response contract stable**: routes still return `studentId`, `mentorId`, `studentName`, `mentorName` by deriving them from `from_id`/`to_id` + roles

### Why this approach

- **Simplest data migration**: deterministic backfill, no data loss
- **Frontend safety**: no coordinated deploy needed
- **Test safety**: mock D1 updates are mechanical regex replacements
- **Future-proof**: role-agnostic schema supports any future directionality

### Rejected alternatives

- **"Add new table, migrate gradually"**: Overkill for a single-table schema change. D1 migrations are transactional and this is a controlled deploy.
- **"Keep old columns, add new ones, dual-write"**: Adds permanent tech debt. We can do a clean cut with a single migration.
- **"Change API contract and update frontend together"**: Risky coordinated deploy on a static HTML frontend cached at the edge.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend JS   │────▶│  Backend Routes  │────▶│  DB Layer (SQL) │
│  (unchanged)    │◄────│  (contract shim) │◄────│  (new schema)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                                               │
        │         API contract: studentId/mentorId      │
        │         DB contract: from_id/to_id/roles      │
        │                                               │
        └─────────────── Stable ────────────────────────┘
```

## Components

### 1. Database Migration (`migrations/0004_directional_scan_records.sql`)

- Add columns: `from_id TEXT`, `to_id TEXT`, `from_role TEXT`, `to_role TEXT`
- Backfill from existing `student_id`/`mentor_id`
- Drop old columns
- Recreate unique constraint
- Recreate indexes: `idx_scan_records_from_date`, `idx_scan_records_to_date`
- Add composite index: `(from_id, to_id, event_date)` for duplicate checks

### 2. Types (`src/worker/types.ts`)

Update `ScanRecord` type to replace `student_id`/`mentor_id` with directional fields.

### 3. DB Layer (`src/worker/db/scan-records.ts`)

- All INSERTs use new columns
- All WHERE clauses filter by `from_id`/`to_id` + optional role filters
- Duplicate check query uses `(from_id, to_id, from_role, to_role, event_date)`
- `auditAndBackfillEventDates` collision check uses new unique constraint

### 4. Admin DB Layer (`src/worker/db/admin-records.ts`)

- JOINs become role-aware: derive `student_name` by joining `people` where `role = 'student'` on the appropriate ID column
- `updateAdminRecord` accepts `studentId`/`mentorId` and maps to `from_id`/`to_id` + roles for the UPDATE

### 5. Scan Submission Service (`src/worker/services/scan-submission.ts`)

- Derivation logic sets `from_id`/`to_id` based on who initiated the scan
- `from_role` = scanner role, `to_role` = scanned role
- Return shape stays the same (API contract shim at route level, or keep stable here)

### 6. Routes (`src/worker/routes/student.ts`, `mentor.ts`, `admin.ts`)

- **Student `/history`**: For each scan record, determine if student is `from` or `to`, then fetch the opposite party's name
- **Mentor `/recent-scans`**: Same logic from mentor perspective
- **Admin routes**: Continue accepting `studentId`/`mentorId` in PATCH body; map to directional columns before calling DB layer

### 7. Mock D1 (`test/support/mock-d1.ts`)

- Update `ScanRecord` shape in mock state
- Update all regex patterns to match new column names
- Update duplicate detection logic
- Update JOIN/build logic for admin queries

### 8. Tests

- Update all unit tests that assert on `student_id`/`mentor_id` in mock state
- Update integration tests that verify response shapes (should be minimal if contract shim works)

### 9. Seed SQL

- Update INSERT statements to use new columns with explicit `from_role`/`to_role`

## Data Flow

### Scan Creation (Student scans Mentor)

1. `student.ts` receives POST `/scan`
2. `submitScan` determines scanner = student, scanned = mentor
3. Sets `from_id = student.person_id`, `to_id = mentor.person_id`, `from_role = 'student'`, `to_role = 'mentor'`
4. Calls `createScanRecord` with directional fields
5. DB INSERTs into `scan_records`
6. Returns `{ scan: { scanId, studentId, mentorId, ... } }` (contract shim)

### History Load (Student views history)

1. `student.ts` calls `listStudentHistory`
2. DB query: `SELECT * FROM scan_records WHERE (from_id = ? AND from_role = 'student') OR (to_id = ? AND to_role = 'student')`
3. For each record, if student is `from_id`, mentor = `to_id`; else mentor = `from_id`
4. Response includes `mentorName` derived from `people` lookup

### Admin Reassign

1. `admin.ts` receives PATCH with `{ studentId, mentorId }`
2. Maps to: `from_id = studentId`, `to_id = mentorId`, `from_role = 'student'`, `to_role = 'mentor'`
3. UPDATE sets all four directional columns
4. Response returns updated record with `studentId`/`mentorId` (contract shim)

## Error Handling Strategy

- **Migration failure**: D1 migrations are transactional. If backfill fails, migration rolls back. Deploy stops.
- **Unique constraint violation during backfill**: Must be detected and reported explicitly. Since v1 has no existing violations (enforced at app layer), this should not occur.
- **Mock D1 regex mismatch**: Caught at test time. We'll do a grep pass to ensure every production SQL pattern has a mock counterpart.
- **API contract drift**: Enforced by integration tests. If a route returns a field the frontend expects, tests fail.

## Testing Strategy

1. **Migration test**: Apply migration to a copy of production schema, verify backfill correctness, verify constraint behavior
2. **Mock D1 parity check**: Run a script or manual review ensuring every SQL in `src/worker/db/` has a matching regex in `test/support/mock-d1.ts`
3. **Unit tests**: `scan-submission.test.ts`, `admin-records.test.ts`, `calendar-day-backfill.test.ts`
4. **Integration tests**: All three API test suites (`student-api`, `mentor-api`, `admin-api`)
5. **Frontend compatibility**: Run integration tests that exercise the full request/response cycle

## Open Questions

1. **Should `from_role`/`to_role` have a CHECK constraint?** Yes — `CHECK (from_role IN ('student', 'mentor'))` and same for `to_role`. This preserves data integrity.
2. **Should we keep `student_id`/`mentor_id` as generated columns?** No — D1 SQLite may not support generated columns consistently. Better to backfill and drop.
3. **Index strategy**: Do we need a covering index for `(from_id, from_role, event_date)` and `(to_id, to_role, event_date)`? Yes, for efficient history queries.
