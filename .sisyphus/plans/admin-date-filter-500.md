# Admin Records Date Filter 500 Fix

## TL;DR
> **Summary**: Diagnose and fix the deployed admin records API failure triggered by valid `startDate` / `endDate` filters, preserving the locked v1 fallback contract and using minimal TDD against the real failure mode.
> **Deliverables**:
> - deployed repro evidence and worker-log evidence for the failing records request
> - remote schema / migration verification for the records query path
> - one new failing regression test for the actual 500 cause
> - minimal route/db fix for `/admin/{secret}/api/records`
> - local and deployed verification evidence proving 200 responses for valid filters and preserved fallback behavior
> **Effort**: Short
> **Parallel**: YES - 2 waves
> **Critical Path**: 1 → 2 → 3 → 4 → 5

## Context
### Original Request
User reported that loading `https://absen-qr.rif42.workers.dev/admin/admin-secret-2026` and applying a date filter causes `GET /admin/admin-secret-2026/api/records?startDate=2026-04-17&endDate=2026-04-19` to return `500 Internal Server Error`, with the page showing “A Worker script configured by the website owner threw an unhandled exception while processing this request”.

### Interview Summary
- Scope locked to the records API bugfix only.
- Include deployed-worker log capture and environment verification.
- Exclude CSV follow-up unless the same root cause directly blocks records.
- Test strategy is minimal TDD: smallest failing regression first, watch it fail, then apply minimal fix.

### Metis Review (gaps addressed)
- Highest-risk assumption is production schema drift rather than frontend filter logic.
- Plan must capture deployed facts before code edits.
- Plan must preserve documented inclusive range semantics and UTC-day fallback behavior.
- Plan must avoid scope creep into admin UI, unrelated CRUD, and CSV improvements.

## Work Objectives
### Core Objective
Restore successful admin records loading for valid explicit date ranges on the deployed worker without changing the locked v1 `startDate` / `endDate` contract.

### Deliverables
- Evidence of the current deployed failure for the canonical filtered records request.
- Evidence of remote worker logs and remote D1 schema/migration state for the failing path.
- A targeted regression test that reproduces the real backend failure mode before the fix.
- Minimal source changes in the records API path only.
- Verification evidence showing valid ranges return 200 and malformed/reversed ranges still fall back to current UTC day.

### Definition of Done (verifiable conditions with commands)
- Canonical deployed request `GET /admin/admin-secret-2026/api/records?startDate=2026-04-17&endDate=2026-04-19` returns HTTP 200 with JSON `dateFilter.startDate="2026-04-17"` and `dateFilter.endDate="2026-04-19"`.
- Worker tail for the same request shows no uncaught exception and no SQL/schema error.
- The new targeted admin regression test fails before the fix and passes after the fix.
- `npm test -- test/integration/admin-api.test.ts` passes.
- `npm run typecheck` passes.
- Reversed or malformed admin ranges still return 200 and fall back to the current UTC day instead of returning validation errors.

### Must Have
- Preserve `resolveAdminDateRange()` fallback behavior from `src/worker/routes/admin.ts`.
- Keep fix surface limited to records route / DB layer / required migration or schema handling.
- Verify remote D1 schema includes columns required by the records query, especially `scan_records.entry_method`.
- Capture evidence files under `.sisyphus/evidence/` for both local and deployed verification.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- No admin UI redesign.
- No contract change from fallback-to-current-UTC-day to 4xx validation errors.
- No CSV feature expansion or export cleanup unless the same root cause blocks records.
- No broad refactor of admin routes, people queries, or unrelated worker services.
- No “fix by hiding error in frontend” approach.

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed.
- Test decision: TDD (minimal) + Vitest integration tests from `test/integration/admin-api.test.ts`
- QA policy: Every task includes agent-executed scenarios and evidence capture.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks for max parallelism.

Wave 1: T1 deployed repro capture, T2 remote schema/migration verification, T3 local failure-model mapping
Wave 2: T4 regression-first test addition, T5 minimal records-path fix, T6 verification sweep and deployed confirmation

### Dependency Matrix (full, all tasks)
| Task | Depends On | Blocks |
|---|---|---|
| T1 | none | T4, T5, T6 |
| T2 | none | T4, T5, T6 |
| T3 | none | T4, T5 |
| T4 | T1, T2, T3 | T5, T6 |
| T5 | T4 | T6 |
| T6 | T1, T2, T4, T5 | Final verification |

### Agent Dispatch Summary (wave → task count → categories)
- Wave 1 → 3 tasks → `quick`, `unspecified-low`
- Wave 2 → 3 tasks → `quick`

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [x] 1. Capture canonical deployed failure and worker logs

  **What to do**: Reproduce the failing deployed request exactly against `/admin/admin-secret-2026/api/records?startDate=2026-04-17&endDate=2026-04-19`, save the response body/status, then capture Cloudflare Worker tail logs for the same request window. Record the exact thrown error text, stack frame, SQL failure, or missing-column message. If the worker tail is noisy, filter to the failing route and timestamp window only.
  **Must NOT do**: Do not change code, redeploy, mutate remote data, or infer the root cause before logs are captured.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: bounded production repro and evidence capture.
  - Skills: []
  - Omitted: [`test-driven-development`] - Reason: this task gathers failure evidence before writing the failing regression test.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 4, 5, 6 | Blocked By: none

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `public/admin/app.js:225-229` - canonical records URL builder uses `${adminPath}/api/records?${search}`.
  - Pattern: `src/worker/routes/admin.ts:133-157` - records route resolves date range and calls `getAdminRecordsPayload()`.
  - External: `https://absen-qr.rif42.workers.dev/admin/admin-secret-2026/api/records?startDate=2026-04-17&endDate=2026-04-19` - canonical failing request reported by user.
  - Command reference: `package.json:7-15` - project uses Wrangler for worker operations.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Saved one evidence file containing status code, headers, and response body for the canonical failing request.
  - [ ] Saved one evidence file containing worker tail output for the same request window.
  - [ ] Evidence identifies the exact backend exception class/message or explicitly shows that logs were empty/unavailable.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Canonical deployed repro
    Tool: Bash
    Steps: Run `rtk curl -i "https://absen-qr.rif42.workers.dev/admin/admin-secret-2026/api/records?startDate=2026-04-17&endDate=2026-04-19"` and write full output to `.sisyphus/evidence/task-1-deployed-records-repro.txt`.
    Expected: HTTP 500 before fix, with body or edge error text captured exactly.
    Evidence: .sisyphus/evidence/task-1-deployed-records-repro.txt

  Scenario: Worker log capture for failing request
    Tool: Bash
    Steps: Start `rtk wrangler tail --format pretty`, trigger the same curl request once, stop tail after log emission, and save output to `.sisyphus/evidence/task-1-worker-tail.txt`.
    Expected: Tail contains the records request and either a thrown error message, SQL/schema failure, or an explicit absence of app logs.
    Evidence: .sisyphus/evidence/task-1-worker-tail.txt
  ```

  **Commit**: NO | Message: `` | Files: []

- [x] 2. Verify remote schema and migration state for records query compatibility

  **What to do**: Inspect remote D1 schema and migration status for the tables and columns touched by the records query. Explicitly verify whether `scan_records.entry_method` exists, because `listAdminRecords()` selects it and Metis flagged migration drift from `migrations/0003_fallback_codes.sql` as the top production-only risk. Save schema output and migration output as evidence.
  **Must NOT do**: Do not apply migrations or alter remote schema during this task; evidence first.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: direct remote-state verification with no code edits.
  - Skills: []
  - Omitted: [`test-driven-development`] - Reason: still pre-test investigation.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 4, 5, 6 | Blocked By: none

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `src/worker/db/admin-records.ts:116-145` - records query selects `scan_records.entry_method` and joins `people`.
  - Pattern: `src/worker/db/admin-records.ts:278-295` - payload fetch runs records/students/mentors in `Promise.all`, so any schema mismatch in any query can fail the endpoint.
  - Pattern: `migrations/0003_fallback_codes.sql:1-2` - adds `scan_records.entry_method TEXT NOT NULL DEFAULT 'qr'` with check constraint.
  - Pattern: `src/worker/routes/admin.ts:146-147` - records endpoint directly awaits payload query with no local error wrapping.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Saved remote schema evidence for `scan_records`.
  - [ ] Saved migration-list or equivalent remote migration evidence.
  - [ ] Evidence explicitly states whether `entry_method` exists remotely.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Remote scan_records schema inspection
    Tool: Bash
    Steps: Run a remote D1 schema query (for example `rtk wrangler d1 execute DB --remote --command "PRAGMA table_info(scan_records);"`) and save output to `.sisyphus/evidence/task-2-remote-scan-records-schema.txt`.
    Expected: Output lists all remote scan_records columns, including a clear yes/no for `entry_method`.
    Evidence: .sisyphus/evidence/task-2-remote-scan-records-schema.txt

  Scenario: Remote migration status inspection
    Tool: Bash
    Steps: Run the Wrangler command that shows remote D1 migration status/history for this project and save output to `.sisyphus/evidence/task-2-remote-migrations.txt`.
    Expected: Output shows whether migration `0003_fallback_codes.sql` has been applied remotely.
    Evidence: .sisyphus/evidence/task-2-remote-migrations.txt
  ```

  **Commit**: NO | Message: `` | Files: []

- [x] 3. Map the exact local failure model to a smallest reproducible test target

  **What to do**: Use the deployed evidence from Tasks 1-2 to decide the narrowest code-level failure model to reproduce locally. If logs show a missing column or schema mismatch, reproduce that failure shape in the test harness with the smallest fixture or mock adjustment needed. If logs show a different query path inside `Promise.all`, map it to the precise route/db function that must be covered by the new regression test. Record the chosen failure model and target test location before editing tests.
  **Must NOT do**: Do not write the fix yet. Do not add broad exploratory tests. Do not guess a failure model that is not backed by Tasks 1-2 evidence.

  **Recommended Agent Profile**:
  - Category: `unspecified-low` - Reason: small analysis task converting evidence into a precise TDD target.
  - Skills: [`test-driven-development`] - Reason: ensures the next task starts with a real failing test, not post-hoc coverage.
  - Omitted: []

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 4, 5 | Blocked By: 1, 2

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `test/integration/admin-api.test.ts:269-317` - current valid explicit-range records/export coverage.
  - Pattern: `test/integration/admin-api.test.ts:319-385` - current malformed/partial/reversed fallback coverage that must remain green.
  - Pattern: `test/integration/admin-api.test.ts:1277-1351` - explicit start/end params differing from runtime UTC day and `EVENT_DATE`.
  - Test infra: `test/support/mock-d1.ts:114-127` - admin joined-row helper behavior; use this area only if failure reproduction needs mock schema behavior changes.
  - Test infra: `vitest.config.ts:1-8` - Vitest config includes all `test/**/*.test.ts`.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Evidence file names the exact failure model to reproduce locally.
  - [ ] Evidence file names the exact test case to add or update, with reason.
  - [ ] Chosen failure model is traceable to deployed logs/schema evidence, not speculation.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Failure-model mapping record
    Tool: Bash
    Steps: Summarize Task 1 and Task 2 evidence into `.sisyphus/evidence/task-3-failure-model.txt`, naming the exact thrown error, source function, and planned regression test name.
    Expected: File clearly states one concrete failure model and one concrete test target.
    Evidence: .sisyphus/evidence/task-3-failure-model.txt

  Scenario: Existing admin range baseline remains understood
    Tool: Bash
    Steps: Run `rtk npm test -- test/integration/admin-api.test.ts` before new test changes and save output to `.sisyphus/evidence/task-3-admin-baseline.txt`.
    Expected: Existing suite passes or, if already failing, output is captured and cited as pre-existing baseline.
    Evidence: .sisyphus/evidence/task-3-admin-baseline.txt
  ```

  **Commit**: NO | Message: `` | Files: []

- [x] 4. Add the smallest failing regression test first

  **What to do**: Add one targeted regression test in `test/integration/admin-api.test.ts` that reproduces the real records-endpoint failure model identified in Task 3. Run only the targeted test and confirm RED: it must fail for the expected reason before any production code changes. Keep the test name behavior-focused and specific to the deployed bug.
  **Must NOT do**: Do not implement the fix before the test fails. Do not broaden the test to cover unrelated admin behavior. Do not silently modify existing assertions to force green.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: single-file targeted test addition.
  - Skills: [`test-driven-development`] - Reason: mandatory red-first workflow for this bugfix.
  - Omitted: []

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: 5, 6 | Blocked By: 1, 2, 3

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `test/integration/admin-api.test.ts:269-317` - valid explicit-range response shape.
  - Pattern: `test/integration/admin-api.test.ts:319-385` - fallback contract tests that must not regress.
  - Pattern: `test/integration/admin-api.test.ts:1277-1351` - explicit start/end params outside runtime UTC day and `EVENT_DATE`.
  - Test infra: `test/support/mock-d1.ts:98-108` - SQL normalization/query-result helpers.
  - Test infra: `test/support/mock-d1.ts:114-127` - admin row join behavior.
  - Test command: `package.json:12` - base test runner is `vitest run`.

  **Acceptance Criteria** (agent-executable only):
  - [ ] New regression test is added with a specific bug-oriented name.
  - [ ] Running the targeted test before the fix produces a failing assertion or expected thrown error tied to the identified failure model.
  - [ ] Failure output is saved as evidence.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: RED for actual bug reproduction
    Tool: Bash
    Steps: Run the narrow Vitest command for the new regression test and save failing output to `.sisyphus/evidence/task-4-red.txt`.
    Expected: Test fails for the expected reason before the production fix exists.
    Evidence: .sisyphus/evidence/task-4-red.txt

  Scenario: Existing fallback contract not rewritten in test
    Tool: Bash
    Steps: Re-run one existing fallback test selection or nearby suite slice and save output to `.sisyphus/evidence/task-4-fallback-baseline.txt`.
    Expected: Existing fallback-oriented test still reflects 200 + UTC-day fallback contract, unchanged by new test authoring.
    Evidence: .sisyphus/evidence/task-4-fallback-baseline.txt
  ```

  **Commit**: NO | Message: `` | Files: [`test/integration/admin-api.test.ts`, optional `test/support/mock-d1.ts` only if required by the real failure model]

- [x] 5. Apply the minimal records-path fix to make the new test pass

  **What to do**: Implement the smallest source change that resolves the actual records-endpoint failure proven by Task 4. Preferred fix surface order: `src/worker/db/admin-records.ts`, then `src/worker/routes/admin.ts`, then schema/migration handling only if deployed evidence proves remote drift is the cause. Re-run the targeted regression test until GREEN, then re-run the broader admin integration suite. If the fix requires a migration or remote schema remediation step, document it explicitly in code comments/plan notes and keep the code change minimal.
  **Must NOT do**: Do not alter frontend filter validation in `public/admin/app.js`. Do not change malformed/reversed range behavior to a client or server 4xx. Do not touch CSV logic unless the same root cause truly blocks records.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: minimal bugfix with tight scope.
  - Skills: [`test-driven-development`] - Reason: green must be reached by satisfying the failing regression, not by weakening the test.
  - Omitted: []

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: 6 | Blocked By: 4

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `src/worker/routes/admin.ts:22-43` - `resolveAdminDateRange()` fallback contract.
  - Pattern: `src/worker/routes/admin.ts:138-147` - current UTC date handling and records payload call site.
  - Pattern: `src/worker/db/admin-records.ts:111-147` - records SQL query and selected columns.
  - Pattern: `src/worker/db/admin-records.ts:278-295` - `Promise.all` payload assembly; shared failure propagation point.
  - Pattern: `src/worker/services/event-day.ts:12-20` - current UTC day logic; do not change unless logs prove this is the root cause.
  - Schema reference: `migrations/0003_fallback_codes.sql:1-2` - `entry_method` migration.

  **Acceptance Criteria** (agent-executable only):
  - [ ] The targeted regression test from Task 4 passes.
  - [ ] No existing explicit-range or fallback contract test regresses.
  - [ ] Fix touches only the minimal required files.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: GREEN for targeted regression
    Tool: Bash
    Steps: Run the narrow Vitest command for the new regression and save passing output to `.sisyphus/evidence/task-5-green.txt`.
    Expected: The previously failing regression test now passes with no test weakening.
    Evidence: .sisyphus/evidence/task-5-green.txt

  Scenario: Broader admin suite remains green
    Tool: Bash
    Steps: Run `rtk npm test -- test/integration/admin-api.test.ts` and save output to `.sisyphus/evidence/task-5-admin-suite.txt`.
    Expected: Admin API integration suite passes, including explicit-range and fallback coverage.
    Evidence: .sisyphus/evidence/task-5-admin-suite.txt
  ```

  **Commit**: YES | Message: `fix(admin): restore filtered records queries in production` | Files: [`src/worker/db/admin-records.ts`, `src/worker/routes/admin.ts`, `test/integration/admin-api.test.ts`, optional migration/remediation docs if strictly required]

- [ ] 6. Run final local and deployed verification for the fixed records path

  **What to do**: After the fix is green locally, run the full required verification sweep: typecheck, targeted admin integration tests, and the canonical deployed filtered request plus worker tail/log confirmation. If the deployed root cause was migration drift, include the exact remediation verification step needed to confirm the remote schema now matches the records query. Explicitly verify that malformed and reversed ranges still fall back to the current UTC day and still return 200. Only include `/export.csv` verification if Tasks 1-5 proved the same root cause path affects export.
  **Must NOT do**: Do not mark work complete based only on local tests. Do not expand into unrelated smoke tests outside admin records scope.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: bounded verification sweep with known commands.
  - Skills: []
  - Omitted: [`test-driven-development`] - Reason: verification phase, not new implementation.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: Final verification | Blocked By: 1, 2, 4, 5

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `src/worker/routes/admin.ts:22-43` - fallback contract for malformed/reversed ranges.
  - Pattern: `test/integration/admin-api.test.ts:319-385` - expected 200 + UTC-day fallback behavior.
  - Pattern: `public/admin/app.js:66-118` - frontend surfaces backend error message; deployed 500 must disappear.
  - Command reference: `package.json:11-13` - `typecheck`, `test`, and admin e2e script availability.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `npm run typecheck` passes.
  - [ ] Canonical deployed records request returns 200 with the expected `dateFilter` values.
  - [ ] Deployed tail/log evidence shows no uncaught exception for the canonical request.
  - [ ] Reversed/malformed ranges still return 200 with current-UTC-day fallback behavior.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Local verification sweep
    Tool: Bash
    Steps: Run `rtk npm run typecheck` and `rtk npm test -- test/integration/admin-api.test.ts`, saving outputs to `.sisyphus/evidence/task-6-typecheck.txt` and `.sisyphus/evidence/task-6-admin-suite.txt`.
    Expected: Both commands pass cleanly.
    Evidence: .sisyphus/evidence/task-6-typecheck.txt

  Scenario: Deployed valid-range confirmation
    Tool: Bash
    Steps: Re-run `rtk curl -i "https://absen-qr.rif42.workers.dev/admin/admin-secret-2026/api/records?startDate=2026-04-17&endDate=2026-04-19"`, save output to `.sisyphus/evidence/task-6-deployed-valid-range.txt`, and capture matching tail output in `.sisyphus/evidence/task-6-worker-tail.txt`.
    Expected: HTTP 200 with JSON including `dateFilter.startDate="2026-04-17"` and `dateFilter.endDate="2026-04-19"`; worker tail shows no uncaught exception.
    Evidence: .sisyphus/evidence/task-6-deployed-valid-range.txt

  Scenario: Fallback contract confirmation
    Tool: Bash
    Steps: Re-run the existing malformed/reversed admin range tests (or the full admin API suite containing them) and save output to `.sisyphus/evidence/task-6-fallback-contract.txt`.
    Expected: Malformed and reversed ranges still return 200 with UTC-day fallback semantics.
    Evidence: .sisyphus/evidence/task-6-fallback-contract.txt
  ```

  **Commit**: NO | Message: `` | Files: []

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [ ] F1. Plan Compliance Audit — oracle
- [ ] F2. Code Quality Review — unspecified-high
- [ ] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [ ] F4. Scope Fidelity Check — deep

## Commit Strategy
- Single commit after T6 if code changes are required.
- Message: `fix(admin): restore filtered records queries in production`
- Exclude evidence artifacts from commit unless repository convention explicitly requires them.

## Success Criteria
- Admin page can apply valid date filters without triggering Worker 500s.
- Records API preserves documented fallback semantics for bad ranges.
- Root cause is evidenced, not guessed.
- Local automated regression and deployed repro both pass.
