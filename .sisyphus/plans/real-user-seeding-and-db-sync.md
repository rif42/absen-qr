# Real User Seeding and DB Sync

## TL;DR
> **Summary**: Replace dummy local-style identities with a deterministic real-user test roster sourced from `userlist.csv`, reset attendance data for a fresh rollout, sync the selected users into the production D1 `people` table, and write production secret links back into the CSV from the same canonical import artifact.
> **Deliverables**:
> - deterministic user-import pipeline from `userlist.csv`
> - production-safe D1 reset + people upsert workflow
> - updated `userlist.csv` with generated production secret links
> - revised local seed/test fixtures aligned to the selected real roster
> - docs update reflecting the expanded 20-person testing roster
> **Effort**: Medium
> **Parallel**: YES - 3 waves
> **Critical Path**: 1 → 2 → 4 → 5

## Context
### Original Request
Replace dummy student and mentor data with actual student and mentor names and roles from `userlist.csv`, generate UID per user, update the server DB with real names and roles, and write generated secret links back into `userlist.csv`.

### Interview Summary
- Target the production Cloudflare D1 database.
- Use the production base URL for generated secret links.
- Auto-deduplicate repeated CSV rows.
- Use minimal tests plus scripted verification and agent-run QA.
- Treat this as a fresh rollout: reset attendance data instead of preserving existing scans.
- Approved scope exception: expand beyond the current v1 pilot roster now, add 10 extra users for testing, then revise docs.
- Decision applied for planning completeness: expand from the current 10-person pilot to a 20-person real roster by selecting the first 10 unique `student` rows and first 10 unique `mentor` rows from `userlist.csv` after normalization and dedupe, preserving CSV order.

### Metis Review (gaps addressed)
- Address docs mismatch explicitly instead of silently exceeding the approved v1 pilot size.
- Keep admin access out of CSV import scope because admin authorization is `ADMIN_SECRET`-based, not `people`-table-based.
- Separate stable deterministic identity generation from secret-link generation, but require both to be rerun-safe.
- Make the rollout idempotent and artifact-driven because local CSV writes and remote D1 updates cannot be one transaction.
- Require explicit backup, dry-run report, collision handling, and rerun verification before any production write.

## Work Objectives
### Core Objective
Ship a prod-safe, rerunnable migration path that replaces dummy student/mentor identities with a deterministic 20-person real roster derived from `userlist.csv`, resets attendance data for a fresh rollout, and preserves the existing role/secret-link contracts already enforced by the Worker.

### Deliverables
- Import script or equivalent pipeline that parses `userlist.csv` using a real CSV parser and emits one canonical artifact containing selected users, generated IDs, generated secret tokens, generated production links, and dedupe decisions.
- Deterministic selection rule implementation: first 10 unique students and first 10 unique mentors after normalization and dedupe, preserving input order.
- Production D1 apply workflow that deletes `scan_records`, replaces the selected `people` roster, and verifies resulting counts and uniqueness.
- Updated `userlist.csv` with appended generated secret-link column for the selected rows plus dedupe/status metadata for skipped duplicates.
- Local seed/test fixtures updated away from `Student Local ##` / `Mentor Local ##` dummy records and aligned to the selected real roster.
- Docs update in `docs/` reflecting the temporary expanded 20-person testing roster and the real-user rollout procedure.

### Definition of Done (verifiable conditions with commands)
- `rtk npm test`
- `rtk npm run typecheck`
- `node ./scripts/import-users.mjs --csv ./userlist.csv --base-url https://absen-qr.rif42.workers.dev --dry-run --output ./.sisyphus/evidence/import-dry-run.json`
- `node ./scripts/import-users.mjs --csv ./userlist.csv --base-url https://absen-qr.rif42.workers.dev --apply-remote --write-csv --output ./.sisyphus/evidence/import-apply.json`
- `rtk wrangler d1 execute DB --remote --command "SELECT role, COUNT(*) AS count FROM people GROUP BY role ORDER BY role;"`
- `rtk wrangler d1 execute DB --remote --command "SELECT COUNT(*) AS count FROM scan_records;"`

### Must Have
- Preserve the existing `people` schema contract: `person_id`, `display_name`, `role`, `secret_id`, `secret_path_token`.
- Preserve role boundaries: only `student` and `mentor` come from `userlist.csv`; admin remains `ADMIN_SECRET`-gated.
- Generate URL-safe secret path tokens that satisfy `^[a-z0-9-]+$`.
- Make reruns idempotent: second apply against unchanged CSV must report zero net data changes.
- Back up production data before destructive writes.
- Reset attendance data explicitly before replacing people.
- Keep admin CSV export contract unchanged: `student name,secret id,mentor scanned,date,notes`.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- Must NOT import admins into the `people` table.
- Must NOT exceed the chosen 20-person roster in this rollout.
- Must NOT use comma-splitting or ad hoc parsing for `userlist.csv`.
- Must NOT generate uppercase, spaced, or punctuation-bearing secret path tokens.
- Must NOT leave partial remote writes without a recorded backup and post-apply verification artifact.
- Must NOT change student/mentor/admin route shapes from `/{role}/{secretToken}`.
- Must NOT change the admin export column order or expose `secret_path_token` in admin export APIs.

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed.
- Test decision: minimal tests + existing Vitest framework in `test/integration/*.test.ts`
- QA policy: Every task includes agent-executed happy-path and failure/edge-case scenarios.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks for max parallelism.

Wave 1: foundation and canonical import contract (Tasks 1-2)
Wave 2: local/test alignment and remote apply path (Tasks 3-4)
Wave 3: production verification and docs revision (Task 5)

### Dependency Matrix (full, all tasks)
- Task 1 blocks Tasks 2-5
- Task 2 blocks Tasks 3-5
- Task 3 depends on Task 2 and blocks Task 5
- Task 4 depends on Task 2 and blocks Task 5
- Task 5 depends on Tasks 3-4
- Final Verification Wave depends on Tasks 1-5

### Agent Dispatch Summary (wave → task count → categories)
- Wave 1 → 2 tasks → deep, quick
- Wave 2 → 2 tasks → deep, unspecified-high
- Wave 3 → 1 task → writing

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [x] 1. Lock the canonical roster-selection and identity-generation contract

  **What to do**: Implement a single canonicalization contract for `userlist.csv` rows. Parse the CSV with a real parser, normalize `Role` to lowercase, trim surrounding whitespace in `Name` and `Role`, collapse internal repeated spaces, preserve punctuation in `display_name`, and deduplicate by normalized `(display_name, role)`. After dedupe, select the first 10 unique `student` rows and first 10 unique `mentor` rows in original file order. Generate stable IDs from this selected roster using a deterministic slug-based scheme: `student-{slug}` / `mentor-{slug}` for `person_id`, `student-secret-{slug}` / `mentor-secret-{slug}` for `secret_id`, and `student-{slug}` / `mentor-{slug}` for `secret_path_token`; when normalized slug collisions occur within the same role, append `-2`, `-3`, etc. Persist the full canonical decision set into one import artifact that includes selected rows, skipped rows, duplicate reasons, and generated production links.
  **Must NOT do**: Do not infer admins from the CSV; do not exceed 10 selected rows per role; do not hand-edit generated IDs; do not use random UUIDs or non-rerunnable token generation for this rollout.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: this task defines the deterministic contract that all downstream work depends on.
  - Skills: `[]` - no extra skill required.
  - Omitted: `test-driven-development` - user selected minimal tests rather than TDD-first.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 2, 3, 4, 5 | Blocked By: none

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `userlist.csv:1-59` - source roster, duplicate row, quoted names with commas, abbreviated mentor names.
  - Pattern: `migrations/0001_initial_schema.sql:1-7` - `people` schema and allowed roles.
  - API/Type: `src/worker/types.ts:1-33` - role values and `PersonRecord` contract.
  - Pattern: `src/worker/validation/secret-links.ts:1-10` - secret token validation rule.
  - Pattern: `src/worker/services/secret-links.ts:10-45` - role/token URL path contract.
  - Pattern: `src/worker/db/people.ts:3-60` - current people lookup/list expectations.
  - External: `docs/prd/mentor-student-qr-attendance-v1.md:75-83` - role-specific secret-link requirement.
  - External: `docs/prd/mentor-student-qr-attendance-v1.md:142-148` - stable identity requirement.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `node ./scripts/import-users.mjs --csv ./userlist.csv --base-url https://absen-qr.rif42.workers.dev --dry-run --output ./.sisyphus/evidence/task-1-canonical-contract.json` exits 0.
  - [ ] The dry-run artifact reports exactly 10 selected students and 10 selected mentors.
  - [ ] Every generated `secret_path_token` in the artifact matches `^[a-z0-9-]+$`.
  - [ ] Re-running the same dry-run command without changing `userlist.csv` produces byte-identical selected identities and links.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Canonical selection succeeds from current CSV
    Tool: Bash
    Steps: Run `node ./scripts/import-users.mjs --csv ./userlist.csv --base-url https://absen-qr.rif42.workers.dev --dry-run --output ./.sisyphus/evidence/task-1-canonical-contract.json`; then inspect the JSON artifact for selected counts and generated fields.
    Expected: Command exits 0; artifact shows 20 selected users total, duplicate rows annotated, and generated links rooted at `https://absen-qr.rif42.workers.dev`.
    Evidence: .sisyphus/evidence/task-1-canonical-contract.json

  Scenario: Token/slug collision is resolved deterministically
    Tool: Bash
    Steps: Run the import script against a small fixture containing two same-role rows that normalize to the same slug; capture output artifact.
    Expected: First row keeps base slug; second row gets `-2`; no duplicate `person_id`, `secret_id`, or `secret_path_token` values appear.
    Evidence: .sisyphus/evidence/task-1-collision.json
  ```

  **Commit**: YES | Message: `feat(import): define canonical real-user roster contract` | Files: `scripts/import-users.mjs`, `test/**`, optional fixture files

- [x] 2. Build the canonical artifact writer and CSV round-trip workflow

  **What to do**: Implement the import pipeline so the dry-run artifact can also write back to `userlist.csv`. Append deterministic metadata columns without destroying the existing `Name,Role` data: `Selected`, `Status`, `Person ID`, `Secret ID`, `Secret Token`, `Secret Link`, `Selection Order`. For selected rows, populate all generated values. For skipped rows, keep generated columns blank except `Selected=NO` and `Status` containing a deterministic reason such as `duplicate`, `over-quota-student`, or `over-quota-mentor`. Preserve CSV quoting for names containing commas and keep original row order.
  **Must NOT do**: Do not reorder source rows; do not overwrite `Name` or `Role`; do not emit partial columns that vary between runs.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: bounded implementation centered on one script and deterministic file output.
  - Skills: `[]` - no extra skill required.
  - Omitted: `xlsx` - deliverable stays CSV, not spreadsheet-first workflow.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 3, 4, 5 | Blocked By: 1

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `userlist.csv:1-59` - existing two-column source file.
  - Pattern: `src/worker/services/secret-links.ts:10-45` - role/token path shape used by generated links.
  - Pattern: `src/worker/validation/secret-links.ts:3-10` - token character restrictions.
  - Pattern: `docs/prd/mentor-student-qr-attendance-v1.md:75-78` - one secret link per person.
  - Test: `test/integration/student-api.test.ts:34-62` - role isolation on secret-token routes.
  - Test: `test/integration/mentor-api.test.ts:40-73` - mentor route identity expectations.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `node ./scripts/import-users.mjs --csv ./userlist.csv --base-url https://absen-qr.rif42.workers.dev --write-csv --dry-run --output ./.sisyphus/evidence/task-2-csv-roundtrip.json` exits 0.
  - [ ] Updated `userlist.csv` preserves row count and original ordering while adding the planned metadata columns.
  - [ ] Every selected row has a non-empty production `Secret Link` and every skipped row has a deterministic non-empty `Status`.
  - [ ] Running the write-csv dry-run twice without source changes produces identical file contents.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: CSV is rewritten deterministically with generated secret links
    Tool: Bash
    Steps: Back up `userlist.csv`, run `node ./scripts/import-users.mjs --csv ./userlist.csv --base-url https://absen-qr.rif42.workers.dev --write-csv --dry-run --output ./.sisyphus/evidence/task-2-csv-roundtrip.json`, then compare rewritten CSV shape and restore the backup if dry-run mode writes to a temp target.
    Expected: CSV content preserves original rows and quoting, adds the planned metadata columns, and selected rows contain full production links.
    Evidence: .sisyphus/evidence/task-2-csv-roundtrip.json

  Scenario: Malformed role or malformed CSV row fails cleanly
    Tool: Bash
    Steps: Run the script against a fixture with an invalid role label and a malformed quoted row.
    Expected: Command exits non-zero with a deterministic validation error and writes no remote/apply artifact.
    Evidence: .sisyphus/evidence/task-2-invalid-csv.txt
  ```

  **Commit**: YES | Message: `feat(import): round-trip user csv with generated links` | Files: `scripts/import-users.mjs`, `userlist.csv`, `test/**`

- [x] 3. Replace dummy local/test identity fixtures with the selected real roster

  **What to do**: Update local seed data, mock D1 fixtures, and integration expectations so the app no longer depends on `Student Local ##` / `Mentor Local ##` identities. Seed exactly the same 20 selected users produced by the canonical artifact. Ensure all role lookups, QR payload expectations, admin listing expectations, and route-isolation tests use the new deterministic `person_id`, `secret_id`, and `secret_path_token` values. Add only the minimum test coverage necessary to prove the new data contract remains valid under the existing APIs.
  **Must NOT do**: Do not change route semantics, API shapes, or admin export column order; do not introduce admin rows into `people`.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: coordinated fixture/test updates across seed, mocks, and several integration suites.
  - Skills: `[]` - no extra skill required.
  - Omitted: `frontend-design` - no UI redesign is needed.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 5 | Blocked By: 2

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `seed/dev.sql:1-14` - current destructive reseed shape.
  - API/Type: `src/worker/types.ts:27-43` - `PersonRecord` and `ScanRecord` contract.
  - Test: `test/integration/student-api.test.ts:34-205` - student identity, duplicate rejection, and QR payload expectations.
  - Test: `test/integration/mentor-api.test.ts:40-219` - mentor identity, QR payload, recent scans, and notes expectations.
  - Test: `test/integration/admin-api.test.ts:72-209` - admin records/export expectations including `studentSecretId`.
  - Pattern: `migrations/0001_initial_schema.sql:1-24` - schema constraints that fixtures must satisfy.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `rtk npm test` passes after the fixture/seed updates.
  - [ ] `rtk npm run typecheck` passes after the fixture/seed updates.
  - [ ] `seed/dev.sql` (or replacement local-seed asset) contains only selected real users and no `Student Local` / `Mentor Local` dummy names.
  - [ ] Integration tests still prove student/mentor role isolation and admin export `secret id` behavior.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Local test suite passes on real-user fixtures
    Tool: Bash
    Steps: Run `rtk npm test` and `rtk npm run typecheck` after updating seeds and tests.
    Expected: All Vitest suites and typecheck pass with no references to dummy identities remaining.
    Evidence: .sisyphus/evidence/task-3-tests.txt

  Scenario: Admin export contract remains unchanged
    Tool: Bash
    Steps: Run the focused admin integration suite and inspect export assertions.
    Expected: Export still uses `student name,secret id,mentor scanned,date,notes` and does not expose `secret_path_token`.
    Evidence: .sisyphus/evidence/task-3-admin-export.txt
  ```

  **Commit**: YES | Message: `test(data): align fixtures with real user roster` | Files: `seed/dev.sql`, `test/**`, mock support files

- [x] 4. Implement the production D1 reset-and-apply workflow from the canonical artifact

  **What to do**: Add the production apply path to the import pipeline. Before any destructive write, export a backup of current `people` and `scan_records` into `.sisyphus/evidence/`. Then execute a remote apply sequence against D1 using Wrangler: verify target DB binding, delete all `scan_records`, delete all `people`, insert the 20 selected canonical records, and run post-apply queries for counts and uniqueness. The apply command must be safe to rerun: if the canonical artifact is unchanged and production already matches it, the second run must report no net changes. Record every step and query result into machine-readable evidence files.
  **Must NOT do**: Do not mutate production before creating a backup; do not update `people` without resetting `scan_records`; do not hardcode a different database name or bypass Wrangler/D1 commands.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: this is the highest-risk production workflow with destructive writes and recovery requirements.
  - Skills: `[]` - no extra skill required.
  - Omitted: `git-master` - no git action is part of this task itself.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 5 | Blocked By: 2

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `wrangler.jsonc:13-21` - D1 binding and database identity.
  - Pattern: `package.json:7-15` - existing Wrangler migration/seed command style.
  - Pattern: `migrations/0001_initial_schema.sql:1-24` - production schema to preserve.
  - Pattern: `src/worker/db/people.ts:3-60` - lookups that must continue working after apply.
  - Pattern: `src/worker/routes/admin.ts:18-20` - admin auth stays env-secret-based, not people-table-based.
  - External: `README.md:68-80` - current remote migration/seed deployment flow.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `node ./scripts/import-users.mjs --csv ./userlist.csv --base-url https://absen-qr.rif42.workers.dev --backup-remote --apply-remote --output ./.sisyphus/evidence/task-4-apply.json` exits 0.
  - [ ] Backup artifacts for pre-apply `people` and `scan_records` exist under `.sisyphus/evidence/`.
  - [ ] `rtk wrangler d1 execute DB --remote --command "SELECT role, COUNT(*) AS count FROM people GROUP BY role ORDER BY role;"` returns exactly 10 students and 10 mentors.
  - [ ] `rtk wrangler d1 execute DB --remote --command "SELECT COUNT(*) AS count FROM scan_records;"` returns 0 immediately after apply.
  - [ ] Running the same apply command again without changing `userlist.csv` reports zero inserts, zero deletes, and zero token changes.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Production reset and import succeed from the canonical artifact
    Tool: Bash
    Steps: Run the backup/apply command, then run the two post-apply D1 count queries.
    Expected: Backup files exist; `people` contains 10 mentors and 10 students; `scan_records` is empty; apply artifact records success.
    Evidence: .sisyphus/evidence/task-4-apply.json

  Scenario: Remote apply failure stops before partial success is reported
    Tool: Bash
    Steps: Run the apply command with an intentionally invalid remote target or forced SQL failure in a controlled test path.
    Expected: Command exits non-zero, emits a failure artifact, and retains the pre-apply backup for recovery.
    Evidence: .sisyphus/evidence/task-4-apply-failure.txt
  ```

  **Commit**: YES | Message: `feat(import): add production d1 reset and sync workflow` | Files: `scripts/import-users.mjs`, helper SQL/assets, optional tests

- [x] 5. Verify live secret-link behavior and revise docs for the expanded real-user test roster

  **What to do**: After production apply succeeds, use the generated production links for at least one selected student and one selected mentor to verify live route resolution, identity payloads, and role isolation. Then update the docs to reflect the expanded 20-person real-user testing roster, the attendance reset rollout assumption, and the canonical import workflow. Keep CSV export contract language unchanged.
  **Must NOT do**: Do not revise docs before the actual roster-selection/apply rules are final; do not claim full-roster support beyond the selected 20-person test rollout.

  **Recommended Agent Profile**:
  - Category: `writing` - Reason: combines post-rollout documentation accuracy with a bounded verification summary.
  - Skills: `[]` - no extra skill required.
  - Omitted: `playwright` - optional for execution, but not required as a planning skill.

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: none | Blocked By: 3, 4

  **References** (executor has NO interview context - be exhaustive):
  - External: `docs/README.md:1-10` - docs are project-facing source of truth.
  - External: `docs/prd/mentor-student-qr-attendance-v1.md:17-23` - goals and current v1 architecture framing.
  - External: `docs/prd/mentor-student-qr-attendance-v1.md:182-191` - constraints/assumptions to revise carefully.
  - External: `docs/implementation/mentor-student-qr-attendance-v1-plan.md:16-25` - locked constraints and current pilot-size language.
  - Pattern: `src/worker/services/secret-links.ts:10-45` - role/token route structure to verify live.
  - Test: `test/integration/student-api.test.ts:34-62` - expected student route isolation behavior.
  - Test: `test/integration/mentor-api.test.ts:40-73` - expected mentor route isolation behavior.

  **Acceptance Criteria** (agent-executable only):
  - [ ] A scripted GET against one selected student production link returns the correct student identity payload.
  - [ ] A scripted GET against one selected mentor production link returns the correct mentor identity payload and QR payload.
  - [ ] A cross-role negative test against a mismatched secret link returns a not-found/forbidden response.
  - [ ] `docs/prd/mentor-student-qr-attendance-v1.md` and `docs/implementation/mentor-student-qr-attendance-v1-plan.md` reflect the expanded 20-person testing exception and reset-based rollout.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Live production secret links resolve for selected users
    Tool: Bash
    Steps: Use generated links from `userlist.csv` to request one selected student `/api/me` endpoint and one selected mentor `/api/me` endpoint.
    Expected: Student response contains the selected student's `personId`, `displayName`, and `secretId`; mentor response contains the selected mentor's identity plus `absenqr:v1:mentor:<mentorId>` QR payload.
    Evidence: .sisyphus/evidence/task-5-live-links.txt

  Scenario: Cross-role secret-link misuse is still rejected
    Tool: Bash
    Steps: Call a student route using a selected mentor token and call a mentor route using a selected student token.
    Expected: Both requests fail with the same role-isolation behavior already enforced by the app.
    Evidence: .sisyphus/evidence/task-5-role-isolation.txt
  ```

  **Commit**: YES | Message: `docs(rollout): document real-user test roster sync` | Files: `docs/prd/mentor-student-qr-attendance-v1.md`, `docs/implementation/mentor-student-qr-attendance-v1-plan.md`, evidence summaries

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [x] F1. Plan Compliance Audit — oracle
- [x] F2. Code Quality Review — unspecified-high
- [x] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [x] F4. Scope Fidelity Check — deep

## Commit Strategy
- Commit 1: import pipeline + canonical artifact generation
- Commit 2: seed/test fixture alignment + prod apply workflow
- Commit 3: docs update + verification artifacts

## Success Criteria
- Production `people` table contains exactly 10 students and 10 mentors from `userlist.csv` according to the deterministic selection rule.
- Production `scan_records` is empty immediately after rollout reset.
- Selected users can resolve their production secret links on the live app with correct role isolation.
- `userlist.csv` contains generated production secret links for selected rows and deterministic skip/dedupe status for non-selected duplicates.
- Local tests and typecheck pass without changing the existing role/route contracts.
