# Runtime Current-Day History Filter

## TL;DR
> **Summary**: Change student history and mentor recent-scan history to use the actual current UTC date derived at runtime, with no new UI and no change to response shapes. Keep `EVENT_DATE` for event-scoped write/admin flows; only history visibility switches to runtime-today.
> **Deliverables**:
> - runtime UTC-date helper in the existing date service
> - student history filter changed from `event_date` to `scanned_at` UTC-day
> - mentor recent-scans filter changed from `event_date` to `scanned_at` UTC-day
> - mock D1 and integration tests updated for deterministic frozen-clock coverage
> - implementation-plan doc note aligned to the new history-only behavior
> **Effort**: Short
> **Parallel**: YES - 3 waves
> **Critical Path**: Task 1 → Tasks 2/3 → Task 4

## Context
### Original Request
Create a date filter on the student and mentor scan history, set it to current day, with no UI for the filter and code-only filtering.

### Interview Summary
- Repo docs already define student history as same-day and mentor recent scans as live same-day history.
- Exploration showed both routes already filter, but they currently use configured `EVENT_DATE`, not the actual runtime date.
- User chose **actual today** instead of keeping the existing `EVENT_DATE` behavior.
- No date-picker, query param, or UI control is in scope.

### Metis Review (gaps addressed)
- Resolved timezone ambiguity by fixing the authoritative date basis to **UTC**, derived from `new Date().toISOString().slice(0, 10)`.
- Avoided scope creep by changing **history visibility only**; duplicate-scan enforcement, admin records/export, and note-save ownership stay on existing event-day logic.
- Avoided hidden data inconsistency by filtering history on `scanned_at` UTC date instead of changing write-time `event_date` semantics.
- Required deterministic tests with a frozen clock so runtime-today assertions cannot flake.

## Work Objectives
### Core Objective
Make the student `/api/history` and mentor `/api/recent-scans` endpoints return only records whose `scanned_at` falls on the current UTC calendar day at runtime, without adding UI and without changing payload contracts.

### Deliverables
- Updated shared date helper in `src/worker/services/event-day.ts`
- Updated history read queries in `src/worker/db/scan-records.ts`
- Updated route call sites in `src/worker/routes/student.ts` and `src/worker/routes/mentor.ts`
- Updated mock query behavior in `test/support/mock-d1.ts`
- Updated deterministic integration coverage in `test/integration/student-api.test.ts` and `test/integration/mentor-api.test.ts`
- Updated technical note in `docs/implementation/mentor-student-qr-attendance-v1-plan.md`

### Definition of Done (verifiable conditions with commands)
- `rtk npx vitest run test/integration/student-api.test.ts` passes, including runtime-current-day history assertions.
- `rtk npx vitest run test/integration/mentor-api.test.ts` passes, including runtime-current-day recent-scan assertions.
- `rtk npx vitest run test/integration/student-page-dom.test.ts test/integration/mentor-page-dom.test.ts` passes without DOM contract updates.
- `rtk npm run typecheck` passes.
- `rtk npx vitest run test/integration/student-api.test.ts test/integration/mentor-api.test.ts -t "runtime UTC day"` passes with `EVENT_DATE` intentionally mismatched from the frozen current day.

### Must Have
- Runtime current day is defined once as **UTC `YYYY-MM-DD`**.
- Student history and mentor recent scans must filter by `scanned_at`, not `event_date`.
- Existing endpoint paths and JSON keys stay unchanged.
- Tests freeze system time and prove the history endpoints ignore mismatched `EVENT_DATE` values.
- Docs note that this is a history-only runtime-day behavior change.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- No date filter UI, URL param, or browser-side filter control.
- No change to `POST /student/:secret/api/scan` write-time `event_date` behavior.
- No change to duplicate-scan enforcement, admin record queries, CSV export, or mentor note-save ownership rules.
- No use of local browser timezone, locale formatting, or `Date.prototype.toLocaleDateString()` for filtering.
- No broad rename/refactor of all “event-day” terminology across the repo.

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed.
- Test decision: **TDD** with Vitest integration tests plus targeted DOM/type regressions.
- QA policy: Every task includes one happy-path and one edge/failure scenario.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy
### Parallel Execution Waves
Wave 1: Task 1 (shared date-source + query semantics foundation)

Wave 2: Task 2 (student history path) + Task 3 (mentor recent-scans path) in parallel

Wave 3: Task 4 (docs alignment + consolidated regression sweep)

### Dependency Matrix (full, all tasks)
| Task | Depends On | Blocks |
|---|---|---|
| 1 | none | 2, 3 |
| 2 | 1 | 4 |
| 3 | 1 | 4 |
| 4 | 2, 3 | F1-F4 |

### Agent Dispatch Summary (wave → task count → categories)
- Wave 1 → 1 task → `quick`
- Wave 2 → 2 tasks → `quick`, `quick`
- Wave 3 → 1 task → `writing`

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [x] 1. Introduce the runtime UTC-day history filter foundation

  **What to do**:
  - Extend `src/worker/services/event-day.ts` with a new exported helper named `getCurrentUtcDate(now: Date = new Date()): string`.
  - Implement the helper as `now.toISOString().slice(0, 10)` and validate the result with `isEventDate` before returning.
  - Keep `getConfiguredEventDate(env)` unchanged for admin/event-scoped flows.
  - In `src/worker/db/scan-records.ts`, change only `listStudentHistory` and `listMentorRecentScans` to filter by `substr(scanned_at, 1, 10) = ?2` instead of `event_date = ?2`.
  - Rename the second parameter in both functions from `eventDate` to `utcDate` to prevent future misuse.
  - In `test/support/mock-d1.ts`, update the matching query branches so the mock mirrors the new `substr(scanned_at, 1, 10)` semantics using `scanRecord.scanned_at.slice(0, 10)`.

  **Must NOT do**:
  - Do not change `createScanRecord`, `ScanRecord.event_date`, or the unique constraint semantics.
  - Do not touch admin-record queries.
  - Do not create a new date service file; keep the new helper in the existing `event-day.ts` module.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: single shared foundation touching one helper, one DB module, and one mock.
  - Skills: [`test-driven-development`] - lock the new query semantics with failing tests before the production edits.
  - Omitted: [`frontend-design`] - no UI work is required.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 2, 3 | Blocked By: none

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `src/worker/services/event-day.ts:1-10` - existing configured-date helper; add the runtime UTC-day helper beside it.
  - Pattern: `src/worker/db/scan-records.ts:61-98` - only the two history-read queries should switch from `event_date` filtering to `scanned_at` UTC-day filtering.
  - Test double: `test/support/mock-d1.ts:299-319` - current mock branches mirror `event_date`; update these branches to mirror the new history query logic.
  - API/Type: `src/worker/types.ts:35-42` - `scanned_at` is already stored as an ISO timestamp and is the canonical field for runtime-day filtering.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `rtk npm run typecheck` passes after adding `getCurrentUtcDate` and updating shared function signatures.
  - [ ] `rtk npx vitest run test/integration/student-api.test.ts test/integration/mentor-api.test.ts` passes once the new shared query semantics are wired through the mock.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Shared query layer accepts runtime UTC-day filtering
    Tool: Bash
    Steps: Run `rtk npm run typecheck`
    Expected: TypeScript succeeds with no signature or import errors after the new helper and query parameter rename.
    Evidence: .sisyphus/evidence/task-1-runtime-day-foundation.txt

  Scenario: Mock D1 mirrors scanned_at-day filtering instead of event_date filtering
    Tool: Bash
    Steps: Run `rtk npx vitest run test/integration/student-api.test.ts test/integration/mentor-api.test.ts`
    Expected: No mock-D1 unsupported-SQL errors; both suites execute against the updated history-query semantics.
    Evidence: .sisyphus/evidence/task-1-runtime-day-foundation-tests.txt
  ```

  **Commit**: NO | Message: `fix(history): add runtime UTC-day query foundation` | Files: `src/worker/services/event-day.ts`, `src/worker/db/scan-records.ts`, `test/support/mock-d1.ts`

- [x] 2. Switch student history to runtime current UTC day

  **What to do**:
  - In `src/worker/routes/student.ts`, change only the `/history` branch to use `getCurrentUtcDate()` instead of `getConfiguredEventDate(env)`.
  - Keep `/scan` on `getConfiguredEventDate(env)` so write-side event scoping and duplicate prevention stay unchanged.
  - Do not change the `/history` response payload shape or the student page fetch path.
  - In `test/integration/student-api.test.ts`, import `beforeEach`, `afterEach`, and `vi` from Vitest.
  - Freeze the clock to `2026-01-15T12:00:00.000Z` in the history-focused tests.
  - Refactor the local `createEnv` helper to allow an `EVENT_DATE` override per test, then set `EVENT_DATE` to `2026-01-14` in the runtime-day history assertions so the test proves the endpoint ignores configured event day.
  - Rename the main history test to `returns only the current student's mentor history for the current runtime UTC day`.
  - Add a second history regression named `returns an empty history when the student only has non-today scans`.

  **Must NOT do**:
  - Do not alter duplicate-scan wording or behavior.
  - Do not edit `public/student/index.html` or `public/student/styles.css`.
  - Do not remove `eventDate` from scan-create responses.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: one route, one integration file, no UI mutation.
  - Skills: [`test-driven-development`] - make the new history behavior fail first under a frozen clock.
  - Omitted: [`frontend-design`] - the student DOM contract must stay stable.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 4 | Blocked By: 1

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `src/worker/routes/student.ts:128-162` - only this `/history` branch should swap date source; leave `/scan` at `src/worker/routes/student.ts:42-105` unchanged.
  - Pattern: `public/student/app.js:98-117` - frontend already fetches `/api/history`; no contract change is needed.
  - Pattern: `public/student/app.js:171-209` - current copy already talks about “today”; keep it unchanged.
  - Test: `test/integration/student-api.test.ts:22-29` - current env helper hardcodes `EVENT_DATE`; make it overridable per test.
  - Test: `test/integration/student-api.test.ts:190-257` - existing history regression is the primary place to flip from configured event-day assertions to runtime UTC-day assertions.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `rtk npx vitest run test/integration/student-api.test.ts` passes with the renamed runtime-day history test and the new empty-history edge case.
  - [ ] `rtk npx vitest run test/integration/student-page-dom.test.ts` passes unchanged.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Student history returns only scans from the frozen current UTC day
    Tool: Bash
    Steps: Run `rtk npx vitest run test/integration/student-api.test.ts -t "returns only the current student's mentor history for the current runtime UTC day"`
    Expected: The test passes while `EVENT_DATE` is intentionally set to `2026-01-14` and only `scanned_at` entries on `2026-01-15` are returned.
    Evidence: .sisyphus/evidence/task-2-student-history.txt

  Scenario: Student history stays empty when only historical scans exist
    Tool: Bash
    Steps: Run `rtk npx vitest run test/integration/student-api.test.ts -t "returns an empty history when the student only has non-today scans"`
    Expected: The test passes and the endpoint returns `history: []` instead of leaking records from another day or the configured event day.
    Evidence: .sisyphus/evidence/task-2-student-history-empty.txt
  ```

  **Commit**: NO | Message: `fix(student): use runtime UTC day for history` | Files: `src/worker/routes/student.ts`, `test/integration/student-api.test.ts`

- [x] 3. Switch mentor recent scans to runtime current UTC day

  **What to do**:
  - In `src/worker/routes/mentor.ts`, change only the `/recent-scans` branch to use `getCurrentUtcDate()` instead of `getConfiguredEventDate(env)`.
  - Keep `/me` and `/notes/:scanId` unchanged.
  - Preserve the `recentScans` payload structure and ordering.
  - In `test/integration/mentor-api.test.ts`, import `beforeEach`, `afterEach`, and `vi` from Vitest.
  - Freeze the clock to `2026-01-15T12:00:00.000Z` in the recent-scan tests.
  - Refactor the mentor test `createEnv` helper to allow an `EVENT_DATE` override and set it to `2026-01-14` in the runtime-day recent-scan assertions.
  - Rename the main recent-scan test to `returns mentor recent scans for the current runtime UTC day with student names newest first`.
  - Add a second regression named `returns an empty recent scan list when the mentor only has non-today scans`.

  **Must NOT do**:
  - Do not change mentor polling cadence in `public/mentor/app.js`.
  - Do not change note-saving logic or ownership checks.
  - Do not add any client-side date filtering.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: one route, one integration file, contract-preserving API change.
  - Skills: [`test-driven-development`] - recent-scan regressions should drive the server change.
  - Omitted: [`frontend-design`] - mentor UI layout/copy stays as-is.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 4 | Blocked By: 1

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `src/worker/routes/mentor.ts:42-76` - only the `/recent-scans` branch should swap to runtime UTC date; leave `src/worker/routes/mentor.ts:18-40` and `79-135` unchanged.
  - Pattern: `public/mentor/app.js:139-175` - frontend already fetches `/api/recent-scans` and sorts by `scannedAt`; no contract change is needed.
  - Pattern: `public/mentor/app.js:184-191` - polling interval remains `10_000` ms.
  - Test: `test/integration/mentor-api.test.ts:22-29` - current env helper hardcodes `EVENT_DATE`; make it overridable per test.
  - Test: `test/integration/mentor-api.test.ts:69-136` - existing recent-scan regression is the primary runtime-day test anchor.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `rtk npx vitest run test/integration/mentor-api.test.ts` passes with the renamed runtime-day recent-scan test and the new empty-list edge case.
  - [ ] `rtk npx vitest run test/integration/mentor-page-dom.test.ts` passes unchanged.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Mentor recent scans returns only scans from the frozen current UTC day
    Tool: Bash
    Steps: Run `rtk npx vitest run test/integration/mentor-api.test.ts -t "returns mentor recent scans for the current runtime UTC day with student names newest first"`
    Expected: The test passes while `EVENT_DATE` is intentionally set to `2026-01-14` and only scans whose `scanned_at` date is `2026-01-15` are returned newest first.
    Evidence: .sisyphus/evidence/task-3-mentor-history.txt

  Scenario: Mentor recent scans stays empty when only historical scans exist
    Tool: Bash
    Steps: Run `rtk npx vitest run test/integration/mentor-api.test.ts -t "returns an empty recent scan list when the mentor only has non-today scans"`
    Expected: The test passes and the endpoint returns `recentScans: []` without leaking records from another day or the configured event day.
    Evidence: .sisyphus/evidence/task-3-mentor-history-empty.txt
  ```

  **Commit**: NO | Message: `fix(mentor): use runtime UTC day for recent scans` | Files: `src/worker/routes/mentor.ts`, `test/integration/mentor-api.test.ts`

- [x] 4. Align the technical plan note and run the consolidated regressions

  **What to do**:
  - Update `docs/implementation/mentor-student-qr-attendance-v1-plan.md` so the student history and mentor recent-scan descriptions explicitly state that history visibility is determined from the runtime current UTC day via `scanned_at`, while existing event-day/admin semantics stay unchanged.
  - Do not edit the PRD unless the implementation-plan wording cannot be made consistent without it.
  - Run the full targeted regression set after Tasks 2 and 3 are complete.
  - Keep this task as the point where the branch becomes commit-ready.

  **Must NOT do**:
  - Do not expand the doc change into multi-day product scope.
  - Do not update README, admin docs, or CSV specs unless the implementation-plan note alone is insufficient.

  **Recommended Agent Profile**:
  - Category: `writing` - Reason: one technical doc note plus a final regression sweep.
  - Skills: [] - no additional skill is required beyond following the approved technical decisions.
  - Omitted: [`write-spec`] - this is a targeted plan/doc alignment, not a new PRD.

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: F1-F4 | Blocked By: 2, 3

  **References** (executor has NO interview context - be exhaustive):
  - Doc: `docs/implementation/mentor-student-qr-attendance-v1-plan.md:30-45` - high-level flow and real-time section currently assume event-day framing.
  - Doc: `docs/implementation/mentor-student-qr-attendance-v1-plan.md:109-124` - API surface entries for student history and mentor recent scans need the runtime-day note.
  - Commands: `package.json:6-15` - canonical scripts for `typecheck` and general test execution.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `rtk npx vitest run test/integration/student-api.test.ts test/integration/mentor-api.test.ts test/integration/student-page-dom.test.ts test/integration/mentor-page-dom.test.ts` passes.
  - [ ] `rtk npm run typecheck` passes after the documentation and code changes are complete.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Final targeted regression sweep passes without UI contract drift
    Tool: Bash
    Steps: Run `rtk npx vitest run test/integration/student-api.test.ts test/integration/mentor-api.test.ts test/integration/student-page-dom.test.ts test/integration/mentor-page-dom.test.ts`
    Expected: All four suites pass; no student or mentor DOM expectations need updating.
    Evidence: .sisyphus/evidence/task-4-final-regressions.txt

  Scenario: History behavior is documented without expanding scope
    Tool: Bash
    Steps: Run `rtk npm run typecheck`
    Expected: Typecheck still passes after the implementation-plan note is updated; no code changes were introduced by the doc alignment step.
    Evidence: .sisyphus/evidence/task-4-typecheck.txt
  ```

  **Commit**: YES | Message: `fix(history): use runtime current UTC day for student and mentor history` | Files: `src/worker/services/event-day.ts`, `src/worker/db/scan-records.ts`, `src/worker/routes/student.ts`, `src/worker/routes/mentor.ts`, `test/support/mock-d1.ts`, `test/integration/student-api.test.ts`, `test/integration/mentor-api.test.ts`, `docs/implementation/mentor-student-qr-attendance-v1-plan.md`

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [x] F1. Plan Compliance Audit — oracle
- [x] F2. Code Quality Review — unspecified-high
- [x] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [x] F4. Scope Fidelity Check — deep

## Commit Strategy
- Development flow: TDD internally in this order — red tests, minimal green implementation, targeted regression sweep.
- Shipping flow: one final atomic commit after Task 4.
- Final commit message: `fix(history): use runtime current UTC day for student and mentor history`

## Success Criteria
- Student history ignores mismatched `EVENT_DATE` and returns only records whose `scanned_at` date matches the frozen/runtime UTC day.
- Mentor recent scans ignores mismatched `EVENT_DATE` and returns only records whose `scanned_at` date matches the frozen/runtime UTC day.
- Student and mentor JSON payload shapes remain unchanged.
- No date-filter UI or client-side date selection is introduced.
- Duplicate-scan, admin, CSV, and note-save behaviors remain unchanged.
- Targeted integration, DOM, and typecheck regressions all pass.
