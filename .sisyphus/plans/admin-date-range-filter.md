# Admin Event-Date Range Filter

## TL;DR
> **Summary**: Add visible start/end date controls to the admin page so admins can filter both the records table and CSV export by an inclusive `event_date` range, while preserving current default behavior as configured event-day only.
> **Deliverables**:
> - range-aware admin records/export contract using `startDate` + `endDate`
> - admin DB query support for inclusive `event_date` ranges
> - admin page start/end date controls with URL-backed state and export parity
> - targeted admin test updates plus unchanged CSV column order and admin correction behavior
> - docs updates clarifying this as an admin-only reporting enhancement
> **Effort**: Medium
> **Parallel**: YES - 3 waves
> **Critical Path**: Tasks 1/3 → Task 2 → Task 4 → Tasks 5/6

## Context
### Original Request
Add a customizable date filter (start and end) on the admin page.

### Interview Summary
- The filter must apply to both the admin table and CSV export.
- Default behavior should remain “today only,” implemented here as the configured event-day so current admin behavior is preserved.
- The UI should use two visible date inputs.
- The filter must use stored `event_date`, not `scanned_at`.
- Docs should be updated.
- Test strategy preference is minimal tests, not a broad new test matrix.

### Metis Review (gaps addressed)
- Resolved the main semantic risk by locking the filter to `event_date` only; `scanned_at` must not enter admin filtering.
- Resolved invalid-input handling by making the browser UI block invalid apply attempts, while server endpoints fall back to configured event-day when query params are absent, partial, malformed, or reversed.
- Resolved consistency risk by requiring one shared query-param contract for both table and CSV export: `startDate` + `endDate`.
- Resolved URL-state ambiguity by making the admin page URL-backed: after initial default load, the page should normalize the URL to include the active range.
- Resolved docs mismatch by updating PRD + implementation-plan wording to describe this as admin-only reporting over stored `event_date` values, not a broader multi-event product change.

## Work Objectives
### Core Objective
Allow the admin page to filter records and CSV export by an inclusive start/end `event_date` range, while leaving student, mentor, duplicate-scan, and non-admin event semantics unchanged.

### Deliverables
- Range-aware admin query contract in `src/worker/routes/admin.ts`
- Inclusive `event_date` range queries in `src/worker/db/admin-records.ts`
- Matching mock-D1 support in `test/support/mock-d1.ts` and SQL-shape coverage in `test/unit/mock-d1-admin.test.ts`
- Visible admin start/end date inputs in `public/admin/index.html`
- URL-backed admin filter state and export parity in `public/admin/app.js`
- Minimal targeted coverage updates in admin unit/integration/DOM/app tests
- Docs alignment in `docs/prd/mentor-student-qr-attendance-v1.md` and `docs/implementation/mentor-student-qr-attendance-v1-plan.md`

### Definition of Done (verifiable conditions with commands)
- `rtk proxy npx vitest run test/unit/admin-records.test.ts test/unit/mock-d1-admin.test.ts` passes with inclusive `event_date` range coverage.
- `rtk proxy npx vitest run test/integration/admin-api.test.ts test/integration/admin-page-app.test.ts test/integration/admin-page-dom.test.ts` passes with admin filter coverage.
- `rtk npm run test:e2e:admin` passes without adding a new Playwright scenario unless existing flow coverage breaks.
- `rtk npm run typecheck` passes.
- `rtk proxy npx vitest run test/integration/admin-api.test.ts -t "date range"` passes for both records and export.

### Must Have
- Query param contract is exactly `startDate` and `endDate`.
- Filtering is inclusive on both ends: `event_date >= startDate AND event_date <= endDate`.
- Both admin table and CSV export honor the same active range.
- Default admin behavior stays equivalent to today/configured event-day only.
- Browser UI exposes exactly two date inputs plus one apply action; no hidden-only implementation.
- Admin filtering remains based on stored `event_date`, not `scanned_at`.
- Existing CSV column order remains exactly `student name, secret id, mentor scanned, date, notes`.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- No `scanned_at`-based admin filtering.
- No schema migration or D1 table shape changes.
- No student or mentor page changes.
- No extra admin features: presets, search, sort, pagination, saved filters, multi-event identifiers, or role-permission changes.
- No change to duplicate-scan, note-save ownership, delete, or reassignment semantics.
- No README updates; docs changes are limited to PRD + implementation-plan wording needed to remove contradictions.

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed.
- Test decision: **tests-after (minimal targeted Vitest + existing admin Playwright regression)**
- QA policy: Every task includes one happy-path and one failure/edge-path scenario.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy
### Parallel Execution Waves
Wave 1: Task 1 (DB + mock range foundation) + Task 3 (admin filter DOM shell) in parallel, followed by Task 2 (route contract + API parity)

Wave 2: Task 4 (admin app state, URL sync, apply/export wiring) + Task 5 (docs alignment) in parallel

Wave 3: Task 6 (consolidated admin regressions and commit-ready verification)

### Dependency Matrix (full, all tasks)
| Task | Depends On | Blocks |
|---|---|---|
| 1 | none | 2, 4, 6 |
| 2 | 1 | 4, 5, 6 |
| 3 | none | 4, 6 |
| 4 | 2, 3 | 5, 6 |
| 5 | 2 | 6 |
| 6 | 1, 2, 3, 4, 5 | F1-F4 |

### Agent Dispatch Summary (wave → task count → categories)
- Wave 1 → 3 tasks → `quick`, `quick`, `quick`
- Wave 2 → 2 tasks → `quick`, `writing`
- Wave 3 → 1 task → `unspecified-low`

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [x] 1. Add inclusive admin `event_date` range queries and mock support

  **What to do**:
  - In `src/worker/db/admin-records.ts`, replace the single-date admin read helpers with range-aware equivalents that accept `startDate` and `endDate`.
  - Use inclusive SQL predicates on `scan_records.event_date`, specifically `>= ?1` and `<= ?2`, while preserving current ordering for records and export rows.
  - Keep `findAdminRecordById`, `updateAdminRecord`, and delete-related behavior unchanged.
  - Update `test/support/mock-d1.ts` so admin `all()` branches recognize the new range-query SQL shape exactly.
  - Update `test/unit/mock-d1-admin.test.ts` and `test/unit/admin-records.test.ts` to lock the new SQL pattern, row ordering, and export row selection.

  **Must NOT do**:
  - Do not alter `scan_records` schema or uniqueness constraints.
  - Do not change any non-admin query helpers in `src/worker/db/scan-records.ts`.
  - Do not introduce `scanned_at` predicates in admin queries.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: tightly scoped DB/query + mock update in existing admin seams.
  - Skills: [] - existing admin patterns are already established.
  - Omitted: [`test-driven-development`] - user explicitly requested minimal tests rather than a TDD-first expansion.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 2, 4, 6 | Blocked By: none

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `src/worker/db/admin-records.ts:107-137` - current `listAdminRecords(db, eventDate)` single-date query to broaden into inclusive range logic.
  - Pattern: `src/worker/db/admin-records.ts:235-260` - current `listAdminExportRows(db, eventDate)` single-date export query to broaden in parallel with records.
  - Pattern: `src/worker/db/admin-records.ts:262-278` - current `getAdminRecordsPayload(db, eventDate)` wrapper to update for a range input.
  - Test: `test/unit/admin-records.test.ts:46-137` - existing admin records/export unit expectations to extend for range semantics.
  - Test: `test/unit/mock-d1-admin.test.ts:59-361` - SQL-shape coverage to extend for ranged admin queries.
  - Test double: `test/support/mock-d1.ts:314-360` - current admin single-event-date `all()` branch to replace/extend with range-aware matching.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `rtk proxy npx vitest run test/unit/admin-records.test.ts test/unit/mock-d1-admin.test.ts` passes with inclusive range coverage.
  - [ ] `rtk npm run typecheck` passes after the admin query/helper signature changes.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Admin query layer returns only rows inside the inclusive event_date range
    Tool: Bash
    Steps: Run `rtk proxy npx vitest run test/unit/admin-records.test.ts -t "range"`
    Expected: Tests pass and only rows whose `event_date` falls between the requested start/end values are returned in the existing sort order.
    Evidence: .sisyphus/evidence/task-1-admin-range-unit.txt

  Scenario: Mock D1 mirrors the new admin range SQL shape
    Tool: Bash
    Steps: Run `rtk proxy npx vitest run test/unit/mock-d1-admin.test.ts`
    Expected: The mock accepts the new admin range query shape without unsupported-SQL failures.
    Evidence: .sisyphus/evidence/task-1-admin-range-mock.txt
  ```

  **Commit**: NO | Message: `feat(admin-db): support inclusive event-date ranges` | Files: `src/worker/db/admin-records.ts`, `test/support/mock-d1.ts`, `test/unit/admin-records.test.ts`, `test/unit/mock-d1-admin.test.ts`

- [x] 2. Add shared admin route contract for `startDate` + `endDate`

  **What to do**:
  - In `src/worker/routes/admin.ts`, add a local helper that resolves the active admin date range from the request URL.
  - Param names must be exactly `startDate` and `endDate`.
  - Server-side defaulting rule: when both params are absent, partial, malformed, or `startDate > endDate`, resolve both values back to `getConfiguredEventDate(env)`.
  - Update `GET /api/records` to call the new range-aware admin payload function and include response metadata: `dateFilter: { startDate, endDate }`.
  - Update `GET /api/export.csv` to call the new range-aware export query using the same resolved range.
  - Keep `PATCH /api/records/:scanId` and `DELETE /api/records/:scanId` unchanged.

  **Must NOT do**:
  - Do not change CSV header order in `serializeAdminExportCsv`.
  - Do not add request-body filtering for GET routes; this feature is query-param based only.
  - Do not touch student/mentor routes.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: single route module with a narrow contract change.
  - Skills: [] - existing route patterns already cover validation and response helpers.
  - Omitted: [`test-driven-development`] - plan follows minimal targeted coverage per user preference.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 4, 5, 6 | Blocked By: 1

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `src/worker/routes/admin.ts:102-148` - current `GET /records` and `GET /export.csv` hard-lock to `getConfiguredEventDate(env)`; this is the exact route seam to replace.
  - Pattern: `src/worker/routes/admin.ts:30-43` - CSV serialization must remain column-order stable while honoring the active range.
  - Pattern: `src/worker/services/event-day.ts:1-20` - reuse the existing event-date validation style and configured-date fallback behavior.
  - Test: `test/integration/admin-api.test.ts:72-111` - current helper/setup patterns.
  - Test: `test/integration/admin-api.test.ts:116-231` - current `GET /records` coverage to extend with range/default behavior.
  - Test: `test/integration/admin-api.test.ts:231-284` - current `GET /export.csv` coverage to extend with range parity.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `rtk proxy npx vitest run test/integration/admin-api.test.ts -t "records"` passes with default and range query coverage.
  - [ ] `rtk proxy npx vitest run test/integration/admin-api.test.ts -t "export"` passes with export parity and unchanged CSV header order.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Records API defaults to configured event day and exposes active filter metadata
    Tool: Bash
    Steps: Run `rtk proxy npx vitest run test/integration/admin-api.test.ts -t "records"`
    Expected: The API returns records for the configured event day when query params are absent and includes `dateFilter.startDate`/`dateFilter.endDate` matching that fallback.
    Evidence: .sisyphus/evidence/task-2-admin-records-api.txt

  Scenario: Export API honors the same active start/end range as records
    Tool: Bash
    Steps: Run `rtk proxy npx vitest run test/integration/admin-api.test.ts -t "export"`
    Expected: CSV output contains only rows in the inclusive `event_date` range while preserving the exact header order.
    Evidence: .sisyphus/evidence/task-2-admin-export-api.txt
  ```

  **Commit**: NO | Message: `feat(admin-api): add date range query contract` | Files: `src/worker/routes/admin.ts`, `test/integration/admin-api.test.ts`

- [x] 3. Add the admin date-filter shell to the page markup

  **What to do**:
  - In `public/admin/index.html`, add two visible `<input type="date">` controls for `startDate` and `endDate` inside `#controls-card`.
  - Add one apply action control in the same area; do not add presets, chips, or extra quick-range buttons.
  - Preserve existing `#export-csv-button`, `#status-banner`, `#records-loading`, `#records-empty-state`, `#records-table`, and `#records-table-body` hooks.
  - Extend `test/integration/admin-page-dom.test.ts` only for the new filter controls added to static markup.

  **Must NOT do**:
  - Do not remove or rename existing admin hooks already covered by DOM tests.
  - Do not add search, sort, or pagination controls.
  - Do not style this as a major admin layout redesign.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: constrained HTML shell change with a small DOM-contract update.
  - Skills: [] - existing admin shell is simple and already test-covered.
  - Omitted: [`frontend-design`] - this is functional UI wiring, not a visual redesign task.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 4, 6 | Blocked By: none

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `public/admin/index.html:19-36` - current controls + table shell; place the new inputs alongside the existing export control in this section.
  - Test: `test/integration/admin-page-dom.test.ts:8-47` - current DOM contract to extend exactly once for new inputs/action.
  - Pattern: `public/admin/styles.css` - reuse existing control-card styling rather than adding a new layout system.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `rtk proxy npx vitest run test/integration/admin-page-dom.test.ts` passes with the new date-filter hooks.
  - [ ] `rtk npm run typecheck` passes after the markup change.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Admin page DOM exposes exactly two date inputs and one apply action
    Tool: Bash
    Steps: Run `rtk proxy npx vitest run test/integration/admin-page-dom.test.ts`
    Expected: DOM tests pass and the new static filter controls appear exactly once without breaking existing hooks.
    Evidence: .sisyphus/evidence/task-3-admin-dom.txt

  Scenario: Existing admin shell hooks stay intact
    Tool: Bash
    Steps: Run `rtk proxy npx vitest run test/integration/admin-page-dom.test.ts -t "admin"`
    Expected: The export button, records table, loading state, and empty-state hooks remain present and unchanged.
    Evidence: .sisyphus/evidence/task-3-admin-dom-regression.txt
  ```

  **Commit**: NO | Message: `feat(admin-ui): add date filter shell` | Files: `public/admin/index.html`, `test/integration/admin-page-dom.test.ts`

- [x] 4. Wire admin app state, URL sync, apply validation, and export parity

  **What to do**:
  - In `public/admin/app.js`, add element refs for the new `startDate`, `endDate`, and apply controls.
  - Introduce a single client-side filter state object containing `startDate` and `endDate`.
  - On first load, read `window.location.search`; if both params are present and valid, use them for `/api/records`; otherwise request `/api/records` with no params, then populate state from `response.dateFilter` and normalize the browser URL with `history.replaceState`.
  - Client-side apply validation must block requests when either input is empty or `startDate > endDate`; on that path, show a status-banner error and leave the last good records visible.
  - On valid apply, update the URL query string and call `loadRecords()` with both params.
  - Update export logic so `#export-csv-button` uses the same active `startDate`/`endDate` state in its URL.
  - Keep row editing, delete, note save, and reassignment flows working against the filtered table without clearing the active date range.
  - Update `test/integration/admin-page-app.test.ts` for initial defaulting, URL-backed load, apply validation, and export parity.

  **Must NOT do**:
  - Do not introduce browser-local timezone logic for filtering.
  - Do not auto-swap reversed dates.
  - Do not reset the active date range after edit/delete/save actions.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: single client module with predictable fetch/export state wiring.
  - Skills: [] - behavior is already concentrated in one admin app file.
  - Omitted: [`frontend-design`] - no visual redesign or animation work is needed.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: 5, 6 | Blocked By: 2, 3

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `public/admin/app.js:2-9,27-28` - current element refs to extend with filter controls.
  - Pattern: `public/admin/app.js:59-103` - current `loadRecords()` fetch path to update with active query params and default-response metadata handling.
  - Pattern: `public/admin/app.js:105-119` - current `handleExport()` path to keep in sync with the active range.
  - Pattern: `public/admin/app.js:121-128` - payload normalization seam to extend for `dateFilter` response metadata.
  - Pattern: `public/admin/app.js:285-390` - edit/delete flows that must preserve the active filter state when reloading records.
  - Test: `test/integration/admin-page-app.test.ts:217-254` - current bootstrap/load patterns.
  - Test: `test/integration/admin-page-app.test.ts:265-292` - export behavior anchor.
  - Test: `test/integration/admin-page-app.test.ts:294-388` - edit flow anchor.
  - Test: `test/integration/admin-page-app.test.ts:428-657` - broader UI interaction coverage to extend for filter apply + preserved state.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `rtk proxy npx vitest run test/integration/admin-page-app.test.ts` passes with date-input load/apply/export coverage.
  - [ ] `rtk npm run typecheck` passes after admin app state changes.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Admin page defaults to configured event-day range and normalizes the URL
    Tool: Bash
    Steps: Run `rtk proxy npx vitest run test/integration/admin-page-app.test.ts -t "default"`
    Expected: The app loads records, populates both date inputs from server-returned `dateFilter`, and normalizes the URL to matching `startDate`/`endDate` params.
    Evidence: .sisyphus/evidence/task-4-admin-app-default.txt

  Scenario: Invalid apply attempt is blocked client-side without a fetch
    Tool: Bash
    Steps: Run `rtk proxy npx vitest run test/integration/admin-page-app.test.ts -t "invalid"`
    Expected: A reversed or partial range shows a status-banner error, no fetch is issued, and the last good table state remains visible.
    Evidence: .sisyphus/evidence/task-4-admin-app-invalid.txt
  ```

  **Commit**: NO | Message: `feat(admin-ui): wire date range state and export parity` | Files: `public/admin/app.js`, `test/integration/admin-page-app.test.ts`

- [x] 5. Align PRD and implementation docs to the admin-only reporting enhancement

  **What to do**:
  - Update `docs/prd/mentor-student-qr-attendance-v1.md` to clarify that while v1 student/mentor/write behavior remains single event-day, the admin interface may inspect/export an inclusive range of stored `event_date` values.
  - Update `docs/implementation/mentor-student-qr-attendance-v1-plan.md` so admin API/UI sections describe the new start/end date filter, table/export parity, and unchanged non-admin semantics.
  - Keep the docs wording explicit that this is not multi-event identity/auth/product scope.

  **Must NOT do**:
  - Do not broaden docs into multi-event support or new admin analytics.
  - Do not alter student/mentor runtime-day wording added in the prior plan.
  - Do not update unrelated docs files.

  **Recommended Agent Profile**:
  - Category: `writing` - Reason: constrained docs alignment across two source-of-truth docs.
  - Skills: [] - straightforward wording alignment, not a new spec.
  - Omitted: [`write-spec`] - this is a targeted scope adjustment, not a fresh product document.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 6 | Blocked By: 2

  **References** (executor has NO interview context - be exhaustive):
  - Doc: `docs/prd/mentor-student-qr-attendance-v1.md:24-29` - current non-goal wording that can be misread as forbidding admin range reporting.
  - Doc: `docs/prd/mentor-student-qr-attendance-v1.md:109-133` - admin transaction log/export/manual correction requirements to update precisely.
  - Doc: `docs/prd/mentor-student-qr-attendance-v1.md:175-183` - constraints section where admin reporting nuance must remain compatible with single-day write semantics.
  - Doc: `docs/implementation/mentor-student-qr-attendance-v1-plan.md:131-164` - admin API/UI sections to update for start/end range controls and export parity.
  - Doc: `docs/implementation/mentor-student-qr-attendance-v1-plan.md:30-39` - architecture/high-level flow wording to keep admin scope explicit and bounded.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `rtk npm run typecheck` passes after docs-only updates.
  - [ ] `rtk proxy npx vitest run test/integration/admin-api.test.ts` still passes after docs alignment (no behavior drift introduced by adjacent code edits).

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Docs describe admin range reporting without changing non-admin semantics
    Tool: Bash
    Steps: Run `rtk proxy npx vitest run test/integration/admin-api.test.ts`
    Expected: Admin API tests still pass, confirming docs alignment did not require extra behavior changes.
    Evidence: .sisyphus/evidence/task-5-admin-docs-api.txt

  Scenario: Docs-only step preserves repository type health
    Tool: Bash
    Steps: Run `rtk npm run typecheck`
    Expected: Typecheck passes unchanged after PRD and implementation-plan wording updates.
    Evidence: .sisyphus/evidence/task-5-admin-docs-typecheck.txt
  ```

  **Commit**: NO | Message: `docs(admin): clarify event-date range reporting` | Files: `docs/prd/mentor-student-qr-attendance-v1.md`, `docs/implementation/mentor-student-qr-attendance-v1-plan.md`

- [x] 6. Run the consolidated admin regression sweep and prepare the branch for review

  **What to do**:
  - Run the full targeted admin regression set after Tasks 1-5 are complete.
  - Include existing admin Playwright regression, but do not add a new Playwright scenario unless the new controls cannot be adequately covered in existing Vitest admin-page tests.
  - Confirm row editing, delete, export, and filter behavior all work together with the active range preserved.
  - Treat this as the commit-ready gate for the feature branch.

  **Must NOT do**:
  - Do not widen the regression sweep into unrelated student/mentor suites unless an admin change breaks shared infrastructure.
  - Do not add more tests than needed beyond the agreed minimal coverage.

  **Recommended Agent Profile**:
  - Category: `unspecified-low` - Reason: command-heavy verification plus final branch readiness check.
  - Skills: [] - existing test commands are sufficient.
  - Omitted: [`playwright`] - reuse the existing admin Playwright script rather than inventing a new browser workflow unless required.

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: F1-F4 | Blocked By: 1, 2, 3, 4, 5

  **References** (executor has NO interview context - be exhaustive):
  - Commands: `package.json:6-15` - canonical `typecheck`, `test`, and `test:e2e:admin` scripts.
  - Test: `test/integration/admin-api.test.ts:116-913` - full admin API regression surface.
  - Test: `test/integration/admin-page-app.test.ts:217-657` - admin UI behavior regression surface.
  - Test: `test/integration/admin-page-dom.test.ts:8-47` - static admin DOM contract.
  - Test: `test/e2e/admin-flow.spec.ts:4-75` - existing admin Playwright regression to rerun, not necessarily extend.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `rtk proxy npx vitest run test/unit/admin-records.test.ts test/unit/mock-d1-admin.test.ts test/integration/admin-api.test.ts test/integration/admin-page-app.test.ts test/integration/admin-page-dom.test.ts` passes.
  - [ ] `rtk npm run test:e2e:admin` passes.
  - [ ] `rtk npm run typecheck` passes.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Full targeted admin regression sweep passes
    Tool: Bash
    Steps: Run `rtk proxy npx vitest run test/unit/admin-records.test.ts test/unit/mock-d1-admin.test.ts test/integration/admin-api.test.ts test/integration/admin-page-app.test.ts test/integration/admin-page-dom.test.ts`
    Expected: All targeted admin unit/integration/DOM suites pass with range filtering, export parity, and preserved admin edit/delete behavior.
    Evidence: .sisyphus/evidence/task-6-admin-regressions.txt

  Scenario: Existing admin Playwright flow remains green with the new controls present
    Tool: Bash
    Steps: Run `rtk npm run test:e2e:admin`
    Expected: Existing admin browser flow passes without new scope creep or selector breakage.
    Evidence: .sisyphus/evidence/task-6-admin-e2e.txt
  ```

  **Commit**: YES | Message: `feat(admin): add event-date range filter` | Files: `src/worker/routes/admin.ts`, `src/worker/db/admin-records.ts`, `public/admin/index.html`, `public/admin/app.js`, `test/support/mock-d1.ts`, `test/unit/admin-records.test.ts`, `test/unit/mock-d1-admin.test.ts`, `test/integration/admin-api.test.ts`, `test/integration/admin-page-app.test.ts`, `test/integration/admin-page-dom.test.ts`, `docs/prd/mentor-student-qr-attendance-v1.md`, `docs/implementation/mentor-student-qr-attendance-v1-plan.md`

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for the user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [x] F1. Plan Compliance Audit — oracle
- [x] F2. Code Quality Review — unspecified-high
- [x] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [x] F4. Scope Fidelity Check — deep

## Commit Strategy
- Development flow: minimal targeted coverage in this order — unit/mock foundation, API contract, UI wiring, docs, consolidated admin regressions.
- Shipping flow: one final atomic commit after Task 6.
- Final commit message: `feat(admin): add event-date range filter`

## Success Criteria
- Admin records table can be filtered by inclusive `event_date` `startDate`/`endDate` values.
- CSV export honors the same active range and keeps the exact required column order.
- Initial admin load preserves current behavior by defaulting to the configured event-day only.
- The admin page exposes exactly two visible date inputs and one apply action, with no extra filter features.
- Invalid client apply attempts are blocked with a visible error instead of issuing a request.
- Student, mentor, duplicate-scan, note-save, export column order, and admin correction semantics remain unchanged.
