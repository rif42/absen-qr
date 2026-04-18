# One-Time Fallback Code Contingency Plan

## TL;DR
> **Summary**: Add a secondary attendance path for camera failure: mentors generate a mentor-bound one-time code, students redeem it from their own secret link, and the system creates a normal attendance record immediately under the same duplicate/day rules as QR scans.
> **Deliverables**:
> - mentor fallback-code generation API + UI
> - student fallback-code redemption API + UI
> - persistence for short-lived codes and auditable entry method
> - admin visibility for fallback-created records without changing CSV column order
> - integration, DOM, and race-condition coverage
> **Effort**: Medium
> **Parallel**: YES - 3 waves
> **Critical Path**: 1 → 2 → 3/4/5 → 6

## Context
### Original Request
Create a contingency plan for when camera scan does not work: mentor generates a one-time code, student inputs it instead of scanning QR, code expires in 5 minutes, mentor can generate another code after expiry, assess potential abuse.

### Interview Summary
- Keep fallback secondary to QR scanning.
- Code is single-use only.
- Student page exposes fallback via a reveal button.
- Valid fallback redemption creates attendance immediately; no mentor confirmation step.
- Goal includes abuse resistance, not only happy-path functionality.

### Metis Review (gaps addressed)
- Resolved exact stale-code response default: generic `Invalid or expired fallback code.` for invalid, expired, replaced, or consumed codes.
- Resolved audit scope default: admin UI shows fallback origin marker; CSV remains unchanged to preserve locked v1 contract.
- Resolved code shape default: 8-digit numeric code, numeric-only input, spaces stripped client-side, exact 8 digits server-side.
- Added guardrails for brute-force throttling, one active code per mentor, atomic consume semantics, and explicit race-condition testing.

## Work Objectives
### Core Objective
Ship a narrow, abuse-aware fallback attendance mechanism that preserves existing student/mentor/admin flow semantics and locked v1 constraints.

### Deliverables
- Mentor-only fallback code issuance flow.
- Student fallback code redemption flow.
- D1 storage for active/expired/consumed mentor codes.
- Scan-record audit marker for QR vs fallback-code origin.
- Admin UI marker for fallback-created records.
- Test coverage for success, expiry, duplicate, malformed, throttled, and concurrent redemption cases.

### Definition of Done (verifiable conditions with commands)
- `npm test -- test/integration/student-api.test.ts` passes with fallback redemption coverage added.
- `npm test -- test/integration/mentor-api.test.ts` passes with mentor code issuance coverage added.
- `npm test -- test/integration/admin-api.test.ts` passes with fallback marker coverage added and locked CSV order unchanged.
- `npm test -- test/integration/student-page-dom.test.ts` passes with new fallback DOM hooks preserved.
- `npm test -- test/integration/mentor-page-dom.test.ts` passes with new mentor fallback DOM hooks preserved.
- `npm run typecheck` passes.

### Must Have
- One active fallback code per mentor at a time.
- Code expires 5 minutes after generation.
- Mentor cannot generate a second code while an unexpired active code exists.
- Code is single-use; first successful redemption consumes it.
- Student redeems from their own secret-link page only.
- Redemption creates a normal `scan_records` row immediately.
- Existing duplicate same-day student→mentor rule remains unchanged.
- Admin can distinguish fallback-created records from QR-created records in UI.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- No login/session/auth overhaul.
- No mentor confirmation step after redemption.
- No multi-use codes.
- No code sharing workflows like SMS, email, WhatsApp, clipboard handoff automation.
- No CSV column order changes.
- No new primary attendance path that competes visually with QR scanning.
- No admin-created fallback attendance shortcut.

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed.
- Test decision: tests-after + existing Vitest integration/DOM suites.
- QA policy: Every task includes agent-executed happy + failure scenarios.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks for max parallelism.

Wave 1: schema/types + mentor issuance API
Wave 2: student redemption API + mentor UI + student UI
Wave 3: admin marker + cross-suite hardening

### Dependency Matrix (full, all tasks)
- 1 blocks 2, 3, 4, 5, 6
- 2 blocks 4
- 3 blocks 5, 6
- 4 blocks 6
- 5 blocks 6
- 6 depends on 1, 3, 4, 5

### Agent Dispatch Summary (wave → task count → categories)
- Wave 1 → 2 tasks → `deep`, `quick`
- Wave 2 → 3 tasks → `deep`, `visual-engineering`, `quick`
- Wave 3 → 1 task → `deep`

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [x] 1. Add fallback-code persistence and audit model

  **What to do**: Create D1 storage for mentor fallback codes plus scan audit origin. Add a new table such as `mentor_fallback_codes` with columns: `fallback_code_id`, `mentor_id`, `code_value`, `created_at`, `expires_at`, `consumed_at`, `consumed_by_student_id`, `consumed_scan_id`; add indexes on `(mentor_id, expires_at)` and `code_value`. Extend `scan_records` with `entry_method TEXT NOT NULL DEFAULT 'qr' CHECK (entry_method IN ('qr','fallback_code'))`. Update worker types and mock-D1 support so tests can seed and inspect fallback codes and `entry_method` cleanly. Enforce the v1 rule that each mentor has at most one unexpired, unconsumed active code at a time by query logic, not by allowing multiple active rows.
  **Must NOT do**: Do not change the existing unique `(student_id, mentor_id, event_date)` constraint. Do not alter CSV schema or admin export columns. Do not add a second attendance table.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: schema, mock DB, runtime types, and audit model must align across worker + tests.
  - Skills: [] - no extra skill required.
  - Omitted: [`test-driven-development`] - existing repo already has broad test harness; executor can still write tests first without loading skill.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 2, 3, 4, 5, 6 | Blocked By: none

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `migrations/0001_initial_schema.sql:9-24` - existing `scan_records` schema, uniqueness, and indexing style to extend.
  - Pattern: `src/worker/db/scan-records.ts:11-50` - current record creation contract; extend rather than fork.
  - Pattern: `src/worker/db/scan-records.ts:52-59` - duplicate-error mapping must stay intact.
  - API/Type: `src/worker/services/event-day.ts:12-30` - UTC-day semantics that fallback must preserve.
  - Test: `test/support/mock-d1.ts` - mock D1 must be extended for new table + `entry_method` behavior.
  - Test: `test/integration/student-api.test.ts:68-110` - current scan-create assertions to mirror for fallback-created rows.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Migration adds `mentor_fallback_codes` and `scan_records.entry_method` without removing existing constraints.
  - [ ] Mock D1 can seed fallback codes and return `entry_method` on created scan rows.
  - [ ] Existing QR-path tests still pass after schema/type updates.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Migration and existing scan contract stay valid
    Tool: Bash
    Steps: run `npm test -- test/integration/student-api.test.ts`
    Expected: suite passes; QR scan creation and duplicate rejection remain green after schema extension
    Evidence: .sisyphus/evidence/task-1-fallback-persistence.txt

  Scenario: CSV contract not impacted by schema change
    Tool: Bash
    Steps: run `npm test -- test/integration/admin-api.test.ts`
    Expected: suite passes; export header remains `student name,secret id,mentor scanned,date,notes`
    Evidence: .sisyphus/evidence/task-1-fallback-persistence-error.txt
  ```

  **Commit**: YES | Message: `feat(fallback): add fallback code persistence model` | Files: `migrations/*`, `src/worker/types*`, `src/worker/db/*`, `test/support/mock-d1.ts`

- [x] 2. Add mentor fallback-code issuance API

  **What to do**: Extend mentor API with `GET /mentor/:secretToken/api/fallback-code` and `POST /mentor/:secretToken/api/fallback-code`. `GET` returns active code state for that mentor: `{ hasActiveCode, code, expiresAt, remainingSeconds }` when an unexpired, unconsumed code exists; otherwise `{ hasActiveCode: false }`. `POST` generates a new 8-digit numeric code only when no active code exists; if one already exists, return `409` with deterministic message like `Active fallback code already exists.`. Generated code TTL is exactly 5 minutes from server timestamp. Raw code may be stored in the short-lived fallback table to support redisplay on refresh; it must never appear in admin UI, CSV, or non-mentor endpoints.
  **Must NOT do**: Do not allow mentor to mint a replacement code before expiry in v1. Do not expose fallback code through student or admin APIs. Do not weaken mentor secret-token checks.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: route, DB query semantics, TTL computation, and access rules must be exact.
  - Skills: []
  - Omitted: [`git-master`] - not needed for implementation planning.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 4 | Blocked By: 1

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `src/worker/routes/mentor.ts:14-40` - `/me` role/secret-token resolution pattern.
  - Pattern: `src/worker/routes/mentor.ts:42-70` - mentor-specific JSON endpoint shape and current runtime-date usage.
  - Pattern: `public/mentor/app.js:105-131` - mentor identity load sequence where active code fetch can slot in.
  - Pattern: `public/mentor/app.js:138-191` - polling/status update style for active code countdown refresh.
  - API/Type: `src/worker/services/event-day.ts:12-30` - server-side timestamp derivation conventions.
  - Test: `test/integration/mentor-api.test.ts:44-65` - mentor `/api/me` response style.
  - Test: `test/integration/mentor-api.test.ts:89-156` - mentor route tests and fixture conventions.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Valid mentor secret token can generate one 8-digit code with 5-minute expiry and `200`/`201` JSON response.
  - [ ] `GET /api/fallback-code` returns same active code until expiry or consumption.
  - [ ] Second `POST /api/fallback-code` before expiry returns `409` and leaves original active code unchanged.
  - [ ] Non-mentor tokens receive `404` or existing role-bound failure behavior.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Mentor generates and re-reads active code
    Tool: Bash
    Steps: run `npm test -- test/integration/mentor-api.test.ts`
    Expected: tests prove generate returns 8-digit code, GET returns same code, expiry timestamp is 5 minutes ahead, second POST conflicts while active
    Evidence: .sisyphus/evidence/task-2-mentor-issuance.txt

  Scenario: Wrong role cannot access mentor fallback issuance
    Tool: Bash
    Steps: run `npm test -- test/integration/mentor-api.test.ts`
    Expected: student secret token against mentor fallback-code endpoints fails with existing not-found behavior
    Evidence: .sisyphus/evidence/task-2-mentor-issuance-error.txt
  ```

  **Commit**: YES | Message: `feat(fallback): add mentor fallback code issuance api` | Files: `src/worker/routes/mentor.ts`, `src/worker/db/*`, `test/integration/mentor-api.test.ts`

- [x] 3. Add student fallback-code redemption API with abuse guards

  **What to do**: Add `POST /student/:secretToken/api/redeem-code` with payload `{ code: string }`. Normalize client spaces away but require exactly 8 numeric digits server-side. Look up only currently active, unconsumed codes. On success: mark code consumed atomically, create one `scan_records` row with `entry_method='fallback_code'`, and return `201` payload matching existing scan-create shape plus mentor summary. If the same student already scanned the same mentor today, return `409 Duplicate mentor scan already recorded for this calendar day.` and leave the code unconsumed. For invalid, expired, already-consumed, or replaced codes, return `400 Invalid or expired fallback code.`. Add throttling for repeated bad redemption attempts using a narrow in-memory or storage-backed approach already suitable for Workers; minimum requirement: repeated bad attempts from same student token within short window return `429` and deterministic message.
  **Must NOT do**: Do not create a scan row before code consumption succeeds. Do not consume a code on malformed/expired/duplicate requests. Do not expose mentor identity before validation succeeds.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: atomic consume/create semantics, duplicate interaction, and throttling are the hardest logic.
  - Skills: []
  - Omitted: [`playwright`] - API-first task; browser checks belong later.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 5, 6 | Blocked By: 1

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `src/worker/routes/student.ts:42-129` - existing scan-create flow to mirror for immediate attendance creation.
  - Pattern: `src/worker/routes/student.ts:132-166` - student history contract that fallback-created rows must flow into unchanged.
  - Pattern: `src/worker/db/scan-records.ts:81-100` - duplicate pre-check helper.
  - Pattern: `src/worker/db/scan-records.ts:102-120` - mentor recent-scan query must naturally surface fallback rows.
  - Pattern: `src/worker/services/mentor-qr.ts:1-16` - existing mentor identity validation style; keep fallback path equally strict.
  - Test: `test/integration/student-api.test.ts:68-142` - scan success + uniqueness conflict coverage pattern.
  - Test: `test/integration/student-api.test.ts:168-245` - same-day duplicate and day-boundary semantics to preserve.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Valid student token + active code creates exactly one scan row with `entry_method='fallback_code'` and `201` response.
  - [ ] Duplicate same-day student→mentor redemption returns `409`, leaves existing row count unchanged, and leaves code still active.
  - [ ] Invalid, expired, replaced, or consumed code returns `400 Invalid or expired fallback code.` with no row written.
  - [ ] Malformed code input returns `400 Invalid or expired fallback code.` with no mentor leakage.
  - [ ] Repeated invalid submissions hit throttling and return `429` with deterministic message.
  - [ ] Parallel double redemption against one active code yields exactly one success and one failure.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Student redeems valid code and gets attendance immediately
    Tool: Bash
    Steps: run `npm test -- test/integration/student-api.test.ts`
    Expected: suite proves redeem endpoint returns 201, writes one scan row, tags row with `fallback_code`, and student history includes mentor afterward
    Evidence: .sisyphus/evidence/task-3-student-redemption.txt

  Scenario: Expired, duplicate, throttled, and parallel redemption cases fail safely
    Tool: Bash
    Steps: run `npm test -- test/integration/student-api.test.ts`
    Expected: suite proves expired/used/replaced all return generic 400, duplicate returns 409 without consuming code, invalid-attempt burst returns 429, and race test yields one winner only
    Evidence: .sisyphus/evidence/task-3-student-redemption-error.txt
  ```

  **Commit**: YES | Message: `feat(fallback): add student fallback code redemption api` | Files: `src/worker/routes/student.ts`, `src/worker/db/*`, `test/integration/student-api.test.ts`

- [x] 4. Add mentor-page fallback-code UI and countdown behavior

  **What to do**: Extend mentor page with a new secondary card below QR display and above recent scans for fallback-code issuance. Add explicit DOM hooks for: generate button, active code text, expiry countdown, active-state copy, and conflict/error message. On load, call `GET /api/fallback-code`; if active code exists, render it and show live countdown to expiry. If none exists, show `Generate one-time code` button. On successful POST, render the new code immediately. While an active code remains, disable generate button and show deterministic helper text that another code can be generated after expiry. When countdown reaches zero, refresh state and re-enable generation.
  **Must NOT do**: Do not place fallback UI above mentor QR card. Do not auto-refresh/rotate codes. Do not expose code in copy-to-clipboard flows unless already approved by DOM contract; keep v1 to visible on-screen code only.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - Reason: DOM contract + stateful mentor UI updates.
  - Skills: []
  - Omitted: [`frontend-design`] - unnecessary; this is narrow UI extension within existing style.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 6 | Blocked By: 1, 2

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `public/mentor/app.js:5-20` - central DOM hook registry style.
  - Pattern: `public/mentor/app.js:105-131` - mentor identity boot sequence; fallback state load belongs after identity resolution.
  - Pattern: `public/mentor/app.js:138-191` - polling/status update rhythm to mirror for countdown refresh.
  - Pattern: `test/integration/mentor-page-dom.test.ts:4-46` - mentor DOM contract expectations to extend safely.
  - Pattern: `test/integration/mentor-api.test.ts:44-65` - `/api/me` response usage inside current mentor UI.
  - UI Order: `test/integration/mentor-page-dom.test.ts:12-20` - preserve identity → QR → recent scans flow; fallback card should live inside QR region or between QR and recent scans without breaking intended vertical order.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Mentor page gains stable IDs for fallback-code card, generate button, code text, countdown, and error/helper states.
  - [ ] On page load, active code state is rendered from API if present.
  - [ ] Generate button disables while active code exists and re-enables after expiry refresh.
  - [ ] Mentor QR display and recent scans behavior remain intact.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Mentor DOM contract supports fallback issuance state
    Tool: Bash
    Steps: run `npm test -- test/integration/mentor-page-dom.test.ts`
    Expected: suite passes and includes new fallback element ids without breaking existing identity/QR/recent-scans hooks
    Evidence: .sisyphus/evidence/task-4-mentor-ui.txt

  Scenario: Mentor active-code state does not break recent scans flow
    Tool: Bash
    Steps: run `npm test -- test/integration/mentor-api.test.ts`
    Expected: suite passes with code issuance coverage and existing recent scans / notes coverage still green
    Evidence: .sisyphus/evidence/task-4-mentor-ui-error.txt
  ```

  **Commit**: YES | Message: `feat(fallback): add mentor fallback code ui` | Files: `public/mentor/*`, `test/integration/mentor-page-dom.test.ts`

- [x] 5. Add student-page fallback reveal and code-entry UX

  **What to do**: Extend student page with a secondary reveal button below scanner controls labeled along the lines of `Camera not working? Use one-time code`. Clicking reveals a compact fallback form with 8-digit numeric input, submit button, cancel/hide action, and helper copy explaining that the mentor must generate the code and that it expires in 5 minutes. Redemption hits `POST /api/redeem-code`. On success, show the same success-state style as QR flow, reload history, and stop/reset scanner. On failure, show one of: generic invalid/expired message, duplicate same-day message, or throttled message. Strip spaces client-side before submit, but do not auto-submit or auto-focus in a way that hides the primary scan path.
  **Must NOT do**: Do not make fallback code UI always expanded by default. Do not visually equalize it with the primary scanner CTA. Do not remove or weaken existing scanner retry/error handling.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - Reason: student mobile-first UI contract plus runtime state management.
  - Skills: []
  - Omitted: [`frontend-design`] - existing product styling should remain restrained.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 6 | Blocked By: 1, 3

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `public/student/app.js:4-26` - student DOM hook registry.
  - Pattern: `public/student/app.js:59-93` - identity load gate before scanner actions.
  - Pattern: `public/student/app.js:95-115` - history reload routine to reuse after fallback redemption.
  - Pattern: `public/student/app.js:205-225` - status/error presentation style.
  - Pattern: `public/student/app.js:237-260` - scanner availability gating; fallback reveal must complement, not replace, scanner flow.
  - Test: `test/integration/student-page-dom.test.ts:4-20` - student card order and headings must stay mobile-first.
  - Test: `test/integration/student-page-dom.test.ts:22-53` - existing hook IDs that must remain intact while adding fallback IDs.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Student page adds reveal button and hidden fallback form with stable IDs.
  - [ ] Fallback form stays collapsed until reveal action.
  - [ ] Successful redemption updates status and reloads history.
  - [ ] Existing scanner controls and history DOM hooks remain intact.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Student DOM contract exposes fallback reveal path without breaking scanner flow
    Tool: Bash
    Steps: run `npm test -- test/integration/student-page-dom.test.ts`
    Expected: suite passes with new fallback ids added and existing identity/scanner/history ordering preserved
    Evidence: .sisyphus/evidence/task-5-student-ui.txt

  Scenario: Student fallback redemption path preserves API-driven history refresh
    Tool: Bash
    Steps: run `npm test -- test/integration/student-api.test.ts`
    Expected: suite proves valid fallback redemption leads to history entry and existing QR behaviors stay green
    Evidence: .sisyphus/evidence/task-5-student-ui-error.txt
  ```

  **Commit**: YES | Message: `feat(fallback): add student fallback code ui` | Files: `public/student/*`, `test/integration/student-page-dom.test.ts`

- [x] 6. Expose fallback audit marker in admin UI and finish hardening coverage

  **What to do**: Extend admin record payloads to include `entryMethod` for each record while preserving existing CSV export columns and ordering. Surface a visible fallback badge/label in admin UI table rows for `fallback_code` records only. Add or extend tests for: admin records payload includes `entryMethod`, CSV header/order unchanged, mentor recent scans still include fallback-created records, race-condition redemption only produces one row, and fallback-created rows remain editable/reassignable/deletable under last-write-wins admin rules. If needed, add a narrow shared helper for generic fallback-code error responses so route behavior stays deterministic.
  **Must NOT do**: Do not add fallback metadata to CSV. Do not create a separate admin screen for issuance logs. Do not break existing admin patch/delete/reassign flows.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: touches admin payload contract, record joins, and full-suite hardening.
  - Skills: []
  - Omitted: [`playwright`] - only use if existing e2e suite already covers admin table row rendering efficiently.

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: none | Blocked By: 1, 3, 4, 5

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `src/worker/routes/admin.ts:16-66` - locked duplicate message and CSV serialization; CSV must stay untouched.
  - Pattern: `src/worker/routes/admin.ts:133-183` - records/export payload shape where `entryMethod` belongs only in records response.
  - Pattern: `test/integration/admin-api.test.ts:89-150` - records/export assertion helpers to extend while preserving header expectations.
  - Pattern: `test/integration/admin-api.test.ts:155-230` - admin records payload structure.
  - Pattern: `src/worker/routes/mentor.ts:42-70` - mentor recent scans route that should naturally include fallback-created rows.
  - Test: `test/integration/mentor-api.test.ts:89-156` - recent scans coverage to extend with fallback-created record fixtures.
  - Test: `test/integration/admin-api.test.ts` - patch/delete/reassign/export contracts must remain green.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Admin records JSON includes `entryMethod` for each record.
  - [ ] Admin UI visually distinguishes fallback-created records.
  - [ ] CSV export remains exactly `student name,secret id,mentor scanned,date,notes` in both header and row shape.
  - [ ] Admin edit/delete/reassign operations still work for fallback-created records.
  - [ ] Mentor recent scans and student history continue to surface fallback-created rows without special-case omissions.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Admin sees fallback marker while CSV contract stays locked
    Tool: Bash
    Steps: run `npm test -- test/integration/admin-api.test.ts`
    Expected: suite proves records payload includes `entryMethod`, fallback records remain editable, and export header/order remains unchanged
    Evidence: .sisyphus/evidence/task-6-admin-audit.txt

  Scenario: Full fallback path still feeds mentor recent scans and resists race duplication
    Tool: Bash
    Steps: run `npm test -- test/integration/mentor-api.test.ts`; run `npm test -- test/integration/student-api.test.ts`
    Expected: mentor recent scans include fallback-created record; student race test still yields one created row only
    Evidence: .sisyphus/evidence/task-6-admin-audit-error.txt
  ```

  **Commit**: YES | Message: `test(fallback): harden fallback audit and race coverage` | Files: `src/worker/routes/admin.ts`, `public/admin/*`, `test/integration/admin-api.test.ts`, `test/integration/mentor-api.test.ts`, `test/integration/student-api.test.ts`

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [x] F1. Plan Compliance Audit — oracle
- [x] F2. Code Quality Review — unspecified-high
- [x] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [x] F4. Scope Fidelity Check — deep

## Commit Strategy
- Commit after Wave 1 foundation lands: `feat(fallback): add mentor fallback code foundation`
- Commit after Wave 2 user flows land: `feat(fallback): add mentor and student one-time code flow`
- Commit after Wave 3 admin/audit hardening lands: `test(fallback): cover fallback audit and failure paths`

## Success Criteria
- Camera-failure fallback works without weakening duplicate/day constraints.
- Abuse surface is reduced through TTL, single-use, one-active-code-per-mentor, generic stale-code errors, and throttling.
- Mentor recent scans and student history treat fallback-created records the same as QR-created records except for audit origin.
- Admin can identify fallback-created records in UI while CSV contract stays unchanged.
