# Mentor-Student QR Attendance Implementation Plan (v1)

**Status:** Draft for execution  
**Derived from:** [Mentor-Student QR Attendance PRD (v1)](../prd/mentor-student-qr-attendance-v1.md)  
**Recommended stack:** Cloudflare Workers + D1

## Purpose
This document translates the approved PRD into an implementation-ready engineering plan. It defines the expected architecture, delivery phases, data model, APIs, UI responsibilities, validation strategy, and rollout order for the v1 internal pilot.

## Scope Summary
The system must support three web roles for a single event-day:
- **Student:** scan a mentor QR code and view same-day mentor scan history.
- **Mentor:** display a stable QR code and receive immediate live note-entry state after student scans.
- **Admin:** inspect all records, export CSV, and manually edit, delete, or reassign records.

Locked product constraints:
- single event-day only
- one secret link per person
- stable unique IDs for all students and mentors
- duplicate student→mentor scans are rejected
- admin correction behavior is last-write-wins
- CSV export column order is `student name, secret id, mentor scanned, date, notes`

## Architecture Overview

### Runtime
- **Cloudflare Workers** serves static role pages and JSON APIs.
- **Cloudflare D1** stores seeded identities, scan transactions, and mentor notes.

### High-Level Flow
1. Student opens their secret URL and scans a mentor QR code.
2. Worker validates the scan against seeded identities and duplicate-scan rules.
3. Worker persists the scan transaction.
4. Student page refreshes same-day history.
5. Mentor page receives live update for the new student interaction.
6. Mentor enters notes tied to that scan record.
7. Admin views, corrects, and exports final records.

### Real-Time Update Strategy
The highest-risk requirement is the mentor page updating live after a student scan. For v1, implementation should prefer the simplest reliable mechanism that works on Workers:
- first choice: short-interval polling from the mentor page against a mentor-specific “recent scans” endpoint
- optional later refinement: SSE or another push model only if polling proves insufficient

This keeps the architecture simple while still satisfying the PRD requirement that the mentor page updates without manual refresh.

## Proposed Repository Structure
```text
docs/
  prd/
  implementation/
public/
  student/
  mentor/
  admin/
src/
  worker/
    index.ts
    routes/
    services/
    db/
    validation/
migrations/
seed/
scripts/
test/
  unit/
  integration/
  e2e/
```

## Data Model

### Tables
1. **people**
   - stores all seeded identities
   - fields:
     - `person_id`
     - `display_name`
     - `role` (`student` or `mentor`)
     - `secret_id`
     - `secret_path_token` or equivalent secret-link lookup value

2. **scan_records**
   - stores one student→mentor interaction per event-day pair
   - fields:
     - `scan_id`
     - `student_id`
     - `mentor_id`
     - `event_date`
     - `scanned_at`
     - `notes`
     - `updated_at`

3. **admin_access** (optional)
   - only needed if admin secret-link handling is managed separately from `people`
   - fields:
     - `admin_id`
     - `secret_path_token`

### Constraints
- `people.person_id` must be unique.
- `people.secret_id` must be unique.
- `scan_records` must enforce uniqueness on `(student_id, mentor_id, event_date)`.
- notes are stored on the scan record itself for v1 simplicity.
- admin edits overwrite the current record state.

## API Surface

### Student APIs
- `GET /api/student/me`
  - returns student identity derived from secret link
- `POST /api/student/scan`
  - payload: scanned mentor QR token or mentor ID
  - validates identity, duplicate rule, and event-day scope
  - creates scan record
- `GET /api/student/history`
  - returns current event-day mentor scan history for the current student

### Mentor APIs
- `GET /api/mentor/me`
  - returns mentor identity and QR payload information
- `GET /api/mentor/recent-scans`
  - returns recent scan records for that mentor for live note-entry updates
- `POST /api/mentor/notes/:scanId`
  - writes or updates notes for a scan record

### Admin APIs
- `GET /api/admin/records`
  - returns event-day records for admin table view
- `PATCH /api/admin/records/:scanId`
  - edits notes or reassigns student or mentor
- `DELETE /api/admin/records/:scanId`
  - deletes an erroneous record
- `GET /api/admin/export.csv`
  - exports CSV in exact required column order

## UI Responsibilities

### Student Page
- resolve student identity from secret link
- open camera scanner
- submit scan results
- show deterministic success/error states
- render same-day mentor history
- explain duplicate-scan rejection clearly

### Mentor Page
- resolve mentor identity from secret link
- display mentor QR code persistently
- poll for new scan activity
- surface the newest student interaction immediately
- allow note entry and save state feedback

### Admin Page
- show all event-day records in table form
- support note edits
- support record deletion
- support reassigning student or mentor
- support CSV export

## Delivery Phases

### Phase 1 — Scaffolding and Foundations
- scaffold Worker project and docs-aware repo layout
- configure D1, migrations, seed flow, and test harness
- create seeded identity model for 5 students and 5 mentors
- establish secret-link resolution rules

**Exit criteria**
- Worker boots locally
- D1 schema migrates successfully
- seed script loads identities with roles and secret IDs

### Phase 2 — Student Flow
- implement student secret-link page
- implement QR scanning flow
- persist scan records
- enforce duplicate-scan rejection
- implement same-day student history

**Exit criteria**
- valid mentor scan creates one record
- duplicate same-day scan is rejected
- student history shows only that student’s current event-day mentors

### Phase 3 — Mentor Flow
- implement mentor secret-link page
- render stable mentor QR code
- implement live recent-scan detection via polling
- implement immediate note entry and save flow

**Exit criteria**
- mentor page updates without manual refresh after a student scan
- note entry is attached to the correct scan record

### Phase 4 — Admin Flow
- implement admin secret-link page
- build records table view
- build edit/delete/reassign actions
- implement CSV export with exact column order

**Exit criteria**
- admin can view all current event-day records
- admin changes persist and overwrite current state
- CSV export matches required column order exactly

### Phase 5 — Hardening and QA
- validate error states and malformed QR handling
- validate cross-role access isolation
- validate camera fallback behavior where needed
- verify end-to-end flows with test data

**Exit criteria**
- unit, integration, and e2e coverage exists for all P0 flows
- role isolation and duplicate-scan rules are verified

## Testing Strategy

### Unit Tests
- secret-link resolution helpers
- duplicate-scan validation logic
- CSV serialization order
- record reassignment validation

### Integration Tests
- student scan route creates a record
- duplicate route attempt is rejected
- mentor notes write to correct scan record
- admin edit/delete/reassign routes persist changes
- CSV export returns required columns in required order

### End-to-End Tests
- student scans mentor and sees same-day history
- mentor page receives the new interaction and saves notes
- admin edits and exports corrected data
- cross-role secret-link misuse is rejected

## Key Risks and Mitigations

### 1. Live mentor updates
- **Risk:** truly real-time behavior can become over-engineered early.
- **Mitigation:** start with polling and only add push-based behavior if needed.

### 2. Secret-link misuse
- **Risk:** links could expose the wrong role or identity if routing is too loose.
- **Mitigation:** resolve identity server-side and scope every API by role and secret.

### 3. Data correction complexity
- **Risk:** edit, delete, and reassign behavior can create ambiguous record state.
- **Mitigation:** use a single current-state record model with explicit validation and last-write-wins semantics.

### 4. Duplicate-scan enforcement
- **Risk:** race conditions could allow two same-day scans.
- **Mitigation:** enforce a DB-level uniqueness constraint on student, mentor, and event-day.

## Definition of Done
- All P0 flows from the PRD are implemented.
- Student, mentor, and admin secret-link pages are isolated correctly.
- Duplicate same-day student→mentor scans are rejected.
- Mentor note entry works from live-updated page state.
- Admin can edit, delete, reassign, and export records.
- CSV export column order is exactly: `student name, secret id, mentor scanned, date, notes`.
- Relevant unit, integration, and e2e tests pass.

## Implementation Order Recommendation
Build in this order:
1. schema + seed + secret-link resolution
2. student scan flow
3. mentor live note flow
4. admin correction and export tools
5. hardening, QA, and polish

This sequence reduces risk by proving the data model and scan lifecycle before building correction tooling.
