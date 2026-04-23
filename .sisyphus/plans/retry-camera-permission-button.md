# Retry Camera Permission Button

## TL;DR
> **Summary**: Add a new dedicated `Retry camera permission` button directly below the `Camera scanner` header on the student page. Keep the existing `#scanner-toggle-button` in `.scanner-actions`, and wire the new button only to permission-denied recovery without changing backend/API behavior.
> **Deliverables**:
> - new scanner-header retry button in `public/student/index.html`
> - mobile-first styling for the new header action in `public/student/styles.css`
> - permission-state-only button visibility/behavior in `public/student/app.js`
> - DOM/runtime tests covering placement and permission-denied retry behavior
> **Effort**: Short
> **Parallel**: NO
> **Critical Path**: 1 → 2 → 3 → F1-F4

## Context
### Original Request
- Put the `retry camera permission` control below the `Camera scanner` header.
- User explicitly chose a **new dedicated button**, not moving/reusing the existing scanner toggle.

### Interview Summary
- Student page must remain mobile-first and sequential: identity → scanner → history.
- Current scanner UI lives in `public/student/index.html:42-99`.
- Current camera state machine lives in `public/student/app.js:354-680`.
- Current DOM contract is locked in `test/integration/student-page-dom.test.ts:4-95`.
- There is no dedicated permission-retry button today; current retry/start behavior is reused through `#scanner-toggle-button`.

### Metis Review (gaps addressed)
- Guardrail: `startScanner()` and `loadIdentity()` are high-coupling nodes; avoid broad scanner-flow rewrites.
- Scope control: do not touch backend/API or history/fallback flows.
- Acceptance gap resolved: define exact visibility rules for the new button instead of leaving them to implementer judgment.

## Work Objectives
### Core Objective
Add a dedicated `Retry camera permission` CTA under the scanner header that helps students recover from an accidentally dismissed/denied camera prompt, while preserving the existing scanner toggle, fallback-code flow, and student page order.

### Deliverables
- `public/student/index.html` updated with a new dedicated retry button below the scanner header and above the scanner stage.
- `public/student/styles.css` updated so the new button fits the mobile-first scanner card cleanly.
- `public/student/app.js` updated so the new button is hidden by default, shown only in permission-denied state, and retries camera startup without affecting unrelated scanner states.
- `test/integration/student-page-dom.test.ts` updated to lock the new DOM hook and placement.
- A runtime/integration test covering permission-denied visibility and retry behavior (prefer `test/integration/student-page-app.test.ts` if absent, create it).

### Definition of Done (verifiable conditions with commands)
- New button exists below the `Camera scanner` header and above `#scanner-stage`.
- Existing `#scanner-toggle-button` remains in `.scanner-actions`.
- New button is hidden on initial page load and all non-permission-denied states.
- New button becomes visible only after the scanner enters permission-denied state.
- Clicking the new button re-invokes camera start flow without calling `loadIdentity()` or changing API URLs.
- DOM and runtime tests pass.
- Typecheck passes.

### Must Have
- Keep student card order exactly identity → scanner → history.
- Keep existing IDs/hook names intact; add one new stable hook for the new button.
- Keep fallback reveal/form behavior unchanged.
- Keep `#scanner-toggle-button` semantics intact for normal start/stop flows.
- Keep all API interactions limited to existing student endpoints.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- Must NOT change `src/worker/routes/student.ts` or any backend contract.
- Must NOT move fallback-code controls above the scanner actions.
- Must NOT reuse `retry-button` / `history-retry-button` behavior for camera permission.
- Must NOT show the new retry button during loading, scanning, processing, camera-unavailable, or generic scanner-error states.
- Must NOT rename or remove existing DOM hooks relied on by `public/student/app.js` or current tests.

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed.
- Test decision: tests-after + existing Vitest integration coverage
- QA policy: Every task has agent-executed scenarios
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks for max parallelism.

Wave 1: lock DOM/runtime contract for the new permission-retry control
Wave 2: implement DOM + styles + JS visibility/handler wiring
Wave 3: run focused verification and finalize evidence

### Dependency Matrix (full, all tasks)
- Task 1 blocks Task 2
- Task 2 blocks Task 3
- Task 3 blocks F1-F4

### Agent Dispatch Summary (wave → task count → categories)
- Wave 1 → 1 task → quick
- Wave 2 → 1 task → visual-engineering
- Wave 3 → 1 task → quick
- Final Verification → 4 tasks → oracle, unspecified-high, deep

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [x] 1. Lock the new student scanner DOM/runtime contract

  **What to do**: Update `test/integration/student-page-dom.test.ts` so the new button hook is required and its placement is locked between the `Camera scanner` heading and `#scanner-stage`. Add/extend a student runtime test so permission-denied state shows the new button, normal states hide it, and clicking it re-enters scanner startup. If no student runtime test file exists, create `test/integration/student-page-app.test.ts` with a minimal fake DOM/runtime harness focused only on scanner-button behavior.
  **Must NOT do**: Do not change API tests. Do not add Playwright/browser-level permission tests. Do not over-test unrelated student identity/history flows.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: focused test contract update in a small set of files
  - Skills: [`test-driven-development`] - why needed: test-first change with explicit RED/GREEN cycle
  - Omitted: [`frontend-design`] - why not needed: this task locks behavior, not styling decisions

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: [2, 3] | Blocked By: []

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `test/integration/student-page-dom.test.ts:4-95` - existing DOM contract style and card-order assertions
  - Pattern: `public/student/index.html:42-99` - exact scanner card structure to lock in tests
  - Pattern: `public/student/app.js:69-87` - event listener registration area for button hooks
  - Pattern: `public/student/app.js:642-658` - permission-denied and generic scanner-error states to distinguish in tests
  - Test: `test/integration/admin-page-app.test.ts` - if a student runtime harness is needed, mirror this style instead of inventing a new testing pattern

  **Acceptance Criteria** (agent-executable only):
  - [ ] `rtk test npx vitest run test/integration/student-page-dom.test.ts` fails before implementation and passes after implementation
  - [ ] Runtime test file verifies visibility rules and retry click behavior for the new button

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: DOM contract locks new button placement
    Tool: Bash
    Steps: Run `rtk test npx vitest run test/integration/student-page-dom.test.ts`
    Expected: Test suite passes and includes assertion that the new button exists after the scanner header and before `#scanner-stage`
    Evidence: .sisyphus/evidence/task-1-student-dom-test.txt

  Scenario: Permission-denied runtime shows dedicated retry control only in that state
    Tool: Bash
    Steps: Run `rtk test npx vitest run test/integration/student-page-app.test.ts`
    Expected: Runtime test passes and proves the new button is hidden in normal state, shown after permission denial, and click re-enters scanner-start path
    Evidence: .sisyphus/evidence/task-1-student-runtime-test.txt
  ```

  **Commit**: NO | Message: `feat(student): add dedicated camera permission retry CTA` | Files: `test/integration/student-page-dom.test.ts`, `test/integration/student-page-app.test.ts`

- [x] 2. Add and wire the dedicated retry-camera-permission button

  **What to do**:
  - In `public/student/index.html`, insert a new button directly below `<h2 class="card-label">Camera scanner</h2>` and before `.scanner-stage`, with a stable id such as `scanner-permission-retry-button`, label text exactly `Retry camera permission`, and `hidden` class by default.
  - In `public/student/styles.css`, add a small scanner-header action style that keeps the button aligned with the card’s top flow on desktop and full-width on mobile; do not disturb `.scanner-actions` layout.
  - In `public/student/app.js`, add the new element to `elements`, register a click listener that calls `startScanner()` directly, and centralize visibility through a helper such as `setScannerPermissionRetryVisible(isVisible)`.
  - Call the visibility helper from every scanner UI state setter so the new button is hidden in loading, starting, scanning, processing, stopped, unavailable, locked, and generic error states, and visible only inside `setScannerPermissionDenied(...)`.
  - Keep `#scanner-toggle-button` in `.scanner-actions` with existing start/stop semantics.
  **Must NOT do**: Do not call `loadIdentity()` from the new button. Do not show the new button for non-permission failures. Do not move `#scanner-toggle-button` out of `.scanner-actions`.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - Reason: mixed DOM/CSS/JS UI behavior change in the student scanner card
  - Skills: [`frontend-design`] - why needed: preserve clean mobile-first placement and visual hierarchy
  - Omitted: [`test-driven-development`] - why not needed: tests are already locked in Task 1

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: [3] | Blocked By: [1]

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `public/student/index.html:42-68` - scanner card header, stage, and action stack; new button belongs between line 43 and line 45
  - Pattern: `public/student/styles.css:188-277` - scanner card and existing scanner action styling
  - Pattern: `public/student/styles.css:344-374` - mobile width behavior for scanner controls
  - API/Type: `public/student/app.js:4-31` - element lookup map
  - API/Type: `public/student/app.js:69-87` - event listener wiring pattern
  - API/Type: `public/student/app.js:596-666` - scanner state-setter cluster where visibility logic must stay centralized
  - API/Type: `public/student/app.js:413-465` - `startScanner()` permission-denied branch to target with the new CTA

  **Acceptance Criteria** (agent-executable only):
  - [ ] Student DOM contains one new retry button id below the scanner header and above `#scanner-stage`
  - [ ] New button is hidden by default and becomes visible only in permission-denied state
  - [ ] Clicking the new button calls scanner startup logic without triggering identity/history reloads
  - [ ] Existing scanner toggle remains inside `.scanner-actions`

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Scanner card shows new dedicated retry CTA in correct location
    Tool: Bash
    Steps: Run `rtk test npx vitest run test/integration/student-page-dom.test.ts`
    Expected: DOM test passes with the new button placed under the scanner header and above the stage, while fallback reveal remains below scanner controls
    Evidence: .sisyphus/evidence/task-2-student-dom-pass.txt

  Scenario: Permission denial reveals only the dedicated retry CTA
    Tool: Bash
    Steps: Run `rtk test npx vitest run test/integration/student-page-app.test.ts`
    Expected: Runtime test passes and shows permission-denied state reveals the new button, while generic scanner error/unavailable states keep it hidden
    Evidence: .sisyphus/evidence/task-2-student-runtime-pass.txt
  ```

  **Commit**: NO | Message: `feat(student): add camera permission retry button` | Files: `public/student/index.html`, `public/student/styles.css`, `public/student/app.js`

- [x] 3. Verify student scanner change stays within v1 UI scope

  **What to do**: Run focused verification for the student page after implementation. Confirm DOM/runtime tests pass, run typecheck, and inspect that no backend files were touched. If a runtime harness was introduced, keep it minimal and scoped to scanner permission behavior only.
  **Must NOT do**: Do not broaden verification into unrelated admin flows. Do not change docs unless the user separately requests docs updates.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: focused verification and scope audit
  - Skills: [] - why needed: none
  - Omitted: [`frontend-design`] - why not needed: no new UI decisions here

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: [F1, F2, F3, F4] | Blocked By: [2]

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `docs/implementation/mentor-student-qr-attendance-v1-plan.md` - student page remains mobile-first and sequential
  - Pattern: `docs/prd/mentor-student-qr-attendance-v1.md` - student flow remains camera scan + feedback + same-day history
  - Test: `test/integration/student-page-dom.test.ts:4-95` - required DOM order and hooks
  - Test: `test/integration/student-api.test.ts` - should remain untouched because change is frontend-only

  **Acceptance Criteria** (agent-executable only):
  - [ ] `rtk test npx vitest run test/integration/student-page-dom.test.ts test/integration/student-page-app.test.ts` passes
  - [ ] `rtk tsc --noEmit` passes
  - [ ] `rtk git diff -- public/student/index.html public/student/styles.css public/student/app.js test/integration/student-page-dom.test.ts test/integration/student-page-app.test.ts` shows only intended frontend/test changes

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Focused student verification remains green
    Tool: Bash
    Steps: Run `rtk test npx vitest run test/integration/student-page-dom.test.ts test/integration/student-page-app.test.ts`; then run `rtk tsc --noEmit`
    Expected: All targeted tests pass and TypeScript compilation completes without errors
    Evidence: .sisyphus/evidence/task-3-student-verify.txt

  Scenario: Scope audit confirms frontend-only change set
    Tool: Bash
    Steps: Run `rtk git diff -- public/student/index.html public/student/styles.css public/student/app.js test/integration/student-page-dom.test.ts test/integration/student-page-app.test.ts`
    Expected: Diff is limited to student frontend files and targeted tests; no backend/API file changes appear
    Evidence: .sisyphus/evidence/task-3-student-diff.txt
  ```

  **Commit**: NO | Message: `test(student): verify camera permission retry flow` | Files: `public/student/*`, `test/integration/student-page-*.test.ts`

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [ ] F1. Plan Compliance Audit — oracle
- [ ] F2. Code Quality Review — unspecified-high
- [ ] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [ ] F4. Scope Fidelity Check — deep

## Commit Strategy
- No commit unless the user explicitly requests one.
- If the user later asks for a commit, use a single frontend-focused commit after Task 3 and before the final verification wave, with message: `feat(student): add camera permission retry button`.

## Success Criteria
- Students see a dedicated `Retry camera permission` button directly below the `Camera scanner` header.
- The new button appears only when permission denial is the problem.
- The existing scanner toggle still handles normal start/stop behavior in `.scanner-actions`.
- Student page order, fallback-code flow, history flow, and backend/API behavior remain unchanged.
- Targeted DOM/runtime tests and typecheck pass.
