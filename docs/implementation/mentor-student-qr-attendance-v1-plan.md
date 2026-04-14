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
4. Student page refreshes same-day history for the runtime UTC day derived from `scanned_at`.
5. Mentor page receives live update for the new student interaction on the runtime UTC day.
6. Mentor enters notes tied to that scan record.
7. Admin views, corrects, and exports final records.

These read-only history views use runtime-day visibility only; scan creation, duplicate prevention, and admin correction remain on existing event-day semantics.

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
  - returns current runtime UTC-day mentor scan history for the current student, filtered by `scanned_at`

### Mentor APIs
- `GET /api/mentor/me`
  - returns mentor identity and QR payload information
- `GET /api/mentor/recent-scans`
  - returns recent scan records for that mentor for live note-entry updates, filtered by the runtime UTC day via `scanned_at`
- `POST /api/mentor/notes/:scanId`
  - writes or updates notes for a scan record

Student history and mentor recent-scan visibility are runtime-day reads only; event-day writes, admin records, and correction semantics stay unchanged.

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
- render same-day mentor history for the runtime UTC day
- explain duplicate-scan rejection clearly

### Mentor Page
- resolve mentor identity from secret link
- display mentor QR code persistently
- poll for new scan activity
- surface the newest student interaction immediately for the runtime UTC day
- allow note entry and save state feedback

### Admin Page
- show all event-day records in table form
- support note edits
- support record deletion
- support reassigning student or mentor
- support CSV export

## Mobile-first Student Page Simplification

### Files to edit
- `public/student/index.html`
- `public/student/styles.css`
- `public/student/app.js` only if the DOM contract must change; default to leaving it untouched

### Intended visual hierarchy
1. Student identity + live status at the top
2. Scanner as the primary action block
3. Today’s mentor history as the secondary block

### Implementation shape
- Convert the student page to a single-column, mobile-first stack with full-width cards.
- Keep the scanner visually dominant, but reduce surrounding copy and spacing on small screens.
- Keep the history list visible below the scanner as the supporting “today” recap.
- Preserve the existing element IDs so the current student JS keeps working without behavior rewrites.

### Behavior must stay unchanged
- Do not change the student API contract in `src/worker/routes/student.ts`.
- Keep duplicate-scan rejection, same-day filtering, and error states exactly as they work today.
- Keep the existing student API coverage in `test/integration/student-api.test.ts` passing unchanged.

### Verification steps
- Run diagnostics on the edited files after the UI change.
- Run `test/integration/student-api.test.ts` to confirm scan/history behavior is unchanged.
- Manually check the page at a narrow mobile viewport and confirm: identity loads, scanner starts, duplicate rejection still appears, and today’s history still renders.

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
Phase 2 should be split into smaller sub-phases so each step has a clean manual test path and a natural commit boundary before moving to the next riskier behavior.

#### Phase 2A — Student route, identity, and empty-state shell
- implement the student secret-link page wiring
- implement `GET /api/student/me`
- render resolved student identity and an empty same-day history shell
- verify that student secret links do not resolve as mentor or admin pages

**Manual test focus**
- open a valid student secret link and confirm the correct student identity appears
- confirm the page loads an empty-state history when no scans exist yet
- confirm cross-role or malformed links are rejected

**Commit boundary**
- safe to commit once the student shell resolves identity correctly without any scan-write behavior yet

#### Phase 2B — Record creation without camera dependency
- implement `POST /api/student/scan`
- validate the scanned mentor identity payload on the server
- persist one scan record for a valid student→mentor interaction
- prove the end-to-end record creation path using a direct API request or temporary non-camera test input before browser camera work begins

**Manual test focus**
- submit one valid mentor payload and confirm exactly one record is written
- confirm invalid mentor payloads fail cleanly and write nothing
- verify the created row contains the expected student, mentor, and event-day fields

**Commit boundary**
- safe to commit once server-side scan creation is correct and manually testable without QR hardware or camera behavior

#### Phase 2C — Duplicate rejection and same-day history
- enforce duplicate same-day scan rejection through application handling on top of the DB uniqueness rule
- implement `GET /api/student/history`
- render same-day mentor history on the student page
- show deterministic duplicate-scan messaging

**Manual test focus**
- first valid student→mentor scan succeeds
- second same-day scan for the same student→mentor pair is rejected with a stable message
- student history shows only that student’s mentors for the current event-day

**Commit boundary**
- safe to commit once the student record lifecycle is correct for create, reject-duplicate, and read-history behavior

#### Phase 2D — Camera and QR integration
- integrate browser camera access on the student page
- decode mentor QR payloads and submit them through the already-verified scan endpoint
- handle unreadable or invalid QR results with clear feedback
- refresh success and error UI after real camera-driven scans

**Manual test focus**
- scan a real mentor QR from the browser and confirm the record is created
- confirm unreadable or invalid QR input shows a clear error
- confirm successful camera-driven scans update same-day history immediately

**Commit boundary**
- safe to commit once the camera path uses the existing verified APIs rather than introducing new record logic

**Phase 2 exit criteria**
- valid mentor scan creates one record
- duplicate same-day scan is rejected
- student history shows only that student’s current event-day mentors
- camera-based QR scanning works against the same server-side validation path

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
2. student flow in sub-phases: identity shell → record creation → duplicate/history → camera integration
3. mentor live note flow
4. admin correction and export tools
5. hardening, QA, and polish

This sequence reduces risk by proving the data model and scan lifecycle before building correction tooling.
