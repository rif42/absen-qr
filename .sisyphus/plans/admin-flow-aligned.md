# Admin Flow Aligned Plan

## TL;DR
> **Summary**: Add the Phase 4 admin workflow to the existing student+mentor implementation without changing their contracts. The work fills the current scaffold gap with admin read/export/correction/delete APIs, a simple admin page, Vitest-first coverage, and a new Playwright admin E2E harness.
> **Deliverables**:
> - Admin DB helper layer aligned to current D1 patterns
> - Admin APIs for records, CSV export, PATCH correction, and DELETE
> - Admin page shell + runtime JS under `public/admin/`
> - Admin DOM-contract, integration, and browser E2E coverage
> **Effort**: Medium
> **Parallel**: YES - 3 waves
> **Critical Path**: 1 → 3 → 4/5/6/7 → 8 → 9

## Context
### Original Request
"do the admin flow. check the plan, ensure it align with current status of codebase"

### Interview Summary
- `docs/` is the source of truth, especially `docs/prd/mentor-student-qr-attendance-v1.md` and `docs/implementation/mentor-student-qr-attendance-v1-plan.md`.
- Student Flow is already implemented in `src/worker/routes/student.ts`, `public/student/*`, and `test/integration/student-api.test.ts`.
- Mentor Flow is already implemented in `src/worker/routes/mentor.ts`, `public/mentor/*`, and `test/integration/mentor-api.test.ts`.
- Admin Flow is scaffold-only today: `src/worker/routes/admin.ts` returns placeholder/not-implemented responses and `public/admin/index.html` is still a placeholder shell.
- Existing code patterns to preserve: `src/worker/index.ts` routing, `src/worker/services/secret-links.ts` role isolation, `src/worker/services/http.ts` JSON/error conventions, and D1 query style in `src/worker/db/people.ts` + `src/worker/db/scan-records.ts`.
- Test decisions locked during interview: **TDD in Vitest** and **add browser E2E in Phase 4**.

### Metis Review (gaps addressed)
- Added a prerequisite task to extend `test/support/mock-d1.ts` before admin TDD begins.
- Locked admin scope to P0 only: records list, CSV export, note edit, reassignment, delete, admin UI, Vitest coverage, and Playwright coverage.
- Avoided endpoint sprawl by embedding valid student/mentor option lists directly in `GET /admin/:secret/api/records`.
- Locked correction semantics: PATCH accepts partial updates for `notes`, `studentId`, and `mentorId`; duplicate reassignment conflicts return `409` with a deterministic message.
- Locked export semantics: exact header `student name,secret id,mentor scanned,date,notes`; `date` maps to `event_date`; CSV rows sort chronologically ascending.
- Locked deletion semantics to **hard delete** with JSON success response.

## Work Objectives
### Core Objective
Implement the v1 Admin Flow required by the PRD on top of the already-working student and mentor flows, using the repo’s current Worker, D1, and Vitest patterns.

### Deliverables
- `src/worker/db/admin-records.ts`
- `src/worker/routes/admin.ts` fully implemented for P0 admin APIs
- `public/admin/index.html` upgraded from placeholder to stable admin shell
- `public/admin/app.js`
- `test/unit/mock-d1-admin.test.ts`
- `test/integration/admin-page-dom.test.ts`
- `test/integration/admin-api.test.ts`
- `test/integration/admin-page-app.test.ts`
- `playwright.config.ts`, `test/e2e/admin-flow.spec.ts`, and deterministic E2E seed/setup support
- `package.json` scripts for browser E2E

### Definition of Done (verifiable conditions with commands)
- `rtk npm test -- test/unit/mock-d1-admin.test.ts` exits with code 0.
- `rtk npm test -- test/integration/admin-page-dom.test.ts` exits with code 0.
- `rtk npm test -- test/integration/admin-api.test.ts` exits with code 0.
- `rtk npm test -- test/integration/admin-page-app.test.ts` exits with code 0.
- `rtk npx playwright test test/e2e/admin-flow.spec.ts` exits with code 0.
- `rtk npm run typecheck` exits with code 0.

### Must Have
- Preserve `ADMIN_SECRET`-based admin authorization; do not seed admin into `people`.
- Keep student and mentor route/page contracts unchanged unless a shared refactor is strictly required for admin support.
- Implement `GET /admin/:secret/api/records` returning current-day records plus valid `students[]` and `mentors[]` lookup arrays.
- Implement `GET /admin/:secret/api/export.csv` with exact CSV header order: `student name,secret id,mentor scanned,date,notes`.
- Implement `PATCH /admin/:secret/api/records/:scanId` for note edit and student/mentor reassignment with last-write-wins behavior.
- Implement `DELETE /admin/:secret/api/records/:scanId` as hard delete.
- Follow current JSON/error/status conventions from `src/worker/services/http.ts`.
- Add admin DOM-contract tests before runtime JS wiring.
- Add Playwright-based admin browser coverage in Phase 4.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- No filters, status markers, pagination, bulk actions, counters, or audit history.
- No soft delete.
- No extra admin lookup endpoint; use embedded lookup arrays in the records payload.
- No multi-event or multi-day support.
- No auth/session redesign.
- No changes to CSV column order.
- No changes to duplicate-scan rules outside admin conflict handling for reassignment.

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed.
- Test decision: **TDD in Vitest first**, then browser verification with **Playwright**.
- QA policy: Every task includes agent-executed happy-path and failure-path scenarios.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Shared foundations are extracted first so API slices can run in parallel.

Wave 1: 1 test-harness foundation, 2 admin DOM contract, 3 admin data-layer foundation

Wave 2: 4 records read API, 5 CSV export API, 6 PATCH correction API, 7 DELETE API

Wave 3: 8 admin UI wiring, 9 Playwright admin E2E harness

### Dependency Matrix (full, all tasks)
| Task | Depends On | Blocks |
|---|---|---|
| 1 | None | 3,4,5,6,7,8,9 |
| 2 | None | 8,9 |
| 3 | 1 | 4,5,6,7,8,9 |
| 4 | 1,3 | 8,9 |
| 5 | 1,3 | 8,9 |
| 6 | 1,3 | 8,9 |
| 7 | 1,3 | 8,9 |
| 8 | 2,4,5,6,7 | 9 |
| 9 | 2,4,5,6,7,8 | F1-F4 |

### Agent Dispatch Summary (wave → task count → categories)
- Wave 1 → 3 tasks → `unspecified-high`, `visual-engineering`
- Wave 2 → 4 tasks → `unspecified-high`, `quick`
- Wave 3 → 2 tasks → `visual-engineering`, `unspecified-high`
- Final Verification → 4 tasks → `oracle`, `unspecified-high`, `deep`

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [x] 1. Extend the admin test harness before touching production code

  **What to do**:
  - Expand `test/support/mock-d1.ts` so it can execute the exact SQL/query shapes needed by planned admin list, export, patch, and delete flows.
  - Add `test/unit/mock-d1-admin.test.ts` covering joined admin record rows, ordered results, record updates, duplicate-conflict simulation, and hard deletion.
  - Seed the harness with representative data that matches v1 constraints: two students, two mentors, one duplicate-conflict candidate, one deletable record.
  - Keep this task test-only plus harness support; no changes to `src/worker/routes/admin.ts` yet.

  **Must NOT do**:
  - Do not implement admin route behavior in this task.
  - Do not change student or mentor tests.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: harness fidelity controls all downstream admin TDD.
  - Skills: [`test-driven-development`] - failing admin harness tests must land first.
  - Omitted: [`frontend-design`] - no UI work here.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 3,4,5,6,7,8,9 | Blocked By: none

  **References**:
  - Pattern: `test/support/mock-d1.ts:1-245` - existing in-memory D1 behavior that must be extended, not replaced.
  - Pattern: `test/integration/student-api.test.ts` - current Worker+mock-D1 integration style to preserve.
  - Pattern: `test/integration/mentor-api.test.ts` - current mutation/assertion style to preserve.
  - API/Type: `migrations/0001_initial_schema.sql` - uniqueness on `(student_id, mentor_id, event_date)` must remain representable in tests.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `rtk npm test -- test/unit/mock-d1-admin.test.ts` passes.
  - [ ] The harness can simulate a uniqueness-conflict update for admin reassignment without touching production code.
  - [ ] Existing `rtk npm test -- test/integration/student-api.test.ts` still passes unchanged.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Admin mock D1 supports planned query shapes
    Tool: Bash
    Steps: Run `rtk npm test -- test/unit/mock-d1-admin.test.ts`
    Expected: Exit code 0; tests cover list ordering, patch updates, duplicate conflict, and delete behavior
    Evidence: .sisyphus/evidence/task-1-mock-d1-admin.txt

  Scenario: Harness change does not regress existing role tests
    Tool: Bash
    Steps: Run `rtk npm test -- test/integration/student-api.test.ts`
    Expected: Exit code 0; existing student integration coverage remains green
    Evidence: .sisyphus/evidence/task-1-student-regression.txt
  ```

  **Commit**: YES | Message: `test(admin): extend mock d1 for admin flows` | Files: `test/support/mock-d1.ts`, `test/unit/mock-d1-admin.test.ts`

- [x] 2. Lock the admin DOM contract and replace the placeholder shell

  **What to do**:
  - Replace `public/admin/index.html` placeholder copy with a stable admin shell that matches current page-testing conventions.
  - Add `test/integration/admin-page-dom.test.ts` first and make it fail before editing the page.
  - Lock these static hooks exactly:
    - `h1#page-title`
    - `div#status-banner`
    - `section#controls-card` containing `button#export-csv-button`
    - `section#records-card`
    - `div#records-loading`
    - `p#records-empty-state`
    - `table#records-table`
    - `tbody#records-table-body`
  - Keep the page simple: heading, export control, records table area. No filters, counters, or status chips.

  **Must NOT do**:
  - Do not add admin runtime behavior in this task.
  - Do not add any P1 UI features.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - Reason: this is a stable HTML shell + DOM-contract task.
  - Skills: [`test-driven-development`] - DOM contract test must fail before HTML changes.
  - Omitted: [`frontend-design`] - keep the page intentionally simple, not decorative.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 8,9 | Blocked By: none

  **References**:
  - Pattern: `public/admin/index.html:1-15` - existing placeholder to replace.
  - Pattern: `test/integration/student-page-dom.test.ts:4-54` - DOM contract style to mirror.
  - Pattern: `test/integration/mentor-page-dom.test.ts:4-46` - stable page hook/testing pattern to mirror.
  - Pattern: `public/student/index.html` - existing semantic section/card structure.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `rtk npm test -- test/integration/admin-page-dom.test.ts` passes.
  - [ ] `public/admin/index.html` contains every locked hook listed above exactly once.
  - [ ] Existing `rtk npm test -- test/integration/worker-smoke.test.ts` still passes.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Admin page shell matches locked contract
    Tool: Bash
    Steps: Run `rtk npm test -- test/integration/admin-page-dom.test.ts`
    Expected: Exit code 0; test asserts the required IDs and section order
    Evidence: .sisyphus/evidence/task-2-admin-dom.txt

  Scenario: Secret-route page serving still works
    Tool: Bash
    Steps: Run `rtk npm test -- test/integration/worker-smoke.test.ts`
    Expected: Exit code 0; admin secret route still serves the admin asset shell
    Evidence: .sisyphus/evidence/task-2-worker-smoke.txt
  ```

  **Commit**: YES | Message: `test(admin): lock admin page contract` | Files: `public/admin/index.html`, `test/integration/admin-page-dom.test.ts`

- [x] 3. Add a dedicated admin data layer and shared response contract

  **What to do**:
  - Create `src/worker/db/admin-records.ts` instead of overloading `scan-records.ts`.
  - Add helper functions for:
    - listing current event-day records for the admin table ordered by `scanned_at DESC, scan_id DESC`
    - listing valid student options ordered by `display_name ASC`
    - listing valid mentor options ordered by `display_name ASC`
    - fetching a single record by `scan_id`
    - exporting current event-day rows ordered by `scanned_at ASC, scan_id ASC`
  - Lock the `GET /admin/:secret/api/records` response shape to:
    - `eventDate: string`
    - `records: Array<{ scanId, studentId, studentName, studentSecretId, mentorId, mentorName, eventDate, scannedAt, notes, updatedAt }>`
    - `students: Array<{ personId, displayName }>`
    - `mentors: Array<{ personId, displayName }>`
  - Reuse `people.ts` for role validation lookups, but keep admin-specific joined record queries in the new file.

  **Must NOT do**:
  - Do not add a separate `/people` lookup endpoint for admin.
  - Do not expose student or mentor secret path tokens in admin payloads.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: the helper contracts determine all downstream route/UI behavior.
  - Skills: [`test-driven-development`] - add failing unit or route-level contract tests before helper implementation.
  - Omitted: [`playwright`] - not needed for DB/helper design.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 4,5,6,7,8,9 | Blocked By: 1

  **References**:
  - Pattern: `src/worker/db/people.ts:3-60` - role-scoped lookup style to follow.
  - Pattern: `src/worker/db/scan-records.ts:11-150` - current D1 query/helper style to follow.
  - Pattern: `docs/prd/mentor-student-qr-attendance-v1.md:109-133` - locked admin list/correction/export scope.
  - Pattern: `docs/prd/mentor-student-qr-attendance-v1.md:121-123` - exact CSV header order constraint.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `rtk npm test -- test/unit/mock-d1-admin.test.ts` passes with the new helper query shapes.
  - [ ] A failing contract test is added first for the `GET /admin/:secret/api/records` response shape, then made green.
  - [ ] The new helper file becomes the only place for admin joined-record queries.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Admin data helpers return deterministic table payloads
    Tool: Bash
    Steps: Run `rtk npm test -- test/unit/mock-d1-admin.test.ts`
    Expected: Exit code 0; records sort newest-first, students/mentors sort alphabetically, and payload fields match the locked contract
    Evidence: .sisyphus/evidence/task-3-admin-data-layer.txt

  Scenario: No endpoint sprawl introduced
    Tool: Bash
    Steps: Run `rtk grep "/admin/.*/api" src/worker/routes/admin.ts`
    Expected: Output contains only the planned records, export, patch, and delete admin endpoints
    Evidence: .sisyphus/evidence/task-3-admin-routes.txt
  ```

  **Commit**: YES | Message: `feat(admin): add admin data helpers` | Files: `src/worker/db/admin-records.ts`, related tests only

- [x] 4. Implement the admin records read API

  **What to do**:
  - Replace the `notImplemented` branch for `GET /admin/:secret/api/records` in `src/worker/routes/admin.ts`.
  - Authorize with the existing `ADMIN_SECRET` check exactly as current admin routing does.
  - Return `200` JSON using the locked payload from Task 3.
  - Preserve current error conventions:
    - bad admin secret → `403`
    - unsupported method on the same path → `405` with exact `allowed`
  - Keep the route read-only; do not mix export or mutation logic into this handler.

  **Must NOT do**:
  - Do not add response fields beyond the locked payload.
  - Do not return student/mentor secret-path tokens.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: this is a focused route implementation once the data layer is locked.
  - Skills: [`test-driven-development`] - integration test must fail before the route is implemented.
  - Omitted: [`playwright`] - API-only slice.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 8,9 | Blocked By: 1,3

  **References**:
  - Pattern: `src/worker/routes/admin.ts:17-56` - scaffold branches to replace.
  - Pattern: `src/worker/services/http.ts:1-53` - JSON/error/405 response conventions to preserve.
  - Pattern: `src/worker/routes/student.ts:13-166` - route branching and JSON helper style.
  - Pattern: `src/worker/routes/mentor.ts:14-138` - route handler style for current role APIs.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `rtk npm test -- test/integration/admin-api.test.ts` passes the `GET /records` cases.
  - [ ] `GET /admin/:secret/api/records` returns `200` with `eventDate`, `records`, `students`, and `mentors` keys only.
  - [ ] Bad admin secrets return `403` and wrong methods return `405` with the expected `allowed` value.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Admin records load successfully
    Tool: Bash
    Steps: Run `rtk npm test -- test/integration/admin-api.test.ts`
    Expected: Exit code 0; GET /records returns newest-first rows and embedded lookup lists
    Evidence: .sisyphus/evidence/task-4-admin-records-api.txt

  Scenario: Invalid admin secret is rejected
    Tool: Bash
    Steps: Run `rtk npm test -- test/integration/admin-api.test.ts`
    Expected: Exit code 0; coverage includes GET /records with wrong secret returning 403
    Evidence: .sisyphus/evidence/task-4-admin-records-api-error.txt
  ```

  **Commit**: YES | Message: `feat(admin): add admin records api` | Files: `src/worker/routes/admin.ts`, `test/integration/admin-api.test.ts`

- [x] 5. Implement CSV export with exact v1 semantics

  **What to do**:
  - Replace the `notImplemented` branch for `GET /admin/:secret/api/export.csv`.
  - Serialize rows with this literal header line exactly: `student name,secret id,mentor scanned,date,notes`.
  - Map `date` to `event_date`, not `scanned_at`.
  - Export current-state rows ordered by `scanned_at ASC, scan_id ASC`.
  - Return `content-type: text/csv; charset=utf-8` and `content-disposition: attachment; filename="attendance-<eventDate>.csv"`.
  - Escape commas, quotes, and newlines correctly in notes.

  **Must NOT do**:
  - Do not change the documented column order.
  - Do not emit JSON from the export endpoint.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: export is a focused serializer + route task once data access is available.
  - Skills: [`test-driven-development`] - exact header and CSV escaping should be locked by tests first.
  - Omitted: [`frontend-design`] - no UI work here.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 8,9 | Blocked By: 1,3

  **References**:
  - Pattern: `docs/prd/mentor-student-qr-attendance-v1.md:117-123` - exact CSV order requirement.
  - Pattern: `docs/implementation/mentor-student-qr-attendance-v1-plan.md:281-286` - export is part of Phase 4 exit criteria.
  - Pattern: `src/worker/routes/admin.ts:17-56` - scaffold branch to replace.
  - API/Type: `src/worker/db/admin-records.ts` - export helper created in Task 3.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `rtk npm test -- test/integration/admin-api.test.ts` passes the `GET /export.csv` cases.
  - [ ] The first CSV line is exactly `student name,secret id,mentor scanned,date,notes`.
  - [ ] Exported rows are chronological ascending and reflect the latest persisted note values.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: CSV export returns the required header and content type
    Tool: Bash
    Steps: Run `rtk npm test -- test/integration/admin-api.test.ts`
    Expected: Exit code 0; coverage asserts exact header line, text/csv content type, and attachment filename
    Evidence: .sisyphus/evidence/task-5-admin-export.txt

  Scenario: CSV escaping handles note punctuation safely
    Tool: Bash
    Steps: Run `rtk npm test -- test/integration/admin-api.test.ts`
    Expected: Exit code 0; coverage includes notes containing commas/quotes/newlines and asserts valid escaped CSV output
    Evidence: .sisyphus/evidence/task-5-admin-export-error.txt
  ```

  **Commit**: YES | Message: `feat(admin): add csv export` | Files: `src/worker/routes/admin.ts`, `src/worker/db/admin-records.ts`, `test/integration/admin-api.test.ts`

- [x] 6. Implement PATCH correction semantics for notes and reassignment

  **What to do**:
  - Replace the `notImplemented` branch for `PATCH /admin/:secret/api/records/:scanId`.
  - Accept JSON bodies containing any combination of:
    - `notes?: string`
    - `studentId?: string`
    - `mentorId?: string`
  - Require at least one of those keys.
  - Allow `notes: ""` to clear notes.
  - Validate `studentId` against `role='student'` and `mentorId` against `role='mentor'` using existing people lookups.
  - Apply note and reassignment changes to the same row with last-write-wins behavior by updating the existing record and its `updated_at` value.
  - On reassignment that violates `(student_id, mentor_id, event_date)` uniqueness, return `409` with exact error text: `Duplicate mentor scan already recorded for this event day.`
  - Return `200` JSON with the fully updated record payload.

  **Must NOT do**:
  - Do not create a new scan record during reassignment.
  - Do not silently ignore unknown body keys.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: validation and conflict semantics are the most failure-prone admin behavior.
  - Skills: [`test-driven-development`] - all success and failure cases need failing integration tests first.
  - Omitted: [`playwright`] - API correctness comes first.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 8,9 | Blocked By: 1,3

  **References**:
  - Pattern: `docs/prd/mentor-student-qr-attendance-v1.md:125-133` - edit/reassign current-state behavior.
  - Pattern: `docs/prd/mentor-student-qr-attendance-v1.md:181-182` - last-write-wins correction rule.
  - Pattern: `migrations/0001_initial_schema.sql` - uniqueness rule that must surface as a deterministic conflict.
  - Pattern: `src/worker/db/people.ts:3-60` - role validation lookups to reuse.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `rtk npm test -- test/integration/admin-api.test.ts` passes note-only, student-only, mentor-only, and note+reassign PATCH cases.
  - [ ] Invalid payloads return `400`, missing scan/person references return `404`, and duplicate reassignment returns `409` with the exact conflict message.
  - [ ] Successful PATCH updates are reflected immediately in subsequent `GET /records` and `GET /export.csv` responses.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Admin edits notes and reassigns a record successfully
    Tool: Bash
    Steps: Run `rtk npm test -- test/integration/admin-api.test.ts`
    Expected: Exit code 0; coverage asserts note-only, reassignment-only, and combined PATCH success cases
    Evidence: .sisyphus/evidence/task-6-admin-patch.txt

  Scenario: Duplicate reassignment conflict is deterministic
    Tool: Bash
    Steps: Run `rtk npm test -- test/integration/admin-api.test.ts`
    Expected: Exit code 0; coverage asserts 409 with `Duplicate mentor scan already recorded for this event day.`
    Evidence: .sisyphus/evidence/task-6-admin-patch-error.txt
  ```

  **Commit**: YES | Message: `feat(admin): add correction updates` | Files: `src/worker/routes/admin.ts`, `src/worker/db/admin-records.ts`, `test/integration/admin-api.test.ts`

- [x] 7. Implement hard deletion for admin records

  **What to do**:
  - Replace the `notImplemented` branch for `DELETE /admin/:secret/api/records/:scanId`.
  - Hard-delete the row from `scan_records`; do not add soft-delete state.
  - Return `200` JSON `{ "deleted": true, "scanId": "<id>" }` on success.
  - Return `404` when `scanId` does not exist.
  - Ensure deleted rows disappear from both `GET /records` and `GET /export.csv` immediately.

  **Must NOT do**:
  - Do not leave tombstone rows.
  - Do not return `204`; use the locked `200` JSON response for consistency with existing API patterns.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: narrow route + DB mutation once semantics are locked.
  - Skills: [`test-driven-development`] - delete success/missing-record paths must be test-first.
  - Omitted: [`playwright`] - API slice only.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 8,9 | Blocked By: 1,3

  **References**:
  - Pattern: `docs/prd/mentor-student-qr-attendance-v1.md:125-133` - delete capability is P0.
  - Pattern: `src/worker/routes/admin.ts:17-56` - scaffold branch to replace.
  - API/Type: `src/worker/db/admin-records.ts` - delete helper + existence checks.
  - Pattern: `src/worker/services/http.ts:1-53` - consistent JSON/error response helpers.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `rtk npm test -- test/integration/admin-api.test.ts` passes delete success and delete-missing cases.
  - [ ] Successful delete returns `200` with `{ deleted: true, scanId }`.
  - [ ] Deleted records are absent from both the records API and CSV export.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Admin deletes an existing record
    Tool: Bash
    Steps: Run `rtk npm test -- test/integration/admin-api.test.ts`
    Expected: Exit code 0; coverage asserts 200 delete response and absence from later reads/exports
    Evidence: .sisyphus/evidence/task-7-admin-delete.txt

  Scenario: Admin delete on missing record fails cleanly
    Tool: Bash
    Steps: Run `rtk npm test -- test/integration/admin-api.test.ts`
    Expected: Exit code 0; coverage asserts 404 for nonexistent scanId
    Evidence: .sisyphus/evidence/task-7-admin-delete-error.txt
  ```

  **Commit**: YES | Message: `feat(admin): add record deletion` | Files: `src/worker/routes/admin.ts`, `src/worker/db/admin-records.ts`, `test/integration/admin-api.test.ts`

- [x] 8. Wire the admin page to the completed admin APIs

  **What to do**:
  - Add `public/admin/app.js` and keep it framework-free like the existing student and mentor pages.
  - On load, derive the admin base path from `window.location.pathname` and fetch `GET /admin/:secret/api/records`.
  - Render rows into `#records-table-body` using the locked payload from Task 4.
  - For each row, render:
    - student select bound to embedded `students[]`
    - mentor select bound to embedded `mentors[]`
    - notes textarea
    - save button
    - delete button
  - Use `div#status-banner` for fetch/save/delete/export feedback.
  - Show `#records-loading` while fetching and `#records-empty-state` when no rows exist.
  - Make `#export-csv-button` trigger the existing export endpoint; do not generate CSV client-side.
  - Add `test/integration/admin-page-app.test.ts` first to lock fetch/render/edit/delete state transitions in Vitest.

  **Must NOT do**:
  - Do not add filters, counters, or status markers.
  - Do not add any client-side state store or frontend framework.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - Reason: this is plain JS UI wiring on a fixed DOM contract.
  - Skills: [`test-driven-development`] - runtime state transitions should be locked in Vitest first.
  - Omitted: [`frontend-design`] - keep the admin page utilitarian and minimal.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 9 | Blocked By: 2,4,5,6,7

  **References**:
  - Pattern: `public/student/app.js` - plain JS fetch/render/error-state style to mirror.
  - Pattern: `public/mentor/app.js` - polling/save feedback patterns to mirror where applicable.
  - Pattern: `public/admin/index.html` - fixed shell from Task 2.
  - API/Type: `src/worker/routes/admin.ts` - locked payload and mutation endpoints from Tasks 4-7.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `rtk npm test -- test/integration/admin-page-app.test.ts` passes.
  - [ ] Loading state, empty state, populated state, save feedback, and delete feedback are all covered by automated tests.
  - [ ] `rtk npm run typecheck` passes after adding admin runtime JS wiring.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Admin page loads and renders editable rows
    Tool: Bash
    Steps: Run `rtk npm test -- test/integration/admin-page-app.test.ts`
    Expected: Exit code 0; coverage asserts loading state, row rendering, select population, and empty-state fallback
    Evidence: .sisyphus/evidence/task-8-admin-page-app.txt

  Scenario: Admin page surfaces failed save/delete states
    Tool: Bash
    Steps: Run `rtk npm test -- test/integration/admin-page-app.test.ts`
    Expected: Exit code 0; coverage asserts `#status-banner` shows deterministic error feedback on failed PATCH/DELETE responses
    Evidence: .sisyphus/evidence/task-8-admin-page-app-error.txt
  ```

  **Commit**: YES | Message: `feat(admin): wire admin page` | Files: `public/admin/app.js`, `public/admin/index.html`, `test/integration/admin-page-app.test.ts`

- [x] 9. Add browser E2E harness and full admin-flow coverage

  **What to do**:
  - Add Playwright dependencies, `playwright.config.ts`, and package scripts for browser E2E.
  - Configure `playwright.config.ts` with a `webServer` block that starts local dev with explicit environment values, not manual secrets:
    - `ADMIN_SECRET=local-admin-secret-token`
    - `EVENT_DATE=2026-04-11`
    - local base URL `http://127.0.0.1:4173`
  - Add `test/e2e/admin-flow.spec.ts` covering the real admin workflow against local dev/test data.
  - Add deterministic admin E2E data setup so the browser flow never starts from an empty table:
    - create `seed/e2e-admin.sql` with exactly one known `scan_records` row for the first seeded student and first seeded mentor on `2026-04-11`
    - wire that seed into the browser setup path via Playwright global setup or a dedicated pre-test command so it runs automatically before the spec opens the admin page
  - Lock the seeded browser test inputs to:
    - admin URL `/admin/local-admin-secret-token`
    - one pre-created record visible when the page first loads
    - updated note text `Updated by admin`
  - Cover these browser scenarios:
    1. load admin page with valid secret and wait for the records table
    2. edit notes and verify persisted update after reload
    3. reassign a record and verify the table reflects the new student or mentor
    4. delete a record and verify row removal
    5. click export and verify a CSV download whose first line is the exact required header
    6. attempt to open the page with a bad admin secret and verify access is rejected
  - Keep Playwright limited to admin flow and admin-secret behavior; cross-role deep QA remains Phase 5.

  **Must NOT do**:
  - Do not add broad multi-role end-to-end suites in this task.
  - Do not make Playwright optional.
  - Do not rely on manually created secrets or manually inserted test records.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: new browser harness setup plus real admin workflow verification.
  - Skills: [`test-driven-development`, `playwright`] - browser-first spec lock plus stable automation.
  - Omitted: [`frontend-design`] - browser tests only.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: F1-F4 | Blocked By: 2,4,5,6,7,8

  **References**:
  - Pattern: `package.json` - current test script conventions to extend.
  - Pattern: `wrangler.jsonc` - local Worker configuration that Playwright must target.
  - Pattern: `seed/dev.sql` - local seeded identities that the E2E setup must build on.
  - Pattern: `docs/implementation/mentor-student-qr-attendance-v1-plan.md:313-317` - E2E expectations for admin behavior.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `rtk npx playwright test test/e2e/admin-flow.spec.ts` passes.
  - [ ] Playwright runtime setup provisions `ADMIN_SECRET` automatically via config and does not require manual secret entry.
  - [ ] Browser setup provisions one deterministic admin-visible scan record automatically before the spec begins.
  - [ ] Browser coverage asserts edit, reassign, delete, export, and bad-secret rejection.
  - [ ] `rtk npm run typecheck` still passes after adding Playwright config and scripts.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Full admin happy path in browser
    Tool: Playwright
    Steps: Start the Playwright-managed local server; apply the deterministic admin E2E seed/setup automatically; open `/admin/local-admin-secret-token`; wait for `#records-table`; confirm one pre-created row exists; update that row note to `Updated by admin`; save; reload; trigger export download
    Expected: Updated note persists after reload; export download succeeds; first CSV line equals `student name,secret id,mentor scanned,date,notes`
    Evidence: .sisyphus/evidence/task-9-admin-e2e.png

  Scenario: Bad admin secret is blocked in browser
    Tool: Playwright
    Steps: Start the Playwright-managed local server with configured `ADMIN_SECRET`; open `/admin/not-the-secret`; wait for the rejection response or blocked page state
    Expected: Page does not render the admin records table and access is rejected deterministically
    Evidence: .sisyphus/evidence/task-9-admin-e2e-error.png
  ```

  **Commit**: YES | Message: `test(admin): add browser e2e coverage` | Files: `package.json`, `playwright.config.ts`, `test/e2e/admin-flow.spec.ts`, `seed/e2e-admin.sql`, related setup files

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [ ] F1. Plan Compliance Audit — oracle

  **What to do**:
  - Compare implemented admin changes against this plan, `docs/prd/mentor-student-qr-attendance-v1.md`, and `docs/implementation/mentor-student-qr-attendance-v1-plan.md`.
  - Verify every completed task maps to the locked admin scope only.
  - Confirm the final implementation preserves the decisions locked in this plan: embedded lookup arrays, exact CSV header, `event_date` export column, hard delete, and deterministic `409` conflict handling.

  **Acceptance Criteria**:
  - [ ] Oracle reports no missing Phase 4 deliverable from Tasks 1-9.
  - [ ] Oracle reports no contradiction with PRD/admin implementation-plan scope.

  **QA Scenarios**:
  ```
  Scenario: Plan-vs-implementation audit passes
    Tool: oracle
    Steps: Review `.sisyphus/plans/admin-flow-aligned.md`, `docs/prd/mentor-student-qr-attendance-v1.md`, `docs/implementation/mentor-student-qr-attendance-v1-plan.md`, and the changed admin files
    Expected: Oracle returns APPROVE with no missing Phase 4 requirement and no contradiction against locked v1 admin scope
    Evidence: .sisyphus/evidence/f1-plan-compliance.md
  ```

- [ ] F2. Code Quality Review — unspecified-high

  **What to do**:
  - Review the final admin diff for maintainability, unnecessary complexity, and contract drift.
  - Run the full targeted automated verification set for admin code quality.
  - Check diagnostics on new/changed admin-facing files before approval.

  **Acceptance Criteria**:
  - [ ] `rtk npm run typecheck` passes.
  - [ ] `rtk npm test -- test/unit/mock-d1-admin.test.ts` passes.
  - [ ] `rtk npm test -- test/integration/admin-api.test.ts` passes.
  - [ ] `rtk npm test -- test/integration/admin-page-dom.test.ts` passes.
  - [ ] `rtk npm test -- test/integration/admin-page-app.test.ts` passes.

  **QA Scenarios**:
  ```
  Scenario: Admin code passes targeted static and Vitest checks
    Tool: Bash
    Steps: Run `rtk npm run typecheck`; run `rtk npm test -- test/unit/mock-d1-admin.test.ts`; run `rtk npm test -- test/integration/admin-api.test.ts`; run `rtk npm test -- test/integration/admin-page-dom.test.ts`; run `rtk npm test -- test/integration/admin-page-app.test.ts`
    Expected: All commands exit with code 0
    Evidence: .sisyphus/evidence/f2-code-quality.txt

  Scenario: Admin files have no unresolved language diagnostics
    Tool: Bash
    Steps: Run language diagnostics or equivalent repo-supported diagnostic checks for `src/worker/routes/admin.ts`, `src/worker/db/admin-records.ts`, and `public/admin/app.js`
    Expected: No unresolved errors remain in changed admin files
    Evidence: .sisyphus/evidence/f2-diagnostics.txt
  ```

- [ ] F3. Real Manual QA — unspecified-high (+ playwright if UI)

  **What to do**:
  - Execute the browser-level admin workflow end to end using the shipped Playwright harness.
  - Confirm edit, reassign, delete, export, and bad-secret rejection work against the final runtime, not only mocks.

  **Acceptance Criteria**:
  - [ ] `rtk npx playwright test test/e2e/admin-flow.spec.ts` passes.
  - [ ] Browser evidence shows the admin table renders and the CSV export download succeeds.

  **QA Scenarios**:
  ```
  Scenario: Browser admin happy path remains green
    Tool: Playwright
    Steps: Run `rtk npx playwright test test/e2e/admin-flow.spec.ts`
    Expected: Exit code 0; Playwright covers edit, reassignment, delete, export, and persistence after reload
    Evidence: .sisyphus/evidence/f3-browser-qa.txt

  Scenario: Browser bad-secret rejection remains green
    Tool: Playwright
    Steps: Run `rtk npx playwright test test/e2e/admin-flow.spec.ts --grep "bad admin secret"`
    Expected: Exit code 0; invalid admin secret does not render the records table
    Evidence: .sisyphus/evidence/f3-browser-qa-error.txt
  ```

- [ ] F4. Scope Fidelity Check — deep

  **What to do**:
  - Review the final changed files and verify that no P1/P2 features slipped into the implementation.
  - Confirm student and mentor contracts stayed stable unless explicitly required by shared refactor.
  - Confirm no extra endpoints, filters, counters, soft delete, multi-day behavior, or auth redesign were introduced.

  **Acceptance Criteria**:
  - [ ] Deep review reports no scope creep beyond P0 admin requirements.
  - [ ] Deep review reports no unintended contract changes to existing student and mentor flows.

  **QA Scenarios**:
  ```
  Scenario: Final scope fidelity review passes
    Tool: deep
    Steps: Review the final admin diff against `.sisyphus/plans/admin-flow-aligned.md` and the locked v1 docs; inspect changed routes, public admin files, tests, and config
    Expected: Deep reviewer returns APPROVE with no P1/P2 scope creep and no unintended student/mentor contract drift
    Evidence: .sisyphus/evidence/f4-scope-fidelity.md
  ```

## Commit Strategy
- 1: `test(admin): extend mock d1 for admin flows`
- 2: `test(admin): lock admin page contract`
- 3: `feat(admin): add admin data helpers`
- 4: `feat(admin): add admin records api`
- 5: `feat(admin): add csv export`
- 6: `feat(admin): add correction updates`
- 7: `feat(admin): add record deletion`
- 8: `feat(admin): wire admin page`
- 9: `test(admin): add browser e2e coverage`

## Success Criteria
- Admin page loads through the existing secret-based route and shows current event-day records.
- Admin can edit notes, reassign student/mentor, and delete a record without breaking student/mentor behavior.
- CSV export uses exact required column order and reflects corrected current state.
- Admin flows match current Worker response conventions and v1 scope boundaries.
- Vitest and Playwright verification pass without manual intervention.
