# Calendar-Day Semantics Alignment

## TL;DR
> **Summary**: Replace the repo's split day model with one canonical rule: the authoritative day is the runtime UTC calendar day derived from `scanned_at`, and stored `event_date` remains only a persisted day key derived from that timestamp.
> **Deliverables**:
> - canonical UTC day-resolution contract in runtime code
> - student/admin/persistence behavior aligned to the same day rule
> - legacy-data backfill/audit path for mismatched `event_date` rows
> - focused regression coverage for duplicate, admin, migration, and boundary cases
> - source-of-truth docs aligned to the new semantics
> **Effort**: Medium
> **Parallel**: YES - 2 waves
> **Critical Path**: 1 → 2 → 3 → 4 → 5 → 6

## Context
### Original Request
User reported: student 01 scanning mentor 01 shows a duplicate "today" message even though the previous scan happened last week, then selected a broader fix covering **code + tests + docs**.

### Interview Summary
- Root cause confirmed: duplicate prevention uses configured `EVENT_DATE`, while student history and mentor recent scans already use runtime UTC day from `scanned_at`.
- User chose **real calendar day** semantics instead of fixed event-day semantics.
- User chose **broader alignment** rather than a narrow hotfix.
- User chose **minimal tests**, so the plan uses focused regression coverage instead of a full test expansion.

### Metis Review (gaps addressed)
- Locked the canonical day rule to **runtime UTC day** as the default; local-timezone support is explicitly out of scope.
- Treated this as a semantic migration, not a one-line bug fix.
- Preserved `scan_records.event_date` and the existing unique key as a stored reporting key derived from `scanned_at` rather than redesigning schema/API shape.
- Included a legacy-data audit/backfill task because existing rows may have `event_date != substr(scanned_at, 1, 10)`.
- Guarded against scope creep into multi-event support, timezone customization, analytics, or UI redesign.

## Work Objectives
### Core Objective
Make duplicate prevention, admin/reporting defaults, stored day keys, tests, and documentation use one consistent calendar-day rule so scans from a prior week do not block a new scan today.

### Deliverables
- Shared UTC calendar-day resolution logic for runtime paths
- Updated student duplicate enforcement using derived day keys
- Updated admin/reporting defaults and export behavior using the same day rule
- Legacy-data audit/backfill path for existing rows with mismatched day keys
- Regression tests and mock-harness updates for the new semantics
- Updated `docs/` and root README content reflecting calendar-day behavior

### Definition of Done (verifiable conditions with commands)
- `npm test -- test/integration/student-api.test.ts` passes with prior-week duplicates allowed and same-day duplicates rejected.
- `npm test -- test/integration/admin-api.test.ts` passes with admin defaults/filtering aligned to runtime UTC day and existing range params preserved.
- `npm test -- test/integration/mentor-api.test.ts` passes with mentor recent-scan behavior unchanged under the shared UTC-day rule.
- `npm test -- test/unit/admin-records.test.ts test/unit/mock-d1-admin.test.ts` passes with updated persistence/reporting semantics.
- Any new targeted migration/day-resolution regression tests pass.
- `npm run typecheck` passes.

### Must Have
- One canonical rule: `event_date` is the UTC date derived from `scanned_at`.
- Duplicate prevention rejects only same-student/same-mentor scans on the same derived UTC day.
- Admin defaults no longer depend on configured `EVENT_DATE`.
- `startDate` / `endDate` API contract stays intact.
- CSV column order stays exactly `student name, secret id, mentor scanned, date, notes`.
- Legacy rows with mismatched day keys are audited and backfilled safely.
- User-facing and doc wording stops implying fixed event-day behavior.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- No local-timezone/daylight-saving support.
- No multi-event or multi-day product redesign beyond runtime UTC day semantics.
- No schema rename/removal of `event_date` in this change.
- No endpoint shape changes to student, mentor, or admin APIs.
- No CSV column-order changes.
- No broad UI redesign outside copy changes required by the semantic shift.

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed.
- Test decision: **Minimal targeted regression coverage** using existing Vitest integration/unit suites plus narrowly added regression tests where the old semantics are encoded.
- QA policy: Every task includes agent-executed happy-path and failure/edge scenarios.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks for max parallelism.

Wave 1: foundation semantics + student path + legacy-data alignment
- Task 1: canonical UTC day-resolution contract
- Task 2: student duplicate semantics + focused regressions
- Task 3: legacy-data audit/backfill + collision safeguards

Wave 2: admin/reporting alignment + regression hardening + docs
- Task 4: admin records/export default semantics
- Task 5: conflict/copy/regression hardening
- Task 6: docs and config-reference alignment

### Dependency Matrix (full, all tasks)
| Task | Depends On | Blocks |
|---|---|---|
| 1 | none | 2, 3, 4, 5, 6 |
| 2 | 1 | 5, 6 |
| 3 | 1 | 4, 5, 6 |
| 4 | 1, 3 | 5, 6 |
| 5 | 1, 2, 3, 4 | 6, Final Wave |
| 6 | 1, 2, 3, 4, 5 | Final Wave |

### Agent Dispatch Summary (wave → task count → categories)
- Wave 1 → 3 tasks → unspecified-high, deep
- Wave 2 → 3 tasks → unspecified-high, writing

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [x] 1. Establish the canonical UTC day-resolution contract

  **What to do**: Introduce one shared runtime helper/contract that derives a `YYYY-MM-DD` UTC day key from the authoritative scan timestamp/current server time. Replace active uses of configured `EVENT_DATE` in runtime decision paths with that helper. Keep `scan_records.event_date` as a stored reporting key derived from `scanned_at`; do not rename the column or alter API payload shapes.
  **Must NOT do**: Do not add local-timezone handling, do not redesign schema names, and do not leave mixed day-resolution codepaths in student/admin runtime logic.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: touches shared runtime semantics used by multiple routes without requiring a deep redesign.
  - Skills: `[]` - No extra skill is needed; the change is repo-specific.
  - Omitted: `[test-driven-development]` - user explicitly chose minimal regression coverage instead of TDD.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 2, 3, 4, 5, 6 | Blocked By: none

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `src/worker/routes/student.ts:47-115` - current student write/duplicate path resolves configured day before insert/conflict.
  - Pattern: `src/worker/routes/admin.ts:22-43,133-183` - current admin defaults and export behavior still rely on configured day semantics.
  - Pattern: `src/worker/services/event-day.ts` - current configured `EVENT_DATE` resolver to retire from active runtime semantics.
  - API/Type: `src/worker/types.ts` - current `Env.EVENT_DATE` and `ScanRecord.event_date` typing boundary.
  - Pattern: `src/worker/db/scan-records.ts:61-79,81-100,102-120` - existing split between runtime-day reads and event-day duplicate checks.
  - External: `https://diataxis.fr/reference/` - reference docs should describe factual system behavior once semantics are unified.

  **Acceptance Criteria** (agent-executable only):
  - [ ] A focused regression suite for shared day resolution passes, including a midnight UTC boundary case.
  - [ ] Student/admin runtime logic no longer depends on configured `EVENT_DATE` to determine the active day.
  - [ ] `event_date` remains present as the stored UTC-derived day key and `npm run typecheck` passes.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Shared UTC day contract passes
    Tool: Bash
    Steps: Run `npm test -- test/unit/calendar-day-semantics.test.ts`; save stdout/stderr to `.sisyphus/evidence/task-1-calendar-day-contract.txt`.
    Expected: Tests prove `2026-01-14T23:59:59Z -> 2026-01-14` and `2026-01-15T00:00:01Z -> 2026-01-15`, with no dependency on configured `EVENT_DATE`.
    Evidence: .sisyphus/evidence/task-1-calendar-day-contract.txt

  Scenario: Type boundary remains valid after helper swap
    Tool: Bash
    Steps: Run `npm run typecheck`; save output to `.sisyphus/evidence/task-1-calendar-day-typecheck.txt`.
    Expected: TypeScript passes without route/type errors after replacing configured-day runtime dependencies.
    Evidence: .sisyphus/evidence/task-1-calendar-day-typecheck.txt
  ```

  **Commit**: YES | Message: `refactor(shared): derive day keys from runtime utc date` | Files: `src/worker/services/*`, `src/worker/routes/*`, `src/worker/types.ts`, `test/unit/*`

- [x] 2. Align student duplicate enforcement to the calendar day

  **What to do**: Update the student scan path and duplicate lookup so the duplicate guard uses the shared UTC day contract derived from the actual scan timestamp/current runtime time, not a fixed configured event day. Keep the student history behavior on runtime UTC day. Update `test/integration/student-api.test.ts` and `test/support/mock-d1.ts` so prior-week scans no longer block today while same-day duplicates still return conflict.
  **Must NOT do**: Do not change QR payload format, do not widen duplicate scope beyond same student + same mentor + same UTC day, and do not let mock DB semantics diverge from route semantics.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: route + DB + targeted regression work in a small cluster of files.
  - Skills: `[]` - Existing test stack and route patterns are already established in-repo.
  - Omitted: `[test-driven-development]` - user chose focused regression coverage rather than red-green-first workflow.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 5, 6 | Blocked By: 1

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `src/worker/routes/student.ts:47-115` - current duplicate rejection branch and student scan creation flow.
  - Pattern: `src/worker/db/scan-records.ts:81-100` - duplicate lookup currently keyed by `event_date`.
  - Pattern: `src/worker/db/scan-records.ts:61-79` - student history already follows runtime UTC day via `scanned_at`.
  - Test: `test/integration/student-api.test.ts:190-229` - existing regression proving the current wrong behavior when prior scan was on a different runtime day.
  - Test: `test/support/mock-d1.ts:276-356,362-404` - mock DB logic must match the updated duplicate and history semantics.
  - Reference: `docs/prd/mentor-student-qr-attendance-v1.md:84-100` - current duplicate/same-day wording that implementation will supersede in Task 6.

  **Acceptance Criteria** (agent-executable only):
  - [ ] A prior-week scan for the same student/mentor no longer blocks a new scan today.
  - [ ] A second scan for the same student/mentor on the same UTC day still returns `409` with deterministic duplicate messaging.
  - [ ] `npm test -- test/integration/student-api.test.ts` passes and `test/support/mock-d1.ts` matches the updated route semantics.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Prior-week duplicate no longer blocks today's scan
    Tool: Bash
    Steps: Run `npm test -- test/integration/student-api.test.ts -t "allows a new scan when the previous matching scan was on a prior UTC day"`; save output to `.sisyphus/evidence/task-2-student-prior-week.txt`.
    Expected: Test passes with HTTP 201/created behavior for the new scan.
    Evidence: .sisyphus/evidence/task-2-student-prior-week.txt

  Scenario: Same-day duplicate still conflicts
    Tool: Bash
    Steps: Run `npm test -- test/integration/student-api.test.ts -t "rejects a duplicate mentor scan for the same UTC day"`; save output to `.sisyphus/evidence/task-2-student-same-day-conflict.txt`.
    Expected: Test passes with HTTP 409 and the stable duplicate response text.
    Evidence: .sisyphus/evidence/task-2-student-same-day-conflict.txt
  ```

  **Commit**: YES | Message: `fix(student): align duplicate scans to calendar day` | Files: `src/worker/routes/student.ts`, `src/worker/db/scan-records.ts`, `test/integration/student-api.test.ts`, `test/support/mock-d1.ts`

- [x] 3. Audit and backfill legacy `event_date` rows safely

  **What to do**: Add the smallest safe migration/backfill path that reconciles existing `scan_records.event_date` values to the UTC day derived from `scanned_at`. Before mutating data, detect collisions where multiple rows would collapse onto the same `(student_id, mentor_id, derived_day)` key and fail loudly with explicit remediation instructions instead of deleting/merging records automatically. Update fixtures that intentionally encode old semantics only if they block the new invariant.
  **Must NOT do**: Do not silently drop rows, do not auto-merge conflicts, and do not introduce a second business-day field.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: data migration and collision handling require careful correctness boundaries.
  - Skills: `[]` - No external library workflow is needed.
  - Omitted: `[test-driven-development]` - minimal regression strategy remains in force; use targeted migration tests only.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 4, 5, 6 | Blocked By: 1

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `migrations/0001_initial_schema.sql:9-24` - current uniqueness contract on `(student_id, mentor_id, event_date)` must remain valid after backfill.
  - Pattern: `src/worker/db/scan-records.ts:81-100` - duplicate lookup relies on stored `event_date` keys.
  - Pattern: `src/worker/db/admin-records.ts:108-143,241-271` - admin records/export queries still filter by stored `event_date`.
  - Fixture: `seed/e2e-admin.sql` - existing seeded rows may need day-key alignment if they encode fixed event-day assumptions.
  - Test: `test/unit/mock-d1-admin.test.ts` - useful place to preserve admin/reporting assumptions after backfill.
  - Reference: `docs/implementation/mentor-student-qr-attendance-v1-plan.md:87-108,133-145` - current docs describe `event_date` as the reporting key and should remain structurally true after backfill.

  **Acceptance Criteria** (agent-executable only):
  - [ ] A targeted migration/backfill regression proves mismatched `event_date` rows are updated to `substr(scanned_at, 1, 10)`.
  - [ ] A collision regression proves the backfill halts with an explicit error instead of deleting or merging records.
  - [ ] Post-backfill semantics preserve the existing unique key shape on `(student_id, mentor_id, event_date)`.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Backfill repairs stale day keys
    Tool: Bash
    Steps: Run `npm test -- test/unit/calendar-day-backfill.test.ts -t "backfills event_date from scanned_at utc day"`; save output to `.sisyphus/evidence/task-3-backfill-success.txt`.
    Expected: Test passes and demonstrates a stale `event_date` row is rewritten to the UTC date derived from `scanned_at`.
    Evidence: .sisyphus/evidence/task-3-backfill-success.txt

  Scenario: Collision handling fails safely
    Tool: Bash
    Steps: Run `npm test -- test/unit/calendar-day-backfill.test.ts -t "halts when backfill would create a duplicate student mentor day key"`; save output to `.sisyphus/evidence/task-3-backfill-collision.txt`.
    Expected: Test passes only if the migration aborts with a clear collision error and keeps both rows untouched.
    Evidence: .sisyphus/evidence/task-3-backfill-collision.txt
  ```

  **Commit**: YES | Message: `chore(data): backfill derived event dates safely` | Files: `migrations/*`, `seed/*`, `test/unit/*`

- [x] 4. Align admin records/export defaults to the calendar day

  **What to do**: Update admin records and export logic so the default day filter (when no `startDate`/`endDate` is supplied) reflects the current runtime UTC day instead of a configured fixed `EVENT_DATE`. Preserve the existing `startDate`/`endDate` query contract and range behavior exactly; only change the fallback default. Update `src/worker/routes/admin.ts` and `src/worker/db/admin-records.ts` query builders, and adjust `test/integration/admin-api.test.ts` and mock expectations to assert the new fallback behavior.
  **Must NOT do**: Do not remove `startDate`/`endDate` params, do not alter CSV column order, and do not break existing explicit range requests.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: route + DB query alignment with preserved API contract.
  - Skills: `[]` - Uses in-repo patterns already.
  - Omitted: `[test-driven-development]` - minimal test strategy; update existing tests rather than full TDD.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 5, 6 | Blocked By: 1, 3

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `src/worker/routes/admin.ts:22-43` - current default records endpoint that falls back to configured event-day behavior.
  - Pattern: `src/worker/routes/admin.ts:133-183` - current CSV export endpoint with the same configured fallback.
  - Pattern: `src/worker/db/admin-records.ts:108-143` - query builder for records list with `event_date` range filtering.
  - Pattern: `src/worker/db/admin-records.ts:241-271` - query builder for CSV export with `event_date` range filtering.
  - Test: `test/integration/admin-api.test.ts` - current admin integration coverage; must be updated for new fallback defaults.
  - Test: `test/unit/admin-records.test.ts` - query-builder unit coverage that may assert old configured-day defaults.
  - Reference: `docs/implementation/mentor-student-qr-attendance-v1-plan.md:133-145` - current admin API contract description.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Admin records endpoint with no date params returns only rows matching the current UTC day by default.
  - [ ] Admin export endpoint with no date params returns only rows matching the current UTC day by default.
  - [ ] Explicit `startDate`/`endDate` params still return the requested inclusive range regardless of current UTC day.
  - [ ] `npm test -- test/integration/admin-api.test.ts` passes after updating test defaults.
  - [ ] `npm test -- test/unit/admin-records.test.ts` passes after updating expected query behavior.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Admin default falls back to current UTC day
    Tool: Bash
    Steps: Run `npm test -- test/integration/admin-api.test.ts -t "defaults to the current UTC day when no date params are provided"`; save output to `.sisyphus/evidence/task-4-admin-default-day.txt`.
    Expected: Test passes with the expected record set matching today's UTC date.
    Evidence: .sisyphus/evidence/task-4-admin-default-day.txt

  Scenario: Admin explicit range still works independently
    Tool: Bash
    Steps: Run `npm test -- test/integration/admin-api.test.ts -t "honors an explicit startDate and endDate range"`; save output to `.sisyphus/evidence/task-4-admin-range.txt`.
    Expected: Test passes with the range request returning the correct inclusive set.
    Evidence: .sisyphus/evidence/task-4-admin-range.txt
  ```

  **Commit**: YES | Message: `fix(admin): use runtime utc day as default filter fallback` | Files: `src/worker/routes/admin.ts`, `src/worker/db/admin-records.ts`, `test/integration/admin-api.test.ts`, `test/unit/admin-records.test.ts`

- [x] 5. Harden duplicate conflict rules and messaging across roles

  **What to do**: Ensure that all day-based conflict surfaces behave consistently under the new semantics. Update admin reassignment validation so reassigning a record to a `(student, mentor, utc_day)` that already exists returns a deterministic conflict error. Update any user-facing strings or API messages that say "event day" or "today" to use wording aligned with "calendar day" or the actual UTC date, without over-polishing copy. Add minimal regression coverage for reassignment collision and a UTC midnight boundary in student scan behavior.
  **Must NOT do**: Do not redesign admin UI, do not add new endpoints, and do not change error payload shapes beyond message text.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: validation + messaging consistency across routes with clear pass/fail criteria.
  - Skills: `[]` - Repo-specific route patterns only.
  - Omitted: `[test-driven-development]` - minimal test strategy; targeted regressions only.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 6, Final Wave | Blocked By: 1, 2, 3, 4

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `src/worker/routes/admin.ts` - PATCH handler for record edits/reassignments that should check uniqueness after modification.
  - Pattern: `src/worker/db/scan-records.ts` - scan record query and update utilities.
  - Test: `test/integration/admin-api.test.ts` - look for edit/reassign tests to extend with collision coverage.
  - Test: `test/integration/student-api.test.ts` - extend with explicit UTC midnight boundary for same-day duplicate behavior.
  - Reference: `docs/prd/mentor-student-qr-attendance-v1.md:132-141` - admin correction acceptance criteria that should still hold under calendar-day semantics.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Admin PATCH reassigning a record onto an already-existing `(student_id, mentor_id, utc_day)` returns a stable conflict error.
  - [ ] Student duplicate message text no longer implies a fixed configured event-day.
  - [ ] A scan at `23:59:59Z` and a second scan at `00:00:01Z` next day succeeds without conflict.
  - [ ] `npm test -- test/integration/admin-api.test.ts` and `npm test -- test/integration/student-api.test.ts` pass with the new regression cases.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Admin reassignment collision returns conflict
    Tool: Bash
    Steps: Run `npm test -- test/integration/admin-api.test.ts -t "rejects reassignment that would create a duplicate student-mentor-day key"`; save output to `.sisyphus/evidence/task-5-admin-reassign-conflict.txt`.
    Expected: Test passes with HTTP 409 and a stable error message.
    Evidence: .sisyphus/evidence/task-5-admin-reassign-conflict.txt

  Scenario: Midnight boundary allows a new scan
    Tool: Bash
    Steps: Run `npm test -- test/integration/student-api.test.ts -t "allows a scan across the UTC midnight boundary"`; save output to `.sisyphus/evidence/task-5-student-midnight.txt`.
    Expected: Test passes with HTTP 201 for the second scan.
    Evidence: .sisyphus/evidence/task-5-student-midnight.txt
  ```

  **Commit**: YES | Message: `fix(validation): enforce calendar-day conflict rules consistently` | Files: `src/worker/routes/admin.ts`, `src/worker/db/scan-records.ts`, `test/integration/admin-api.test.ts`, `test/integration/student-api.test.ts`

- [x] 6. Update docs and config references to calendar-day semantics

  **What to do**: Rewrite the relevant sections in `docs/prd/mentor-student-qr-attendance-v1.md` and `docs/implementation/mentor-student-qr-attendance-v1-plan.md` so they describe UTC calendar-day semantics for duplicate prevention, admin defaults, and reporting instead of a fixed configured event day. Update the root `README.md` to reflect the new default behavior and remove any suggestion that `EVENT_DATE` drives duplicate or reporting logic. Optionally simplify or remove `EVENT_DATE` from `wrangler.jsonc` if it is no longer used by any runtime code.
  **Must NOT do**: Do not remove `docs/` files, do not change CSV column order, and do not rewrite unrelated personas or architecture sections.

  **Recommended Agent Profile**:
  - Category: `writing` - Reason: this is a documentation-only task with precise scope.
  - Skills: `[]` - No special tooling needed.
  - Omitted: `[test-driven-development]` - not applicable.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: Final Wave | Blocked By: 1, 2, 3, 4, 5

  **References** (executor has NO interview context - be exhaustive):
  - File: `docs/prd/mentor-student-qr-attendance-v1.md:18-22,24-31,84-100,182-191` - single event-day constraints and duplicate prevention wording to update.
  - File: `docs/implementation/mentor-student-qr-attendance-v1-plan.md:33-42,87-108,117-145,199-229` - implementation-level event-day semantics for writes/admin/reporting to update.
  - File: `README.md` - quickstart/config section that references `EVENT_DATE` and event-day behavior.
  - File: `wrangler.jsonc` - remove or update `EVENT_DATE` var if runtime code no longer depends on it.
  - Reference: `docs/README.md` - index file must stay valid after doc updates.

  **Acceptance Criteria** (agent-executable only):
  - [ ] PRD no longer describes duplicate prevention or admin defaults using a fixed configured event day.
  - [ ] Implementation plan no longer describes a split between event-day writes and runtime-day reads.
  - [ ] README no longer instructs users to set `EVENT_DATE` for duplicate/reporting behavior.
  - [ ] All existing file references in `docs/README.md` remain valid after edits.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Docs no longer reference fixed event-day semantics
    Tool: Bash
    Steps: Run `grep -R "configured event.day\|EVENT_DATE\|single event.day" docs/ README.md wrangler.jsonc` and save stdout to `.sisyphus/evidence/task-6-docs-calendar-day.txt`.
    Expected: No matches remain (or only benign references such as migration history or changelog notes if retained).
    Evidence: .sisyphus/evidence/task-6-docs-calendar-day.txt

  Scenario: File references remain valid
    Tool: Bash
    Steps: Run `grep -R "\.md" docs/README.md` and verify all relative paths exist with `ls`; save command output to `.sisyphus/evidence/task-6-docs-links.txt`.
    Expected: Every linked markdown file in docs/README.md exists on disk.
    Evidence: .sisyphus/evidence/task-6-docs-links.txt
  ```

  **Commit**: YES | Message: `docs: align source-of-truth docs to calendar-day semantics` | Files: `docs/prd/*.md`, `docs/implementation/*.md`, `README.md`, `wrangler.jsonc`

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in `.sisyphus/evidence/`. Compare deliverables against plan.
  Output: `Must Have [6/6] | Must NOT Have [7/7] | Tasks [6/6] | Evidence [present/absent] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `npm run typecheck` + linter + `npm test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, `console.log` in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names (`data`/`result`/`item`/`temp`).
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high`
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration: student scan on day N, student scan on day N+1 must not conflict; admin default on day N+1 must show only day N+1 records unless range is widened. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [PASS/FAIL] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (`git log --oneline --all`). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination: Task N touching Task M's files. Flag unaccounted changes.
  Output: `Tasks [6/6 compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

## Commit Strategy
- Prefer one commit per numbered task that changes runtime behavior or docs materially.
- Use regression-first commits where the task introduces new/updated tests.
- Avoid bundling docs alignment with behavior changes until code/tests are green.

## Success Criteria
- A student can scan the same mentor again on a new UTC calendar day even if an older record exists from a prior week.
- The same student scanning the same mentor twice on the same UTC day still produces a deterministic duplicate response.
- Admin defaults, records, export, and correction conflict rules align to the same stored UTC-derived `event_date` semantics.
- Existing data with stale `event_date` values is either corrected safely or surfaced with explicit collision handling.
- Repository documentation no longer describes duplicate prevention/admin defaults as fixed configured event-day behavior.
