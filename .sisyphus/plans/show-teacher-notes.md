# Show Teacher Notes on Student Scan History

## TL;DR

> **Quick Summary**: Display mentor/teacher notes on the student scan history page with 10-second polling so notes appear automatically after the teacher saves them.
>
> **Deliverables**:
> - Notes field rendered in student history list items
> - 10-second polling for automatic history refresh
> - CSS styling for notes display
> - Tests for new behavior
>
> **Estimated Effort**: Short
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 1 (JS) → Task 3 (Tests); Task 2 (CSS) independent

---

## Context

### Original Request
As a teacher, after student scans QR code, attendance is set. Teacher adds notes, clicks save, notes update in database. Feature needed: show those notes in the student scan history after the notes are sent.

### Interview Summary
**Key Discussions**:
- Polling interval: User chose 10 seconds (auto-refresh)
- No backend changes needed — API already returns `notes` field
- Student page must auto-update when teacher saves notes

**Research Findings**:
- `GET /api/student/history` already returns `notes` in each history entry
- `normalizeHistory()` at `app.js:175` discards `notes` — only keeps `mentorName`, `scannedAt`
- `renderHistorySuccess()` at `app.js:197` only renders mentor name + timestamp
- No polling exists on student page currently
- `notes TEXT NOT NULL DEFAULT ''` — always a string, never null
- Student page is mobile-first, single-column layout

### Metis Review
**Identified Gaps** (addressed):
- Concurrent `loadHistory` calls during polling: Added guard with `AbortController`
- XSS via notes: Must use `textContent`, never `innerHTML`
- Long notes breaking mobile layout: Added `word-break: break-word`
- Page Visibility API: Pause polling when page hidden
- Network errors during poll: Swallow silently, retry on next interval
- Scroll position reset on `replaceChildren()`: Accepted for v1 (short lists)

---

## Work Objectives

### Core Objective
Show teacher/mentor notes on the student scan history page with automatic 10-second polling refresh.

### Concrete Deliverables
- Modified `public/student/app.js` — notes rendering + 10s polling
- Modified `public/student/styles.css` — notes styling
- New/updated test coverage for notes rendering and polling behavior

### Definition of Done
- [ ] `npm test` passes — all existing + new tests green
- [ ] Student history shows notes when present, hides when empty
- [ ] Polling refreshes history every 10s when page visible
- [ ] Polling pauses when page hidden
- [ ] No backend files modified

### Must Have
- Notes displayed in student history when present
- 10-second polling with Page Visibility API guard
- Concurrent request protection (no double-render)
- XSS-safe rendering (textContent only)
- Word-break for long notes

### Must NOT Have (Guardrails)
- No backend/route/DB changes
- No `index.html` modifications — no new element IDs
- No `innerHTML` usage — XSS risk
- No animations/transitions for notes appearance
- No new CSS custom properties — use existing variables
- No notification/push/SSE — polling only
- No modification to student API contract in `src/worker/routes/student.ts`
- No changes to `test/integration/student-api.test.ts` behavior assertions

---

## Verification Strategy

> Zero human intervention. All verification is agent-executed.

### Test Decision
- **Infrastructure exists**: YES (vitest)
- **Automated tests**: YES (tests-after)
- **Framework**: vitest

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Frontend/UI**: Use Playwright (playwright skill) - Navigate, interact, assert DOM, screenshot
- **JS Logic**: Use Bash (node/vitest) - Run tests, verify output

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately - core changes, MAX PARALLEL):
├── Task 1: JS logic — normalizeHistory + renderHistorySuccess + polling [deep]
├── Task 2: CSS styling for .history-notes [quick]
└── Task 3: Add tests for notes rendering + polling [unspecified-high]

Wave FINAL (After ALL tasks — 4 parallel reviews, then user okay):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)
-> Present results -> Get explicit user okay

Critical Path: Task 1 → Task 3
Parallel Speedup: Tasks 1, 2, 3 run in parallel
Max Concurrent: 3
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| 1    | -         | F1-F4  | 1    |
| 2    | -         | F1-F4  | 1    |
| 3    | -         | F1-F4  | 1    |

### Agent Dispatch Summary

- **Wave 1**: **3** - T1 → `deep`, T2 → `quick`, T3 → `unspecified-high`
- **FINAL**: **4** - F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

- [x] 1. JS Logic — Preserve notes + Render notes + Add 10s polling

  **What to do**:

  **Part A — Preserve `notes` in `normalizeHistory()`** (`public/student/app.js:175`):
  - Add `notes: entry.notes || ''` to the object returned by `normalizeHistory()` mapper
  - Follow existing defensive extraction pattern (check `entry.notes`, `entry.note` fallbacks)

  **Part B — Render notes in `renderHistorySuccess()`** (`public/student/app.js:211-226`):
  - After the `history-meta` span in each `<li>`, conditionally append a notes element
  - Only create and append `.history-notes` span when `entry.notes` is non-empty (truthy check — empty string `''` is falsy)
  - Use `textContent` (NEVER `innerHTML`) to set notes content — XSS prevention
  - Follow existing `createElement` + `className` + `textContent` + `append` pattern

  **Part C — Add 10-second polling** (`public/student/app.js`):
  - Add a `let historyPollTimer = null` variable alongside existing state variables (near line 54)
  - Create `function startHistoryPoll()` that sets `setInterval` at 10000ms calling `loadHistory()`
  - Create `function stopHistoryPoll()` that clears the interval
  - Start polling after first successful `loadHistory()` completes (in `renderHistorySuccess` when history has items, or after identity loads)
  - Stop polling on `pagehide` event — extend existing listener at line 72: `window.addEventListener('pagehide', () => { destroyScanner(); stopHistoryPoll(); })`
  - Add `visibilitychange` listener: pause polling when `document.visibilityState === 'hidden'`, resume when `'visible'`
  - Guard against concurrent `loadHistory()` calls: add `let historyLoading = false` flag — set true at start of `loadHistory()`, false in finally block. Skip fetch if already loading.

  **Part D — Swallow poll errors silently**:
  - In the polling interval callback, wrap `loadHistory()` in try/catch
  - Never surface poll errors to the user — only errors from user-initiated actions (scan, page load) should show

  **Must NOT do**:
  - Do NOT modify `index.html` — no new element IDs
  - Do NOT modify `src/worker/routes/student.ts` or any backend file
  - Do NOT use `innerHTML` anywhere
  - Do NOT add animations or transitions
  - Do NOT change the existing student API contract
  - Do NOT create new CSS custom properties

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Multiple interconnected JS changes across normalization, rendering, polling lifecycle, and concurrency guard. Requires careful understanding of existing patterns.
  - **Skills**: [`frontend-design`]
    - `frontend-design`: For understanding the student page design language and creating notes rendering that matches existing patterns
  - **Skills Evaluated but Omitted**:
    - `test-driven-development`: Tests handled in separate Task 3

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: F1-F4
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `public/student/app.js:175-179` — `normalizeHistory()` mapper — current pattern to extend with `notes` field
  - `public/student/app.js:211-226` — `renderHistorySuccess()` `<li>` creation — pattern for creating child elements with `createElement` + `className` + `textContent` + `append`
  - `public/student/app.js:72` — `pagehide` listener — extend to call `stopHistoryPoll()`
  - `public/student/app.js:54-59` — State variables location — add polling timer and loading flag here
  - `public/student/app.js:122-143` — `loadHistory()` function — add concurrency guard and polling trigger

  **API References**:
  - `src/worker/routes/student.ts:162-198` — Student history handler — confirms `notes` is already returned in response (no changes needed)

  **Test References**:
  - `test/integration/student-page-dom.test.ts:22-51` — DOM contract test for required IDs — must still pass after changes

  **External References**:
  - MDN Page Visibility API: `document.visibilityState` and `visibilitychange` event
  - MDN `setInterval` / `clearInterval`

  **WHY Each Reference Matters**:
  - `normalizeHistory` at line 175: This is WHERE to add `notes` field — copy the defensive extraction pattern
  - `renderHistorySuccess` at line 211: This is WHERE to render notes — follow the exact `createElement` pattern
  - `pagehide` at line 72: This is WHERE to stop polling on page teardown
  - `loadHistory` at line 122: This is WHERE to add concurrency guard and WHERE polling can trigger refresh
  - Student route at line 162: Confirms API already returns notes — no backend work needed

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Notes appear in student history when present
    Tool: Playwright
    Preconditions: Dev server running, seeded data with mentor notes saved on scan record
    Steps:
      1. Navigate to http://localhost:8787/student/local-student-token-001
      2. Wait for history list to render (selector: `#history-list:not(.hidden)`)
      3. Check for `.history-notes` elements inside `#history-list li`
      4. Assert `.history-notes` textContent matches expected notes from seed data
    Expected Result: At least one `.history-notes` span visible with non-empty text
    Failure Indicators: No `.history-notes` elements found, or textContent is empty
    Evidence: .sisyphus/evidence/task-1-notes-visible.png

  Scenario: Empty notes do not render .history-notes element
    Tool: Playwright
    Preconditions: Dev server running, seeded data with scan record where notes=''
    Steps:
      1. Navigate to student page
      2. Wait for history list to render
      3. For each `<li>` in history, check if `.history-notes` child exists
      4. Verify: entries with empty notes have NO `.history-notes` child
    Expected Result: `<li>` items with empty notes have only `.history-name` and `.history-meta` children
    Failure Indicators: `.history-notes` element exists with empty string
    Evidence: .sisyphus/evidence/task-1-empty-notes-hidden.png

  Scenario: Polling refreshes history every 10 seconds
    Tool: Playwright
    Preconditions: Dev server running, student page loaded with history
    Steps:
      1. Navigate to student page, wait for history to load
      2. Note current history list content (screenshot)
      3. In a separate request, use mentor API to save notes: POST /mentor/{token}/api/notes/{scanId} with body {notes: "Test poll note"}
      4. Wait 12 seconds (polling interval + buffer)
      5. Check if `.history-notes` element now appears with "Test poll note"
    Expected Result: Notes appear in history without page refresh
    Failure Indicators: Notes do not appear after 12 seconds
    Evidence: .sisyphus/evidence/task-1-polling-works.png

  Scenario: Concurrent loadHistory calls are guarded
    Tool: Bash (curl)
    Preconditions: Dev server running
    Steps:
      1. Open student page
      2. Rapidly trigger scan + poll (within 10s window)
      3. Check browser console for errors or double-render artifacts
    Expected Result: No duplicate DOM operations, no unhandled promise rejections
    Failure Indicators: Multiple overlapping fetch calls, UI flicker
    Evidence: .sisyphus/evidence/task-1-concurrent-guard.txt
  ```

  **Commit**: YES
  - Message: `feat(student): show mentor notes in scan history with 10s polling`
  - Files: `public/student/app.js`
  - Pre-commit: `rtk npx vitest run`

- [x] 2. CSS Styling for `.history-notes`

  **What to do**:
  - Add `.history-notes` class styles to `public/student/styles.css`
  - Style: muted text color (use existing CSS variable like `var(--muted)` if available, or a similar subdued color), italic font style for visual distinction from `history-meta`
  - Add `word-break: break-word` to prevent long notes from breaking mobile layout
  - Add `margin-top: 4px` (or similar small spacing) to separate from `history-meta`
  - Add `font-size` slightly smaller than `history-meta` (e.g., 0.85em or matching existing small-text pattern)
  - Place the new rules near existing `.history-meta` styles in `styles.css`

  **Must NOT do**:
  - Do NOT create new CSS custom properties — use existing variables/colors
  - Do NOT add animations or transitions
  - Do NOT modify any HTML files
  - Do NOT use colors outside the project's design language (restrained green/orange, clean interface)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small, scoped CSS addition — single class with 4-5 properties
  - **Skills**: [`frontend-design`]
    - `frontend-design`: For matching existing design language and color palette
  - **Skills Evaluated but Omitted**:
    - `test-driven-development`: No test infrastructure for CSS

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: F1-F4
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `public/student/styles.css` — Find `.history-meta` styles — place new `.history-notes` rules adjacent
  - `public/student/styles.css` — Find existing color variables (e.g., `var(--muted)`, `var(--text-secondary)`) — reuse for notes color

  **WHY Each Reference Matters**:
  - `.history-meta` styles: The new `.history-notes` should be visually similar but distinct — slightly smaller, italic
  - Existing CSS variables: Must use project's existing color system, not invent new colors

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Notes styled correctly in student history
    Tool: Playwright
    Preconditions: Dev server running, student page with history containing notes
    Steps:
      1. Navigate to student page, wait for history to load
      2. Find `.history-notes` element
      3. Assert computed style: `font-style` includes 'italic'
      4. Assert computed style: `word-break` is 'break-word'
      5. Assert font-size is smaller than `.history-meta` font-size
    Expected Result: Notes text is italic, muted color, smaller than meta text
    Failure Indicators: Notes appear same size/style as mentor name or timestamp
    Evidence: .sisyphus/evidence/task-2-notes-styling.png

  Scenario: Long notes don't break mobile layout
    Tool: Playwright
    Preconditions: Dev server running, scan record with 500-char notes string
    Steps:
      1. Navigate to student page, wait for history to load
      2. Check `.history-notes` element width does not exceed viewport
      3. Text wraps properly (not overflowing container)
    Expected Result: Long notes wrap within card boundaries, no horizontal scroll
    Failure Indicators: Horizontal scrollbar appears, text overflows card
    Evidence: .sisyphus/evidence/task-2-long-notes-layout.png
  ```

  **Commit**: YES (groups with Task 1)
  - Message: `feat(student): show mentor notes in scan history with 10s polling`
  - Files: `public/student/styles.css`
  - Pre-commit: `rtk npx vitest run`

- [x] 3. Tests for notes rendering and polling behavior

  **What to do**:

  **Part A — DOM contract test update** (`test/integration/student-page-dom.test.ts`):
  - Verify existing test still passes — no new element IDs were added to `index.html`, so the "required IDs" test should pass unchanged
  - Run `rtk vitest run -- test/integration/student-page-dom.test.ts` to confirm

  **Part B — Add tests for `normalizeHistory` notes preservation** (new test file or extend existing):
  - Test: `normalizeHistory({history: [{mentorName: 'Mentor A', scannedAt: '2026-01-15T10:00:00Z', notes: 'Great work'}]})` returns objects with `notes: 'Great work'`
  - Test: `normalizeHistory({history: [{mentorName: 'Mentor B', scannedAt: '2026-01-15T10:00:00Z', notes: ''}]})` returns objects with `notes: ''`
  - Test: `normalizeHistory({history: [{mentorName: 'Mentor C', scannedAt: '2026-01-15T10:00:00Z'}]})` (missing notes) returns objects with `notes: ''`

  **Part C — API test for notes in history response** (`test/integration/student-api.test.ts`):
  - Verify existing test coverage — the history endpoint test should already assert response shape
  - Add assertion that `notes` field is present in history entries if not already tested

  **Part D — Verify all existing tests pass**:
  - Run full test suite: `rtk npx vitest run`
  - All existing tests must pass without modification

  **Must NOT do**:
  - Do NOT modify `test/integration/student-api.test.ts` assertions that test backend behavior (backend unchanged)
  - Do NOT add new element IDs to `index.html` to make tests pass
  - Do NOT change the DOM contract test's required IDs list (no HTML changes)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Requires reading existing test patterns, understanding vitest conventions in the project, and adding focused test coverage
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `test-driven-development`: Tests are being added after implementation (Task 1), not TDD
    - `frontend-design`: No UI work in this task

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: F1-F4
  - **Blocked By**: None

  **References**:

  **Test References**:
  - `test/integration/student-page-dom.test.ts` — DOM contract test — verify no IDs added, confirm still passes
  - `test/integration/student-api.test.ts` — API integration tests — check if `notes` is already asserted in history response
  - `test/support/mock-d1.ts` — Mock D1 database helper — use for setting up test data
  - `test/support/real-roster.ts` — Real seed data constants — use for test student/mentor identities

  **Source References**:
  - `public/student/app.js:165-180` — `normalizeHistory()` — the function to test
  - `src/worker/routes/student.ts:162-198` — History route handler — confirms response shape

  **WHY Each Reference Matters**:
  - DOM contract test: Must verify our changes don't break the required IDs assertion
  - API tests: Need to know if `notes` is already tested in history response, or if we need to add that assertion
  - `normalizeHistory`: The core function we're testing — notes preservation

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: All existing tests pass after changes
    Tool: Bash
    Preconditions: Tasks 1 and 2 completed
    Steps:
      1. Run `rtk npx vitest run`
      2. Assert exit code 0
      3. Check output for "X tests passed, 0 failed"
    Expected Result: All tests pass, zero failures
    Failure Indicators: Any test failure or non-zero exit code
    Evidence: .sisyphus/evidence/task-3-all-tests-pass.txt

  Scenario: normalizeHistory preserves notes field
    Tool: Bash (vitest)
    Preconditions: New test file created with normalizeHistory tests
    Steps:
      1. Run `rtk vitest run -- test/unit/normalize-history.test.ts` (or wherever tests are placed)
      2. Assert tests pass: notes preserved, empty notes handled, missing notes default to ''
    Expected Result: 3+ tests pass covering notes preservation edge cases
    Failure Indicators: Any test failure in notes-related tests
    Evidence: .sisyphus/evidence/task-3-notes-tests.txt

  Scenario: DOM contract test still passes
    Tool: Bash
    Steps:
      1. Run `rtk vitest run -- test/integration/student-page-dom.test.ts`
      2. Assert exit code 0
    Expected Result: All DOM contract tests pass (page heading, section order, required IDs)
    Failure Indicators: Any failure — means HTML was modified or IDs removed
    Evidence: .sisyphus/evidence/task-3-dom-contract.txt
  ```

  **Commit**: YES (groups with Tasks 1, 2)
  - Message: `feat(student): show mentor notes in scan history with 10s polling`
  - Files: test files
  - Pre-commit: `rtk npx vitest run`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  Run `rtk npx vitest run` + `rtk npx tsc --noEmit`. Review all changed files for: `innerHTML` usage (must not exist), console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names.
  Output: `Build [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [x] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill)
  Start local dev server. Open student page with seeded data where a mentor has saved notes. Verify: notes appear in history list, notes styling is readable, empty notes don't show empty element. Trigger a scan and verify polling works. Test: page hidden → no polling, page visible → polling resumes.
  Output: `Scenarios [N/N pass] | Integration [N/N] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff. Verify 1:1 — everything in spec was built, nothing beyond spec. Check "Must NOT do" compliance. Confirm zero backend files modified. Confirm `index.html` untouched. Confirm `innerHTML` not used anywhere.
  Output: `Tasks [N/N compliant] | Backend Modified [CLEAN] | HTML Modified [CLEAN] | VERDICT`

---

## Commit Strategy

- **Wave 1**: `feat(student): show mentor notes in scan history with 10s polling` - public/student/app.js, public/student/styles.css, test/

---

## Success Criteria

### Verification Commands
```bash
rtk npx vitest run                           # Expected: all tests pass
rtk npx tsc --noEmit                         # Expected: no type errors
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All tests pass
- [ ] No backend files modified
- [ ] No `index.html` changes
- [ ] No `innerHTML` usage
