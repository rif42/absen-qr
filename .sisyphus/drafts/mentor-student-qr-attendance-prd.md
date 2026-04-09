# Draft: Mentor Student QR Attendance PRD

## Problem Statement
The current attendance MVP is designed around attendee/admin check-in, but the target workflow now requires three operational roles: student, mentor, and admin. Students need a fast way to scan mentor QR codes and view their own same-day scan history, mentors need immediate note capture right after each student scan, and admins need a secure way to inspect, correct, and export the full transaction log. If this is not formalized, the product will likely ship with the wrong role model, incomplete auditability, and a workflow that does not match the real on-site mentoring process.

## Goals
- Support a complete single-event/day workflow for 5 mentors and 5 students using stable QR-linked identities.
- Let a student scan a mentor QR and see an accurate same-day history of mentors they scanned.
- Let a mentor keep a QR page open and receive immediate note-entry state when a student scan is recorded.
- Give admin a secure secret-link interface to view, export, and manually correct transaction records.
- Keep the v1 architecture simple enough to ship on Cloudflare Workers + D1 without introducing a heavier backend stack.

## Non-Goals
- No traditional login, password auth, sessions, or OAuth in v1; secret links are sufficient for the internal pilot.
- No multi-event or multi-day event management in v1; scope is one event/day only to keep data rules simple.
- No native mobile app; all student, mentor, and admin flows are web-based.
- No PDF report generation in v1; CSV export is sufficient and avoids backend/reporting complexity.
- No advanced analytics, notifications, or attendance scoring logic in v1; focus is scan logging, notes, correction, and reporting.

## Personas
### Student
- Opens a private secret link.
- Uses device camera to scan a mentor QR.
- Needs confirmation that the scan was recorded.
- Needs a same-day list of mentors already scanned.

### Mentor
- Opens a private secret link.
- Displays a stable QR image tied to their unique ID.
- Keeps their page open during the event.
- Needs immediate note entry when a student scans their QR.

### Admin
- Opens a private secret link.
- Needs visibility into all scan and note transactions.
- Needs CSV export.
- Needs manual correction powers for bad data.

## User Stories
### Student
- As a student, I want to open my secret page and scan a mentor QR so that my interaction is recorded without manual data entry.
- As a student, I want to see which mentors I have scanned today so that I do not accidentally repeat or miss a required mentor.
- As a student, I want clear feedback when a scan succeeds or fails so that I know whether I should retry.

### Mentor
- As a mentor, I want a persistent QR page with my stable QR code so that students can quickly scan me throughout the event.
- As a mentor, I want my page to update immediately when a student scans my QR so that I can enter notes while the interaction is still fresh.
- As a mentor, I want each note to stay linked to the correct student and scan event so that admin reporting remains accurate.

### Admin
- As an admin, I want to inspect the full transaction log so that I can audit what happened during the event.
- As an admin, I want to export the event data as CSV so that I can prepare follow-up reporting outside the app.
- As an admin, I want to correct bad records so that mistaken scans, wrong notes, or wrong pairings do not permanently damage the report.

## Requirements
### Must-Have (P0)
1. **Three role-specific secret-link entry points**
   - Student, mentor, and admin each have their own private URL.
   - For the pilot, each person has a stable unique ID tied to their QR identity.
   - Acceptance criteria:
     - [ ] Student pages are not interchangeable with mentor/admin pages.
     - [ ] Mentor pages resolve to one stable mentor identity and QR.
     - [ ] Admin page is protected by its own secret link.

2. **Student QR scan flow**
   - Student page can open the browser camera and scan a mentor QR code.
   - Scan records the student ID, mentor ID, and timestamp.
   - A student cannot record a duplicate scan for the same mentor on the same event/day.
   - Acceptance criteria:
     - [ ] Given a valid mentor QR, when the student scans it, then a scan record is created.
     - [ ] Given an invalid or unreadable QR, when the student scans it, then the page shows a clear error and records nothing.
     - [ ] Given a successful scan, when the operation completes, then the student sees a success confirmation.
     - [ ] Given the same student already scanned the same mentor on that event/day, when they scan again, then the system rejects the duplicate and shows a deterministic message.

3. **Student same-day history**
   - After scanning, the student sees only the mentors they scanned during that day/event.
   - Acceptance criteria:
     - [ ] History is filtered to the current event/day only.
     - [ ] The list shows mentor identity in a user-readable format.
     - [ ] A student never sees another student's history.

4. **Mentor QR display + immediate live note entry**
   - Mentor page displays that mentor's stable QR image.
   - When a student scans the mentor QR, the mentor page updates live and shows a textbox for notes tied to that student interaction.
   - Acceptance criteria:
     - [ ] Mentor page can remain open and continue showing the mentor QR.
     - [ ] Given a student scans the mentor QR, when the event is recorded, then the mentor page updates without manual refresh.
     - [ ] Given the mentor enters notes, when the note is saved, then it is linked to the correct student, mentor, and scan timestamp/record.

5. **Admin transaction log**
   - Admin can view all records created during the single event/day.
   - Records include student, mentor, timestamp, and mentor notes.
   - Acceptance criteria:
     - [ ] Admin view lists all scan transactions for the event/day.
     - [ ] Admin can inspect both successful scans and corrected records.
     - [ ] Admin view reflects note edits and reassignment/deletion history according to the chosen audit model.

6. **Admin CSV export**
   - Admin can export the event/day records as CSV.
   - Acceptance criteria:
     - [ ] Export columns appear in this exact order: student name, secret id, mentor scanned, date, notes.
     - [ ] Export reflects the latest corrected state of the data.

7. **Admin manual correction**
   - Admin can edit notes, delete incorrect records, and reassign a record to the correct student or mentor.
   - Correction behavior follows a last-write-wins model for the pilot.
   - Acceptance criteria:
     - [ ] Admin can update note text on an existing record.
     - [ ] Admin can delete an erroneous record.
     - [ ] Admin can reassign a record to another valid student or mentor identity.
     - [ ] Correction actions are visible in the admin interface and persist to storage.

8. **Stable identity model**
   - All 5 students and 5 mentors have unique, stable IDs mapped to their QR identity.
   - Acceptance criteria:
     - [ ] QR identity does not change between sessions for the same person.
     - [ ] Duplicate IDs are rejected by seed/setup logic.

### Nice-to-Have (P1)
1. Student-side explanation UI that helps the user understand why a duplicate same-day scan was rejected.
2. Mentor-side recent-student list below the live note textbox.
3. Admin filters by student or mentor name/ID.
4. Correction audit markers such as “edited”, “deleted”, or “reassigned”.

### Future Considerations (P2)
1. Multi-event support.
2. Rich authentication/authorization beyond secret links.
3. PDF report generation.
4. Notifications or reminders.
5. Analytics dashboards and trend reporting.

## Success Metrics
### Leading Indicators
- 100% of seeded mentors can open their QR page successfully during pilot setup.
- 95%+ of scan attempts result in a recorded transaction without admin intervention.
- 100% of successful student scans show same-day history updated within the same session.
- 100% of mentor notes entered immediately after scan are attached to the intended student record.
- Admin can export a complete CSV for the event/day with no missing required columns.

### Lagging Indicators
- Admin performs fewer than 10% manual corrections across total scan volume in the pilot.
- Pilot users report the web workflow is sufficient without requiring a native app or heavier backend.
- No architecture-driven blocker forces migration away from Cloudflare Workers during the pilot.

## Architecture Recommendation
- **Recommended v1 stack**: Cloudflare Workers + D1.
- **Why it fits**: the app needs secret-link pages, browser camera scanning, QR display, simple CRUD, same-day filtering, live note capture, and CSV export; all fit a lightweight Worker + D1 architecture.
- **Why not something heavier yet**: there is no current requirement for complex auth, heavy background jobs, large-scale analytics, or PDF rendering.
- **Revisit stack choice if**: the product expands into multi-event workflows, sophisticated role permissions, scheduled report generation, or heavy formatted reporting.

## Constraints and Assumptions
- Pilot size is 5 mentors and 5 students.
- Scope is one event/day only.
- Each person has a stable unique ID.
- Secret links are used instead of formal login.
- Mentor note entry happens on the mentor page via live update, not by handing the student device to the mentor.
- CSV is the only required export format in v1.
- Duplicate student→mentor scans on the same event/day are not allowed.
- Admin correction model is last-write-wins for the pilot.

## Open Questions

## Timeline Considerations
- This scope is still appropriate for a single v1 pilot if multi-event support stays out of scope.
- The highest-risk interaction is the live mentor-page update after student scan; this should be validated early in implementation.
- CSV export and correction tooling should be included in v1, not deferred, because they are part of the admin operating model.

## Research Findings
- `.sisyphus/plans/qr-attendance-website-mvp.md`: current repo planning baseline is Cloudflare Workers + D1 with secret-link access and browser QR flows.
- Repo currently contains planning artifacts only; there is no checked-in app implementation yet.
- Cloudflare Workers is sufficient for v1; the first likely architecture pressure point is advanced report generation rather than the scan/note workflow itself.
