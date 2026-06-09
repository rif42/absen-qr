---
date: 2026-06-09
topic: "Generalized Scan Records (Approach C)"
status: validated
---

## Problem Statement

The `scan_records` table hardcodes a **student-mentor binary** via `student_id` and `mentor_id` columns. This prevents peer scanning (student-student, mentor-mentor) and embeds role assumptions at the schema level. The user requires that **students can scan other students' QR codes** and that these scans appear in **both users' history**.

## Constraints

- Must preserve existing event-day semantics (UTC calendar day, single day only)
- Must preserve duplicate prevention (one scan per directed pair per day)
- Must preserve `notes`, `entry_method`, and `updated_at` behavior
- Must not break existing secret-link authentication
- Must update admin CSV export to reflect generalized model
- Mobile camera preview fix (autoplay + visible-before-start) must remain intact

## Chosen Approach: Generalized Directed Scan Edge

We model every scan as a **directed edge**: scanner (`from`) → scanned (`to`). Both participants see the scan in their history, but the direction tells us who initiated.

### Why This Approach

- **Single table**, no JOINs or UNIONs across multiple tables
- **Natural history query**: `WHERE from_id = ? OR to_id = ?`
- **Supports all combinations**: student→mentor, mentor→student, student→student, mentor→mentor
- **Direction is explicit**: we know who scanned whom, not just that two people interacted
- **Extensible**: if we add a third role later, the schema doesn't change

### Alternatives Considered

- **Approach A (peer_scans table)**: Rejected because it duplicates schema and requires UNION queries for history
- **Approach B (scan_type enum)**: Rejected because it overloads `mentor_id` with peer IDs, creating semantic confusion

## Architecture

### Database Schema

Rename columns to remove role-specific naming:

```sql
CREATE TABLE scan_records (
  scan_id TEXT PRIMARY KEY,
  from_id TEXT NOT NULL,          -- person who initiated the scan
  to_id TEXT NOT NULL,            -- person who was scanned
  from_role TEXT NOT NULL,        -- 'student' | 'mentor'
  to_role TEXT NOT NULL,          -- 'student' | 'mentor'
  event_date TEXT NOT NULL,
  scanned_at TEXT NOT NULL,
  entry_method TEXT NOT NULL DEFAULT 'qr',
  notes TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  UNIQUE (from_id, to_id, event_date),
  FOREIGN KEY (from_id) REFERENCES people(person_id),
  FOREIGN KEY (to_id) REFERENCES people(person_id)
);
```

**Indexes:**
- `idx_scan_records_from_date` on `(from_id, event_date)`
- `idx_scan_records_to_date` on `(to_id, event_date)`

### Migration Strategy

1. **Create new migration `0004_generalize_scan_records.sql`**:
   - Rename `student_id` → `from_id`
   - Rename `mentor_id` → `to_id`
   - Add `from_role` and `to_role` columns
   - Backfill roles by JOINing `people` table
   - Drop old indexes, create new ones
   - Update unique constraint

2. **Backfill logic**:
   ```sql
   UPDATE scan_records
   SET from_role = (SELECT role FROM people WHERE person_id = from_id),
       to_role = (SELECT role FROM people WHERE person_id = to_id);
   ```

### Data Flow

**Scan Submission:**
1. Scanner opens their secret link
2. Scanner taps "Start Scanner" and scans a QR code
3. Backend validates QR payload → gets `scannedPersonId` and `scannedRole`
4. Backend creates scan record:
   - `from_id` = scanner's person_id
   - `to_id` = scanned person's person_id
   - `from_role` = scanner's role
   - `to_role` = scanned person's role
5. Duplicate check: `WHERE from_id = ? AND to_id = ? AND event_date = ?`
   - Note: this means Student A → Student B and Student B → Student A are **different records**
   - This is intentional — both users can initiate a scan

**History Query:**
```sql
SELECT 
  sr.*,
  from_person.display_name as from_name,
  to_person.display_name as to_name
FROM scan_records sr
JOIN people from_person ON from_person.person_id = sr.from_id
JOIN people to_person ON to_person.person_id = sr.to_id
WHERE (sr.from_id = ? OR sr.to_id = ?) AND sr.event_date = ?
ORDER BY sr.scanned_at DESC
```

**History Display (per item):**
- If requesting person is `from_id`: "You scanned {to_name} ({to_role})"
- If requesting person is `to_id`: "{from_name} ({from_role}) scanned you"

### API Changes

**Student/mentor scan endpoint** (`POST /api/scan`):
- Remove "opposite role required" check
- Keep self-scan prevention
- Return `{ scan: { scanId, fromId, toId, fromName, toName, fromRole, toRole, scannedAt, entryMethod, notes } }`

**Student/mentor history endpoint** (`GET /api/history`):
- Return array of history items with `direction` field (`"outgoing"` | `"incoming"`)
- Each item includes both participant names and roles

**Admin records endpoint** (`GET /api/admin/records`):
- Return `fromId`, `toId`, `fromName`, `toName`, `fromRole`, `toRole`

**Admin export CSV**:
- New column order: `scanner_name, scanner_role, scanned_name, scanned_role, date, notes, entry_method`

## Components

### Backend

- **`src/worker/db/scan-records.ts`**: Update all SQL queries to use `from_id`/`to_id`/`from_role`/`to_role`
- **`src/worker/db/admin-records.ts`**: Update JOINs and export query
- **`src/worker/services/scan-submission.ts`**: Remove role restriction, use from/to
- **`src/worker/routes/student.ts`**: Update scan and history endpoints
- **`src/worker/routes/mentor.ts`**: Update scan and recent-scans endpoints
- **`src/worker/routes/admin.ts`**: Update records listing, export, and reassign
- **`src/worker/types.ts`**: Update `ScanRecord` interface
- **`migrations/0004_generalize_scan_records.sql`**: Schema migration

### Frontend

- **`public/student/app.js`**: Update history rendering to show direction
- **`public/mentor/app.js`**: Update recent scans rendering to show direction
- **`public/admin/app.js`**: Update table columns and CSV export format

### Tests

- **`test/support/mock-d1.ts`**: Update mock schema, query parser, and duplicate logic
- **`test/unit/scan-submission.test.ts`**: Remove same-role rejection tests, add peer scan tests
- **`test/unit/admin-records.test.ts`**: Update for new column names
- **`test/integration/student-api.test.ts`**: Update scan and history tests
- **`test/integration/mentor-api.test.ts`**: Update scan and recent-scans tests
- **`test/integration/admin-api.test.ts`**: Update records and export tests

### Seed Data

- **`seed/dev.sql`**: Update INSERT column names
- **`seed/e2e-admin.sql`**: Update INSERT column names

## Error Handling

- **Self-scan**: Still rejected with 400 ("You cannot scan yourself.")
- **Duplicate scan**: Rejected with 409 ("You already scanned this person today.")
- **Invalid QR**: Same as before
- **Missing roles after migration**: Migration includes NOT NULL with backfill, so this shouldn't happen

## Testing Strategy

1. **Unit tests**: Verify scan submission allows peer scans, rejects self-scans, prevents duplicates
2. **Integration tests**: Verify student→student scan appears in both histories; verify mentor→mentor scan works
3. **DOM tests**: Verify frontend renders direction labels correctly
4. **Admin tests**: Verify export CSV has new column order
5. **Migration test**: Apply migration to existing data, verify backfill correctness

## Open Questions

None — Approach C is fully specified.
