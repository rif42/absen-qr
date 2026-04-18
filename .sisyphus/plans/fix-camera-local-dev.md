# Fix Camera on Local Dev (LAN IP)

## TL;DR

> **Quick Summary**: `window.isSecureContext` is `false` on LAN IPs like `192.168.106.158`, causing `prepareScanner()` to permanently lock the scanner as `unavailable`. Add a dev hostname bypass so local development works without HTTPS.
>
> **Deliverables**: Modified `public/student/app.js`
> **Estimated Effort**: Quick (< 15 min)
> **Parallel Execution**: NO — single task
> **Critical Path**: Task 1 only

---

## Context

### Original Request
Camera won't open when testing locally at `http://192.168.106.158:8787/`. Root cause traced to `app.js` line 250: `if (!window.isSecureContext)` blocks camera init on non-HTTPS URLs, and `setScannerUnavailable()` sets `scannerAvailability = 'unavailable'` with no recovery.

### Metis Review
**Identified Gaps** (addressed):
- Gap: Hardcoding a single IP is fragile. **Resolved**: Use `isDevHostname()` matching all RFC1918 private ranges.
- Gap: State recovery (Fix 2) is unnecessary. **Resolved**: Dropped — if `isSecureContext` is bypassed for dev, `'unavailable'` only fires on genuine hardware failures where retry is pointless.
- Gap: Risk of production leak. **Resolved**: Production uses HTTPS on Workers; this bypass only applies to known dev hostnames.

---

## Work Objectives

### Core Objective
Allow the student scanner to initialize on local development hostnames (`localhost`, `127.0.0.1`, `::1`, and RFC1918 private IPs) even when `window.isSecureContext` is `false`.

### Concrete Deliverables
- `public/student/app.js` — add `isDevHostname()` helper, relax `isSecureContext` guard

### Definition of Done
- [ ] Scanner proceeds past `prepareScanner()` on `http://192.168.106.158:8787/student/:token`
- [ ] Non-dev HTTP IPs still show the "requires HTTPS" message
- [ ] All existing tests pass

### Must Have
- Single-file change in `app.js`
- No test file modifications
- No server-side changes

### Must NOT Have (Guardrails)
- Do NOT hardcode `192.168.106.158`
- Do NOT add state recovery from `'unavailable'`
- Do NOT modify any file besides `public/student/app.js`

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (Vitest)
- **Automated tests**: Tests-after (run existing suite, no new tests needed)
- **Framework**: vitest

### QA Policy
Agent-executed QA scenarios for the single task.

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Single task):
└── Task 1: Add dev hostname bypass for isSecureContext guard
```

### Dependency Matrix
- **1**: - - -

### Agent Dispatch Summary
- **1**: **1** — T1 → `quick`

---

## TODOs

- [x] 1. Add `isDevHostname()` helper and relax `isSecureContext` guard

  **What to do**:
  - Add `isDevHostname(hostname)` function inside the IIFE, after the `elements` object (~line 31), before state variables.
  - The function returns `true` for:
    - `'localhost'`
    - `'127.0.0.1'`
    - `'[::1]'` or `::1`
    - `192.168.x.x` (RFC1918 Class C)
    - `10.x.x.x` (RFC1918 Class A)
    - `172.16.x.x` through `172.31.x.x` (RFC1918 Class B)
  - Change line 250 from:
    ```js
    if (!window.isSecureContext) {
    ```
    to:
    ```js
    if (!window.isSecureContext && !isDevHostname(location.hostname)) {
    ```
  - Leave the existing error message unchanged.

  **Must NOT do**:
  - Do NOT modify any other guard (`navigator.mediaDevices`, `hasCamera`, etc.)
  - Do NOT add state recovery logic
  - Do NOT touch `index.html`, `styles.css`, or any server file

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single-file, ~6 lines of new code, 1 line changed
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential only
  - **Blocks**: None
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `public/student/app.js:31-40` — Add the helper after `elements` object, before `studentPath`
  - `public/student/app.js:245-289` — `prepareScanner()` function; only modify the guard at line 250

  **WHY Each Reference Matters**:
  - `prepareScanner()`: This is the only function that needs changing. The `isSecureContext` guard at line 250 is the bottleneck.

  **Acceptance Criteria**:
  - [ ] `isDevHostname()` exists and covers localhost, 127.0.0.1, ::1, 10.*, 172.16-31.*, 192.168.*
  - [ ] Line 250 reads `if (!window.isSecureContext && !isDevHostname(location.hostname))`

  **QA Scenarios**:

  ```
  Scenario: Dev hostname bypass works (happy path)
    Tool: Bash (curl + grep on served HTML/JS)
    Preconditions: `npm run dev` running
    Steps:
      1. Open `http://192.168.106.158:8787/student/local-student-token-001` in browser
      2. Open DevTools console, verify `window.isSecureContext === false`
      3. Set breakpoint at app.js line 255 (after the guard)
      4. Reload page, confirm breakpoint is hit (guard was passed)
    Expected Result: Execution reaches line 255; scanner continues to `setScannerLoading()` instead of `setScannerUnavailable()`
    Failure Indicators: Guard still rejects and shows "requires HTTPS" message
    Evidence: .sisyphus/evidence/task-1-dev-hostname-bypass.png

  Scenario: Non-dev HTTP IP still blocked (negative)
    Tool: Browser DevTools
    Preconditions: Same dev server
    Steps:
      1. Edit `/etc/hosts` or use a non-private IP to access the page (e.g., bind to a public IP if available, or use a fake hostname)
      2. Open the page via that non-private hostname over HTTP
      3. Verify scanner placeholder shows "Camera scanning requires HTTPS or localhost."
    Expected Result: `setScannerUnavailable()` is called; button stays disabled
    Failure Indicators: Bypass fires for non-dev hostnames (security regression)
    Evidence: .sisyphus/evidence/task-1-non-dev-blocked.png

  Scenario: Existing tests still pass (regression)
    Tool: Bash
    Preconditions: None
    Steps:
      1. Run `rtk npx vitest run`
    Expected Result: All tests pass (0 failures)
    Failure Indicators: Any test failure
    Evidence: Terminal output screenshot saved to .sisyphus/evidence/task-1-tests-pass.txt
  ```

  **Evidence to Capture**:
  - [ ] DevTools breakpoint screenshot showing guard bypassed
  - [ ] Terminal output of `vitest run`

  **Commit**: YES
  - Message: `fix(student): allow camera scanner on local dev hostnames`
  - Files: `public/student/app.js`

---

## Final Verification Wave

> Since this is a single-task plan, Final Verification collapses to the QA scenarios above. After Task 1 QA passes, present results to user for explicit okay.

- [x] F1. **Manual QA** — Confirm scanner initializes on `http://192.168.106.158:8787/student/local-student-token-001`
  Screenshot the scanner placeholder showing "Checking camera availability…" instead of "Camera unavailable."

---

## Commit Strategy

- **1**: `fix(student): allow camera scanner on local dev hostnames` — `public/student/app.js`, no pre-commit (no build step)

---

## Success Criteria

### Verification Commands
```bash
# Run existing tests
rtk npx vitest run
# Expected: all pass

# Manual check
# Open http://192.168.106.158:8787/student/local-student-token-001
# Expected: scanner placeholder shows "Checking camera availability…"
```

### Final Checklist
- [ ] `isDevHostname()` covers all RFC1918 ranges + localhost/127.0.0.1/::1
- [ ] Guard at line 250 uses the helper
- [ ] All existing tests pass
- [ ] Manual test on LAN IP succeeds
