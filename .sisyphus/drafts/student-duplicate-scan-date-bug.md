# Draft: Student Duplicate Scan Date Bug

## Requirements (confirmed)
- investigate why student 01 scanning mentor 01 shows "you have scanned this mentor today" even though the prior scan was last week
- determine whether the right fix is logic change, configuration/data correction, or database reset
- plan should cover code + tests + docs

## Technical Decisions
- treat this as a planning task for a bug fix, not direct execution
- verify behavior against project docs before recommending reset or code changes
- chosen fix direction: change duplicate prevention from fixed event-day semantics to real calendar-day semantics
- chosen scope depth: broader alignment across duplicate logic, admin/reporting semantics, and docs

## Research Findings
- docs lock v1 constraints around single event-day, duplicate scans rejected, and current/runtime-day visibility nuances
- duplicate rejection is implemented in `src/worker/routes/student.ts` using `getConfiguredEventDate(env)` and `findStudentMentorScanRecordByEventDate(...)`
- uniqueness is enforced at schema level in `migrations/0001_initial_schema.sql` on `(student_id, mentor_id, event_date)`
- student history and mentor recent-scan reads use runtime UTC day via `scanned_at`, creating a wording/semantics split with duplicate prevention
- `test/integration/student-api.test.ts` explicitly covers the current behavior: duplicate rejection still triggers even when the prior record was scanned on a different runtime day, as long as `event_date` matches
- `wrangler.jsonc` config sets a fixed `EVENT_DATE`, so repeated use across weeks can still collide if records keep the same stored event date

## Open Questions
- preferred test strategy for implementing the semantic change across routes, persistence, and docs

## Scope Boundaries
- INCLUDE: root-cause analysis, recommendation on fix path, documentation alignment
- EXCLUDE: implementing code changes outside planning artifacts
