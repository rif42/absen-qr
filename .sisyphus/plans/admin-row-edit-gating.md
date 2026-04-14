# Admin Row Edit Gating

## TL;DR
> **Summary**: Change the admin records table so each row is locked by default, add an `Edit` action beside `Save`, allow row-local editing only after `Edit` is pressed, and auto-lock the row again after a successful save without changing the existing admin API contract.
> **Deliverables**:
> - locked-by-default admin row behavior in `public/admin/app.js`
> - updated action-column markup and row-state styling in `public/admin/styles.css`
> - updated Vitest + Playwright coverage for Edit → Save → auto-lock behavior
> **Effort**: Short
> **Parallel**: NO
> **Critical Path**: Task 1 → Task 2 → Task 4 → Task 5

## Context
### Original Request
By default, records on the admin panel should not be editable. Add an edit button in the action column next to the save button. Pressing Edit makes the entire row editable. Clicking Save saves the edit.

### Interview Summary
- Current admin rows are editable by default in `public/admin/app.js`.
- The row already renders `Save` and `Delete`; the requested change is a row-state/UI gating change, not a backend feature change.
- Post-save behavior is resolved to: auto-lock the row after a successful save.
- Test strategy is resolved to: tests-after.

### Metis Review (gaps addressed)
- Resolved locked-row presentation by keeping the existing form controls and applying disabled state to student select, mentor select, notes textarea, and Save instead of replacing cells with plain text.
- Resolved no-change save behavior by defaulting to: no PATCH request, preserve current values, show the existing neutral status message, and re-lock the row.
- Resolved edit concurrency by defaulting to row-local state: multiple rows may be edited independently at the same time.
- Resolved delete behavior by preserving current availability: `Delete` remains available while a row is locked or being edited, but row actions remain disabled during an in-flight save/delete for that same row.
- Resolved failure-path behavior by requiring rows to stay editable if PATCH fails.

## Work Objectives
### Core Objective
Implement locked-by-default admin record rows while preserving v1 manual-correction scope, existing PATCH/DELETE/export contracts, and current admin table shell hooks.

### Deliverables
- Row-local editing state in `public/admin/app.js`
- Edit/Save/Delete action rendering that supports locked and editing modes
- Locked/editing visual affordances in `public/admin/styles.css`
- Updated admin integration/E2E coverage proving the new workflow

### Definition of Done (verifiable conditions with commands)
- `npm test -- test/integration/admin-page-app.test.ts` passes with assertions covering locked default state, Edit activation, successful save re-lock, unchanged save no-PATCH re-lock, and failed save stays-editable behavior.
- `npm test -- test/integration/admin-page-dom.test.ts` passes with updated row action/button expectations while preserving admin shell hooks.
- `npm test -- test/integration/admin-api.test.ts && npm test -- test/unit/admin-records.test.ts` passes without backend contract changes.
- `npm run typecheck` passes after the UI-state changes.
- `npm run test:e2e:admin` passes with browser verification of Edit → Save → auto-lock → reload persistence.

### Must Have
- Rows load locked by default.
- `Edit` appears in the action area next to `Save`.
- Student select, mentor select, and notes textarea become editable only for the row whose `Edit` button was pressed.
- `Save` stays visible but disabled while the row is locked, persists changed fields through the existing PATCH endpoint once edit mode is active, and auto-locks the row only after a successful response.
- Save failure keeps the row editable and preserves attempted values.
- Unchanged save performs no PATCH and re-locks the row using the neutral status path.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- No API route, DB schema, CSV export, event-day, or last-write-wins behavior changes.
- No new `Cancel` button, unsaved-change prompt, filters, badges, or admin redesign.
- No conversion of row controls into a text-only display.
- No change to static admin shell IDs/hooks in `public/admin/index.html:24-35` unless a test proves it is required.
- No cross-role, student-page, or mentor-page changes.

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed.
- Test decision: tests-after + Vitest + Playwright
- QA policy: Every task includes agent-executed scenarios
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy
### Parallel Execution Waves
> This is intentionally serial because `public/admin/app.js` owns the row lifecycle and each later task depends on that state contract.

Wave 1: Task 1 (row-state contract)
Wave 2: Task 2 (save lifecycle rules), Task 3 (row-state affordances)
Wave 3: Task 4 (browser-flow verification)
Wave 4: Task 5 (regression bundle + evidence capture)

### Dependency Matrix (full, all tasks)
- Task 1 → blocks Tasks 2, 3, 4, 5
- Task 2 → blocked by Task 1; blocks Tasks 4, 5
- Task 3 → blocked by Task 1; blocks Task 4 when selectors or classes change
- Task 4 → blocked by Tasks 1, 2, 3
- Task 5 → blocked by Tasks 1, 2, 3, 4

### Agent Dispatch Summary (wave → task count → categories)
- Wave 1 → 1 task → `quick`
- Wave 2 → 2 tasks → `quick`, `quick`
- Wave 3 → 1 task → `unspecified-low`
- Wave 4 → 1 task → `unspecified-low`

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [x] 1. Add row-local locked/editing state to admin rows

  **What to do**: Update `public/admin/app.js` so each rendered record row tracks whether it is locked or editable. Rows must initialize locked by default. `Save` must remain rendered in the action area, and `Edit` must be added beside it. The row must enable only its own student select, mentor select, and notes textarea when `Edit` is clicked.
  **Must NOT do**: Do not touch `src/worker/routes/admin.ts` or `src/worker/db/admin-records.ts`. Do not replace form controls with plain text cells.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: bounded JS behavior change in one primary file plus targeted test updates
  - Skills: `[]` - no special skill required
  - Omitted: `["test-driven-development"]` - explicit plan decision is tests-after, not red-green-refactor

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 2, 3, 4, 5 | Blocked By: none

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `public/admin/index.html:24-35` - existing admin table and export shell hooks must remain stable
  - Pattern: `public/admin/app.js:168-227` - current row construction for student select, mentor select, notes, Save, Delete
  - Pattern: `public/admin/app.js:353-369` - current changed-field diffing helper to preserve
  - Test: `test/integration/admin-page-app.test.ts:294-360` - current test coverage assumes immediate editability; update this contract first
  - Test: `test/integration/admin-page-dom.test.ts` - preserve static admin shell hooks while adjusting row action expectations if needed
  - API/Type: `src/worker/routes/admin.ts:150-235` - existing PATCH/DELETE contract that must remain unchanged

  **Acceptance Criteria** (agent-executable only):
  - [ ] `npm test -- test/integration/admin-page-app.test.ts` passes and includes assertions that first-row student select, mentor select, notes textarea, and Save button are disabled on initial render and become enabled only after clicking that row's `Edit` button.
  - [ ] `npm test -- test/integration/admin-page-dom.test.ts` passes with updated row action/button expectations while keeping `#records-table` and `#records-table-body` hooks intact.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Locked row becomes editable only after Edit
    Tool: Playwright
    Steps: Open /admin/local-admin-secret-token; wait for #records-table-body tr; target the first row; verify row.locator('select').nth(0), row.locator('select').nth(1), row.locator('textarea'), and row.getByRole('button', { name: 'Save' }) are disabled; click row.getByRole('button', { name: 'Edit' }); re-check the same controls are enabled.
    Expected: Exactly one row transitions from locked to editable; other rows remain locked.
    Evidence: .sisyphus/evidence/task-1-row-lock-state.png

  Scenario: Locked row does not allow direct save
    Tool: Playwright
    Steps: Open /admin/local-admin-secret-token; target the first row; inspect row.getByRole('button', { name: 'Save' }) before clicking Edit.
    Expected: Save is visible and disabled while the row is locked.
    Evidence: .sisyphus/evidence/task-1-save-disabled.txt
  ```

  **Commit**: NO | Message: `feat(admin): gate row editing behind explicit edit action` | Files: `public/admin/app.js`, `test/integration/admin-page-app.test.ts`, `test/integration/admin-page-dom.test.ts`

- [x] 2. Preserve save lifecycle rules for changed, unchanged, and failed edits

  **What to do**: Extend the existing save flow in `public/admin/app.js` so locked rows cannot submit, changed editable rows PATCH only changed fields, unchanged editable rows skip PATCH and re-lock, and failed PATCH requests keep the row editable with attempted values intact. Keep row action disabling limited to in-flight operations for that same row.
  **Must NOT do**: Do not add a Cancel action. Do not auto-lock on failed save. Do not broaden the payload beyond the existing changed-field diff.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: focused row-state transition logic in existing save handler
  - Skills: `[]` - existing code patterns are sufficient
  - Omitted: `["test-driven-development"]` - explicit tests-after plan

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: 4, 5 | Blocked By: 1

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `public/admin/app.js:254-307` - existing save handler and success-path state update
  - Pattern: `public/admin/app.js:309-350` - current delete disable/restore pattern to preserve per-row async behavior
  - Pattern: `public/admin/app.js:353-369` - field diffing helper; unchanged save must continue using this logic instead of inventing a new payload shape
  - Test: `test/integration/admin-page-app.test.ts:294-360` - current save-path assertions and changed-fields behavior
  - Test: `test/integration/admin-api.test.ts` - backend PATCH/DELETE/export behavior must remain green unchanged
  - Test: `test/unit/admin-records.test.ts` - admin record logic/regression safety for unchanged backend contract

  **Acceptance Criteria** (agent-executable only):
  - [ ] `npm test -- test/integration/admin-page-app.test.ts` passes with assertions for: changed save PATCHes only changed fields, unchanged save makes no PATCH and re-locks, and failed save keeps the row editable.
  - [ ] `npm test -- test/integration/admin-api.test.ts && npm test -- test/unit/admin-records.test.ts` passes without any route/db code changes.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Successful save persists and re-locks the row
    Tool: Playwright
    Steps: Open /admin/local-admin-secret-token; target the first row; click Edit; fill row.locator('textarea') with 'Updated by admin'; click Save; wait for #status-banner.
    Expected: #status-banner contains 'Saved'; the first-row textarea returns to disabled/readonly state; the updated textarea value remains visible.
    Evidence: .sisyphus/evidence/task-2-save-success.png

  Scenario: Unchanged save re-locks without PATCH
    Tool: Bash
    Steps: Run the targeted Vitest case covering no-change save behavior in test/integration/admin-page-app.test.ts.
    Expected: Test proves no network PATCH/mock invocation occurs and the row returns to locked state.
    Evidence: .sisyphus/evidence/task-2-no-change-save.txt

  Scenario: Failed save leaves row editable
    Tool: Bash
    Steps: Run the targeted Vitest case covering a rejected PATCH response in test/integration/admin-page-app.test.ts.
    Expected: Test proves the row remains editable, attempted values stay present, and the status path reports failure.
    Evidence: .sisyphus/evidence/task-2-save-failure.txt
  ```

  **Commit**: NO | Message: `fix(admin): preserve save semantics while gating row edits` | Files: `public/admin/app.js`, `test/integration/admin-page-app.test.ts`

- [x] 3. Add locked/editing affordances without changing the admin shell contract

  **What to do**: Update `public/admin/styles.css` and any necessary action-column markup/classes in `public/admin/app.js` so locked rows clearly present as read-only, editing rows are distinguishable, and the action area consistently shows `Edit`, `Save`, and `Delete` without breaking responsive table behavior.
  **Must NOT do**: Do not redesign the page, move export controls, or add extra admin UI features.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: narrow JS/CSS affordance update with stable DOM anchors
  - Skills: `[]` - project conventions are simple vanilla HTML/CSS/JS
  - Omitted: `["frontend-design"]` - this is a behavioral affordance change, not a visual redesign

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 4, 5 | Blocked By: 1

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `public/admin/styles.css:210-225` - existing action button styling for Save/Delete that must be extended, not replaced
  - Pattern: `public/admin/app.js:198-208` - current action-column button rendering
  - Test: `test/integration/admin-page-dom.test.ts` - static DOM expectations to keep stable except for the additional row action
  - Test: `test/integration/admin-page-app.test.ts` - app-layer expectations for button availability and row state
  - Pattern: `public/admin/index.html:24-35` - shell markup that must remain unchanged

  **Acceptance Criteria** (agent-executable only):
  - [ ] `npm test -- test/integration/admin-page-dom.test.ts` passes and row action markup still renders within the existing table shell.
  - [ ] `npm test -- test/integration/admin-page-app.test.ts` passes with assertions that locked/editing state classes or attributes match the intended button/control states.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Action area exposes the correct controls in locked mode
    Tool: Playwright
    Steps: Open /admin/local-admin-secret-token; target the first row inside #records-table-body; inspect button names in that row.
    Expected: Edit, Save, and Delete are all present; Save remains disabled until Edit is clicked.
    Evidence: .sisyphus/evidence/task-3-action-column.png

  Scenario: Editing affordance is row-local
    Tool: Playwright
    Steps: Open /admin/local-admin-secret-token; click Edit on the first row; compare first-row and second-row control states.
    Expected: First row shows the editing affordance/state; second row remains locked with no cross-row enablement.
    Evidence: .sisyphus/evidence/task-3-row-local-state.png
  ```

  **Commit**: NO | Message: `style(admin): add locked and editing row affordances` | Files: `public/admin/app.js`, `public/admin/styles.css`, `test/integration/admin-page-dom.test.ts`

- [x] 4. Update browser E2E coverage for the new admin edit workflow

  **What to do**: Update `test/e2e/admin-flow.spec.ts` so the browser flow enters edit mode explicitly before making changes, verifies save success, confirms the row re-locks, and verifies persisted values after reload.
  **Must NOT do**: Do not add unrelated E2E coverage for filters, deletion redesign, or non-admin roles.

  **Recommended Agent Profile**:
  - Category: `unspecified-low` - Reason: focused browser-flow adjustment with existing E2E infrastructure
  - Skills: `["playwright"]` - required for browser automation and exact selector verification
  - Omitted: `["test-driven-development"]` - tests-after plan already chosen

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: 5 | Blocked By: 1, 2, 3

  **References** (executor has NO interview context - be exhaustive):
  - Test: `test/e2e/admin-flow.spec.ts:13-27` - existing E2E currently edits fields directly and must be updated to enter edit mode first
  - Config: `playwright.config.ts` - existing browser test runner configuration
  - Pattern: `public/admin/index.html:24-35` - table shell selectors available in the page
  - Pattern: `public/admin/app.js:254-307` - save success path and status banner update behavior

  **Acceptance Criteria** (agent-executable only):
  - [ ] `npm run test:e2e:admin` passes with an explicit Edit-first flow and assertions for post-save re-lock plus persisted values after reload.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Edit -> Save -> auto-lock -> reload persistence
    Tool: Playwright
    Steps: Open /admin/local-admin-secret-token; wait for #records-table-body tr; target the first row; click Edit; change textarea to 'Updated by admin'; click Save; wait for #status-banner; reload page; wait for rows again.
    Expected: Status shows success; first row is locked again after save; reloaded first-row textarea/value still contains 'Updated by admin'.
    Evidence: .sisyphus/evidence/task-4-e2e-success.png

  Scenario: Locked row requires Edit before modification
    Tool: Playwright
    Steps: Open /admin/local-admin-secret-token; target the first row; attempt to interact with the locked textarea/select before clicking Edit.
    Expected: Browser test proves the interaction is blocked until Edit is used.
    Evidence: .sisyphus/evidence/task-4-e2e-locked.txt
  ```

  **Commit**: NO | Message: `test(admin): cover edit-first row workflow in browser` | Files: `test/e2e/admin-flow.spec.ts`

- [x] 5. Run the targeted regression bundle and record evidence

  **What to do**: Run the targeted admin regression suite and typecheck after tasks 1-4 complete. Capture evidence artifacts for the changed row-edit workflow and confirm no backend regression suites fail.
  **Must NOT do**: Do not skip typecheck. Do not rely on a manual browser spot-check as the only proof.

  **Recommended Agent Profile**:
  - Category: `unspecified-low` - Reason: command-driven regression validation and evidence capture
  - Skills: `[]` - existing project scripts are sufficient
  - Omitted: `["review-work"]` - final verification wave already covers review agents explicitly

  **Parallelization**: Can Parallel: NO | Wave 4 | Blocks: none | Blocked By: 1, 2, 3, 4

  **References** (executor has NO interview context - be exhaustive):
  - Config: `package.json` - script-driven validation entrypoints (`test`, `typecheck`, `test:e2e:admin`)
  - Test: `test/integration/admin-page-app.test.ts` - primary regression anchor for row state and save semantics
  - Test: `test/integration/admin-page-dom.test.ts` - DOM contract regression anchor
  - Test: `test/integration/admin-api.test.ts` - backend contract regression anchor
  - Test: `test/unit/admin-records.test.ts` - lower-level admin record regression anchor
  - Config: `playwright.config.ts` - browser regression runner

  **Acceptance Criteria** (agent-executable only):
  - [ ] `npm test -- test/integration/admin-page-app.test.ts` exits 0.
  - [ ] `npm test -- test/integration/admin-page-dom.test.ts` exits 0.
  - [ ] `npm test -- test/integration/admin-api.test.ts` exits 0.
  - [ ] `npm test -- test/unit/admin-records.test.ts` exits 0.
  - [ ] `npm run typecheck` exits 0.
  - [ ] `npm run test:e2e:admin` exits 0.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Full targeted admin regression bundle
    Tool: Bash
    Steps: Run the six acceptance-criteria commands in sequence from the repo root.
    Expected: Every command exits 0 with no skipped required suite.
    Evidence: .sisyphus/evidence/task-5-regression.txt

  Scenario: Diagnostics before final review
    Tool: lsp_diagnostics
    Steps: Run diagnostics on public/admin and test/e2e plus test/integration admin files after edits.
    Expected: No remaining error diagnostics in changed files.
    Evidence: .sisyphus/evidence/task-5-diagnostics.txt
  ```

  **Commit**: NO | Message: `test(admin): validate locked row editing regression bundle` | Files: `public/admin/*`, `test/integration/admin-*.test.ts`, `test/e2e/admin-flow.spec.ts`

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [x] F1. Plan Compliance Audit — oracle
- [x] F2. Code Quality Review — unspecified-high
- [x] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [x] F4. Scope Fidelity Check — deep

## Commit Strategy
- No git commit should be created unless the user explicitly asks for one.
- If the user later requests a commit, prefer a single green commit after Tasks 1-5 pass.
- Recommended message if requested: `update(admin): gate row edits behind explicit edit action`

## Success Criteria
- Admin rows are not editable on initial load.
- The action area shows `Edit`, `Save`, and `Delete`, with `Save` visible but disabled until edit mode starts.
- Clicking `Edit` on a row enables only that row's student/mentor/notes controls.
- Clicking `Save` after a real edit persists only changed fields and re-locks the row.
- Clicking `Save` after no changes makes no PATCH request and re-locks the row.
- Failed save attempts keep the row editable and preserve the attempted values.
- Existing admin PATCH/DELETE/export tests remain green without backend code changes.
