# Mentor-Student QR Attendance PRD (v1)

**Status:** Final  
**Scope:** Internal pilot / single event-day  
**Recommended stack:** Cloudflare Workers + D1

## Summary
This product supports a QR-driven mentoring attendance workflow with three roles: student, mentor, and admin. Students scan mentor QR codes and see their same-day mentor history, mentors keep a live QR page open and enter notes immediately after each student scan, and admins inspect, correct, and export the final event-day records.

This PRD defines the final v1 scope for the pilot and is intended to replace the earlier attendee/admin-only MVP framing.

## Problem Statement
The earlier attendance MVP was designed around a simpler attendee/admin check-in model, but the actual workflow requires three operational roles and richer record handling. Students need to record mentor interactions without manual entry, mentors need immediate note capture while the interaction is still fresh, and admins need a reliable way to review, correct, and export the final dataset.

Without this structure, the system risks shipping with the wrong user model, incomplete auditability, and a workflow that does not match real event operations.

## Goals
- Support a complete single event-day workflow for 5 mentors and 5 students using stable QR-linked identities.
- Let students scan mentor QR codes and immediately see an accurate same-day history of mentors scanned.
- Let mentors keep a QR page open and receive live note-entry state as soon as a student scan is recorded.
- Give admins a secure secret-link interface to view, export, edit, delete, and reassign records.
- Keep the v1 architecture simple enough to ship on Cloudflare Workers + D1.

## Non-Goals
- No traditional login, password auth, sessions, or OAuth in v1. Secret links are sufficient for the pilot.
- No multi-event or multi-day management in v1. Scope is one event-day only.
- No native mobile app. All flows are web-based.
- No PDF reporting in v1. CSV export is the required report format.
- No advanced analytics, notifications, or scoring logic in v1.

## Personas

### Student
- Opens a private secret link.
- Uses device camera to scan a mentor QR code.
- Needs immediate success or failure feedback.
- Needs a same-day list of mentors already scanned.

### Mentor
- Opens a private secret link.
- Displays a stable QR image tied to their identity.
- Keeps the page open during the event.
- Needs immediate note entry when a student scan is recorded.

### Admin
- Opens a private secret link.
- Needs visibility into all scan and note transactions.
- Needs CSV export.
- Needs manual correction controls.

## User Stories

### Student
- As a student, I want to scan a mentor QR code so that my interaction is recorded without manual typing.
- As a student, I want to see which mentors I scanned today so that I can track my progress for the event.
- As a student, I want clear feedback when a scan succeeds or fails so that I know whether to continue or retry.

### Mentor
- As a mentor, I want a persistent QR page with my stable QR code so that students can quickly scan me throughout the event.
- As a mentor, I want my page to update immediately when a student scans my QR so that I can capture notes while the interaction is still fresh.
- As a mentor, I want my notes tied to the correct student interaction so that reporting stays accurate.

### Admin
- As an admin, I want to inspect the full transaction log so that I can audit what happened during the event.
- As an admin, I want to export the event data as CSV so that I can use it in downstream reporting.
- As an admin, I want to correct bad records so that wrong notes or wrong pairings do not damage the final report.

## Requirements

### Must-Have (P0)

#### 1. Role-specific secret-link entry points
- Student, mentor, and admin each have separate private URLs.
- Each person has a stable unique identity for the pilot.

**Acceptance criteria**
- [ ] Student pages are not interchangeable with mentor or admin pages.
- [ ] Mentor pages resolve to one stable mentor identity and QR.
- [ ] Admin access is protected by its own secret link.

#### 2. Student QR scan flow
- Student page can open the browser camera and scan a mentor QR code.
- A successful scan records student identity, mentor identity, and timestamp.
- Duplicate student→mentor scans on the same event-day are not allowed.

**Acceptance criteria**
- [ ] Given a valid mentor QR, when a student scans it, then a scan record is created.
- [ ] Given an invalid or unreadable QR, when a student scans it, then the page shows a clear error and records nothing.
- [ ] Given a successful scan, when the operation completes, then the student sees a success confirmation.
- [ ] Given the same student already scanned the same mentor on the same event-day, when they scan again, then the system rejects the duplicate and shows a deterministic message.

#### 3. Student same-day history
- After scanning, the student sees only the mentors they scanned during the current event-day.

**Acceptance criteria**
- [ ] History is filtered to the current event-day only.
- [ ] The list shows mentor identity in a user-readable format.
- [ ] A student never sees another student's history.

#### 4. Mentor QR display and immediate live note entry
- Mentor page displays that mentor's stable QR image.
- When a student scans the mentor QR, the mentor page updates live and shows note entry for that student interaction.

**Acceptance criteria**
- [ ] Mentor page can remain open and continue showing the mentor QR.
- [ ] Given a student scans the mentor QR, when the event is recorded, then the mentor page updates without manual refresh.
- [ ] Given the mentor enters notes, when the note is saved, then it is linked to the correct student, mentor, and scan record.

#### 5. Admin transaction log
- Admin can view all records for the event-day.
- Records include student, mentor, date, and mentor notes.

**Acceptance criteria**
- [ ] Admin view lists all scan transactions for the event-day.
- [ ] Admin can inspect the latest state of successful and corrected records.

#### 6. Admin CSV export
- Admin can export the event-day records as CSV.
- CSV column order is fixed for v1.

**Acceptance criteria**
- [ ] Export columns appear in this exact order: student name, secret id, mentor scanned, date, notes.
- [ ] Export reflects the latest corrected state of the data.

#### 7. Admin manual correction
- Admin can edit notes, delete incorrect records, and reassign a record to the correct student or mentor.
- Correction behavior follows a last-write-wins model in v1.

**Acceptance criteria**
- [ ] Admin can update note text on an existing record.
- [ ] Admin can delete an erroneous record.
- [ ] Admin can reassign a record to another valid student or mentor identity.
- [ ] Correction actions persist to storage and are reflected in export output.

#### 8. Stable identity model
- All 5 students and 5 mentors have unique, stable IDs mapped to their QR identity.

**Acceptance criteria**
- [ ] QR identity does not change between sessions for the same person.
- [ ] Duplicate IDs are rejected by seed or setup logic.

### Nice-to-Have (P1)
- Student-side explanation UI that clearly explains duplicate-scan rejection.
- Mentor-side recent student list below the live note entry area.
- Admin filters by student or mentor name or ID.
- Correction status markers such as edited, deleted, or reassigned.

### Future Considerations (P2)
- Multi-event support.
- Rich authentication and authorization beyond secret links.
- PDF report generation.
- Notifications or reminders.
- Analytics dashboards and trend reporting.

## Success Metrics

### Leading Indicators
- 100% of seeded mentors can open their QR page during pilot setup.
- 95% or more of scan attempts result in a recorded transaction without admin intervention.
- 100% of successful student scans update same-day history within the same session.
- 100% of mentor notes entered immediately after scan are attached to the intended student record.
- Admin can export a complete CSV for the event-day with no missing required columns.

### Lagging Indicators
- Admin performs manual corrections on fewer than 10% of total records during the pilot.
- Pilot users report that the web workflow is sufficient without needing a native app or heavier backend.
- No architecture blocker forces migration away from Cloudflare Workers during the pilot.

## Architecture Recommendation
- **Recommended v1 stack:** Cloudflare Workers + D1.
- **Why it fits:** the app needs secret-link pages, browser camera scanning, QR display, simple CRUD, same-day filtering, live note capture, and CSV export.
- **Why not something heavier yet:** the current scope does not require complex auth, heavy background jobs, large-scale analytics, or formatted PDF rendering.
- **Revisit later if:** the product expands into multi-event workflows, sophisticated permissions, scheduled reporting, or heavyweight document generation.

## Constraints and Assumptions
- Pilot size is 5 mentors and 5 students.
- Scope is a single event-day.
- Each person has a stable unique ID.
- Secret links are used instead of formal login.
- Mentor note entry happens on the mentor page via live update, not by handing the student device to the mentor.
- Duplicate student→mentor scans on the same day are rejected.
- Admin correction behavior is last-write-wins.
- CSV is the only required export format in v1.

## Timeline Considerations
- This scope is appropriate for a single v1 pilot if multi-event support remains out of scope.
- The highest-risk interaction is the live mentor-page update after student scan and should be validated early.
- CSV export and correction tooling are part of the core admin workflow and should not be deferred.

## Open Questions
None for v1 at the time this document was finalized.
