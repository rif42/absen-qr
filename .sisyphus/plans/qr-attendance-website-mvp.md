# QR Attendance Website MVP

## TL;DR
> **Summary**: Build a minimal single-event attendance website on Cloudflare Workers. Public users select their seeded name, receive a one-time QR token, and an admin opens a secret admin URL to scan tokens and view a live attendance dashboard.
> **Deliverables**:
> - Cloudflare Worker with static attendee/admin pages
> - D1 schema + seed flow for allowed names
> - One-time token issuance + atomic consumption
> - Secret-path admin dashboard with browser-camera scanning
> - Automated tests and agent-executed QA evidence
> **Effort**: Medium
> **Parallel**: YES - 2 waves
> **Critical Path**: 1 → 2 → 4 → 6 → 7 → 8

## Context
### Original Request
Create a website with one text box for names, select from a predetermined list, generate a QR code, then let an admin on the same website scan the QR and get a list of scanned people.

### Interview Summary
- Repo is empty; this is a greenfield build.
- v1 is an **internal MVP** for **one event** only.
- Platform must be **as simple as possible**, preferably **Cloudflare Workers**.
- Admin access uses a **secret URL path**, not a traditional login/session flow.
- Allowed people are **pre-seeded during build/deploy**.
- Public flow uses **suggestions from a predetermined list**, not exact-match-only and not fuzzy typo matching.
- QR payload must be an **opaque single-use token**.
- Admin scans with the **browser camera** and sees an **attendance dashboard**.
- Test infrastructure must be included from the start.

### Metis Review (gaps addressed)
- Locked attendee identity to **immutable `person_id` + unique normalized display name**; duplicate normalized names fail seed validation.
- Locked token lifecycle: issuing a new token for a person **invalidates any prior unused token** for that same person.
- Locked persistence to **D1**; rejected KV and no-persistence because single-use token consumption must be durable and atomic.
- Locked admin auth default to **path-secret** instead of query-secret.
- Added guardrails for replay handling, browser-camera HTTPS requirement, and scope control for the dashboard.

## Work Objectives
### Core Objective
Implement the smallest viable Cloudflare Workers app that supports attendee self-selection from a seeded list, QR-based check-in, and a secret-path admin dashboard for one-event attendance tracking.

### Deliverables
- `package.json`, `wrangler.jsonc`, test configs, and Worker scaffold
- `public/` static assets for attendee and admin pages
- `src/worker/index.ts` plus small server helpers
- `migrations/0001_schema.sql`
- `seed/people.json` plus seed/validation script
- Automated unit, integration, and UI smoke coverage

### Definition of Done (verifiable conditions with commands)
- `rtk npm run test:unit` exits with code 0.
- `rtk npm run test:integration` exits with code 0.
- `rtk npm run test:e2e` exits with code 0.
- `rtk npm run typecheck` exits with code 0.
- `rtk npm run seed:local` applies local D1 schema + seed data without errors.

### Must Have
- Single Worker app serving public page, admin page, and JSON APIs.
- D1-backed persistence for people, issued tokens, and attendance.
- Seed validation that rejects duplicate normalized display names.
- Public attendee page with suggestion-based selection from seeded people.
- QR generation from an opaque one-time token only.
- Admin route at `/admin/<secret>` with server-side secret validation on all admin routes/APIs.
- Atomic token consumption that records attendance once and rejects replay.
- Dashboard showing total, checked-in, remaining, and per-person checked-in status.
- Browser-camera scan UI plus manual token entry fallback for QA and camera-permission failure handling.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- No traditional auth, sessions, cookies, OAuth, SSO, or user accounts.
- No multi-event support.
- No CSV upload, admin-managed people CRUD, or exports.
- No notifications, email/SMS, analytics, offline mode, or mobile app.
- No KV or Durable Objects unless D1 is proven insufficient.
- No storing names or person IDs directly inside the QR payload.

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed.
- Test decision: **tests-from-start** using **Vitest** for domain/integration and **Playwright** for browser smoke/UI verification.
- QA policy: Every task includes agent-executed happy-path and failure-path scenarios.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks for max parallelism.

Wave 1: 1 scaffold + test harness, 2 schema + seed validation, 3 attendee list page/API, 4 token issuance + QR API

Wave 2: 5 admin secret gating + dashboard API, 6 atomic token consumption + replay handling, 7 browser scanner + manual fallback UI, 8 deploy/seed scripts + full smoke coverage

### Dependency Matrix (full, all tasks)
| Task | Depends On | Blocks |
|---|---|---|
| 1 | None | 2,3,4,5,6,7,8 |
| 2 | 1 | 3,4,5,6,8 |
| 3 | 1,2 | 4,8 |
| 4 | 1,2,3 | 6,7,8 |
| 5 | 1,2 | 7,8 |
| 6 | 1,2,4,5 | 7,8 |
| 7 | 4,5,6 | 8 |
| 8 | 1,2,3,4,5,6,7 | F1-F4 |

### Agent Dispatch Summary (wave → task count → categories)
- Wave 1 → 4 tasks → `quick`, `unspecified-high`, `visual-engineering`
- Wave 2 → 4 tasks → `unspecified-high`, `deep`, `visual-engineering`
- Final Verification → 4 tasks → `oracle`, `unspecified-high`, `deep`

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [ ] 1. Scaffold the Cloudflare Worker app and test harness

  **What to do**:
  - Create the exact initial structure: `src/worker/index.ts`, `public/index.html`, `public/app.js`, `public/admin.html`, `public/admin.js`, `public/styles.css`, `migrations/0001_schema.sql`, `seed/people.json`, `scripts/seed-d1.mjs`, `test/unit/`, `test/integration/`, `test/e2e/`.
  - Create `package.json` scripts: `dev`, `typecheck`, `test:unit`, `test:integration`, `test:e2e`, `seed:local`.
  - Configure `wrangler.jsonc` with a D1 binding named `DB`, an assets binding named `ASSETS`, and env var binding for `ADMIN_SECRET`.
  - Add Vitest and Playwright configuration, but keep runtime code framework-free: native Worker fetch routing only.
  - Start with failing smoke tests that assert the Worker boots and `/` returns HTML.

  **Must NOT do**:
  - Do not add Hono, React, Next.js, or any UI framework.
  - Do not add Auth.js, sessions, or cookies.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: mostly repo scaffolding and config with low ambiguity.
  - Skills: [`test-driven-development`] - enforce failing smoke tests before scaffold completion.
  - Omitted: [`frontend-design`] - minimal functional HTML is sufficient.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 2,3,4,5,6,7,8 | Blocked By: none

  **References**:
  - Pattern: `.sisyphus/plans/qr-attendance-website-mvp.md:20-28` - locked greenfield, Cloudflare-first, seeded-list, and internal-MVP constraints.
  - Pattern: `.sisyphus/plans/qr-attendance-website-mvp.md:30-35` - resolved Metis decisions on path-secret auth, D1 persistence, and replay guardrails.
  - External: `https://developers.cloudflare.com/workers/` - Worker runtime baseline.
  - External: `https://developers.cloudflare.com/workers/static-assets/binding` - same-Worker static asset binding.

  **Acceptance Criteria**:
  - [ ] `rtk npm run typecheck` passes with the scaffolded config.
  - [ ] `rtk npm run test:integration -- worker-smoke` passes and asserts `GET /` returns `200` + `text/html`.
  - [ ] `wrangler.jsonc` defines `DB`, `ASSETS`, and `ADMIN_SECRET` exactly once.

  **QA Scenarios**:
  ```
  Scenario: Worker smoke boot
    Tool: Bash
    Steps: Run `rtk npm run test:integration -- worker-smoke`
    Expected: Exit code 0; test asserts `GET /` returns 200 and HTML content type
    Evidence: .sisyphus/evidence/task-1-worker-smoke.txt

  Scenario: Missing config regression
    Tool: Bash
    Steps: Run `rtk grep "ADMIN_SECRET|ASSETS|DB" wrangler.jsonc`
    Expected: All three bindings appear; no missing required binding
    Evidence: .sisyphus/evidence/task-1-bindings.txt
  ```

  **Commit**: YES | Message: `chore(worker): scaffold cloudflare attendance app` | Files: `package.json`, `wrangler.jsonc`, `src/worker/*`, `public/*`, `test/*`

- [ ] 2. Define D1 schema, seed model, and seed validation rules

  **What to do**:
  - Create D1 schema with three tables only: `people`, `issued_tokens`, and `attendance`.
  - `people` columns: `person_id TEXT PRIMARY KEY`, `display_name TEXT NOT NULL`, `normalized_name TEXT NOT NULL UNIQUE`.
  - `issued_tokens` columns: `token TEXT PRIMARY KEY`, `person_id TEXT NOT NULL`, `issued_at INTEGER NOT NULL`, `invalidated_at INTEGER`, `used_at INTEGER`.
  - `attendance` columns: `person_id TEXT PRIMARY KEY`, `token TEXT NOT NULL UNIQUE`, `checked_in_at INTEGER NOT NULL`.
  - Seed file format: array of `{ "personId": "p_alice_tan", "displayName": "Alice Tan" }` objects.
  - Add seed validation that lowercases + trims display names into `normalized_name`; duplicates fail fast before DB writes.
  - Seed flow must load `seed/people.json` into D1 as part of `npm run seed:local`.

  **Must NOT do**:
  - Do not add an `events` table.
  - Do not store attendance only in memory or KV.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: schema and validation choices affect every later task.
  - Skills: [`test-driven-development`] - seed validation and schema tests must fail first.
  - Omitted: [`playwright`] - not needed for schema/domain work.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 3,4,5,6,8 | Blocked By: 1

  **References**:
  - Pattern: `.sisyphus/plans/qr-attendance-website-mvp.md:21-28` - suggestion-based list, single-use QR, single event, single admin, tests-from-start.
  - Pattern: `.sisyphus/plans/qr-attendance-website-mvp.md:30-35` - token lifecycle, D1 choice, path-secret auth, and replay-handling decisions.
  - External: `https://developers.cloudflare.com/d1/` - D1 schema and local migration workflow.

  **Acceptance Criteria**:
  - [ ] `rtk npm run test:unit -- seed-validation` passes and rejects duplicate normalized names.
  - [ ] `rtk npm run seed:local` creates/populates local D1 without errors.
  - [ ] Local query against `people` returns seeded rows for `Alice Tan`, `Bob Lee`, and `Carla Diaz`.

  **QA Scenarios**:
  ```
  Scenario: Seed valid people into local D1
    Tool: Bash
    Steps: Run `rtk npm run seed:local`
    Expected: Local D1 contains three seeded people and no duplicate-name error
    Evidence: .sisyphus/evidence/task-2-seed-local.txt

  Scenario: Duplicate normalized names fail
    Tool: Bash
    Steps: Run `rtk npm run test:unit -- seed-validation`
    Expected: Test covers `Alice Tan` + ` alice  tan ` and expects validation failure
    Evidence: .sisyphus/evidence/task-2-seed-validation.txt
  ```

  **Commit**: YES | Message: `feat(data): add d1 schema and seed validation` | Files: `migrations/*`, `seed/*`, `scripts/seed-d1.mjs`, `test/unit/*`

- [ ] 3. Implement the attendee page and seeded-people suggestion flow

  **What to do**:
  - Implement `GET /api/people` returning the full seeded people list as JSON sorted by `display_name` ascending.
  - Implement public page UI with exactly these selectors: `[data-testid="name-input"]`, `[data-testid="name-submit"]`, `[data-testid="qr-output"]`, `[data-testid="name-error"]`.
  - Use a native `<datalist>` or equivalent zero-framework suggestion UI fed from `/api/people`.
  - Require an exact selected seeded person before enabling QR generation.
  - Store the selected `personId` client-side after matching the chosen name.

  **Must NOT do**:
  - Do not expose admin controls on the public page.
  - Do not allow free-text names outside the seeded list.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - Reason: static HTML/JS UI plus API integration.
  - Skills: [`test-driven-development`, `playwright`] - DOM behavior and page flow need browser verification.
  - Omitted: [`frontend-design`] - no custom design system needed.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 4,8 | Blocked By: 1,2

  **References**:
  - Pattern: `.sisyphus/plans/qr-attendance-website-mvp.md:21-28` - internal MVP, suggestion-based selection, single-event scope.
  - Pattern: `.sisyphus/plans/qr-attendance-website-mvp.md:56-73` - must-have name lookup and explicit out-of-scope guardrails.
  - External: `https://developers.cloudflare.com/workers/` - JSON route handling in Worker.

  **Acceptance Criteria**:
  - [ ] `rtk npm run test:integration -- people-route` passes and asserts `GET /api/people` returns seeded rows sorted ascending.
  - [ ] `rtk npm run test:e2e -- attendee-selection` passes and asserts typing `Ali` exposes `Alice Tan` and selecting it clears `[data-testid="name-error"]`.
  - [ ] Submitting without a valid seeded match shows a deterministic error message in `[data-testid="name-error"]`.

  **QA Scenarios**:
  ```
  Scenario: Valid suggestion selection
    Tool: Playwright
    Steps: Open `/`; wait for `[data-testid="name-input"]`; type `Ali`; choose `Alice Tan`; click `[data-testid="name-submit"]`
    Expected: No validation error before token issuance; selected `personId` is ready for API submission
    Evidence: .sisyphus/evidence/task-3-attendee-selection.png

  Scenario: Invalid free-text rejection
    Tool: Playwright
    Steps: Open `/`; type `Not A Real Person`; click `[data-testid="name-submit"]`
    Expected: `[data-testid="name-error"]` shows a clear seeded-list-only error and no QR appears
    Evidence: .sisyphus/evidence/task-3-attendee-selection-error.png
  ```

  **Commit**: YES | Message: `feat(public): add attendee selection flow` | Files: `public/index.html`, `public/app.js`, `src/worker/index.ts`, `test/integration/*`, `test/e2e/*`

- [ ] 4. Implement token issuance and QR rendering with replacement semantics

  **What to do**:
  - Implement `POST /api/token` accepting `{ "personId": "p_alice_tan" }`.
  - Generate a random opaque base64url token; do not encode person name or ID into the token value.
  - On issuance, atomically invalidate any prior row in `issued_tokens` for the same person where `invalidated_at IS NULL AND used_at IS NULL`, then insert the new token row.
  - Render a QR as SVG using `qrcode` and return `{ token, qrSvg }`.
  - Public page must inject the SVG into `[data-testid="qr-output"]`.

  **Must NOT do**:
  - Do not return raw D1 row objects to the client.
  - Do not allow QR generation for unknown people.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: issuance semantics + QR rendering define the core domain contract.
  - Skills: [`test-driven-development`] - token rules must be locked via tests first.
  - Omitted: [`playwright`] - browser smoke is enough; domain logic needs unit/integration first.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 6,7,8 | Blocked By: 1,2,3

  **References**:
  - Pattern: `.sisyphus/plans/qr-attendance-website-mvp.md:26-28` - opaque single-use QR, browser-camera admin, dashboard requirement.
  - Pattern: `.sisyphus/plans/qr-attendance-website-mvp.md:30-35` - one-time token, D1 durability, path-secret auth, and scope guardrails.
  - External: `https://www.npmjs.com/package/qrcode` - SVG QR generation.

  **Acceptance Criteria**:
  - [ ] `rtk npm run test:unit -- token-issuance` passes and proves a second issuance invalidates the first unused token.
  - [ ] `rtk npm run test:integration -- token-route` passes and asserts valid `personId` returns `200` with `token` + `qrSvg`.
  - [ ] `rtk npm run test:integration -- token-route` also asserts unknown `personId` returns `404` and no DB mutation.

  **QA Scenarios**:
  ```
  Scenario: Generate QR for a valid attendee
    Tool: Bash
    Steps: POST `{"personId":"p_alice_tan"}` to `/api/token`
    Expected: `200` JSON response containing a non-empty opaque `token` and SVG markup in `qrSvg`
    Evidence: .sisyphus/evidence/task-4-token-route.json

  Scenario: Reissue invalidates older token
    Tool: Bash
    Steps: Call `/api/token` twice for `p_alice_tan`; then attempt admin consume with the first token after Task 6 is available
    Expected: First token is invalid; only newest token can be consumed
    Evidence: .sisyphus/evidence/task-4-token-reissue.txt
  ```

  **Commit**: YES | Message: `feat(token): add qr issuance flow` | Files: `src/worker/index.ts`, `src/lib/*`, `public/app.js`, `test/unit/*`, `test/integration/*`

- [ ] 5. Implement admin secret-path gating and dashboard data API

  **What to do**:
  - Use `ADMIN_SECRET=dev-admin-secret` for local/test environments and document that production must set a different secret.
  - Implement `GET /admin/<secret>` to return `public/admin.html` only when `<secret>` matches `ADMIN_SECRET`; otherwise return `404`.
  - Implement `GET /api/admin/<secret>/dashboard` returning `{ totalPeople, checkedInCount, remainingCount, attendees }` where `attendees` contains `{ personId, displayName, checkedIn, checkedInAt }` sorted by `displayName`.
  - Admin HTML must contain `[data-testid="admin-status"]`, `[data-testid="dashboard-total"]`, `[data-testid="dashboard-checked-in"]`, `[data-testid="dashboard-remaining"]`, `[data-testid="attendee-list"]`.

  **Must NOT do**:
  - Do not reveal whether a wrong secret was close to correct.
  - Do not return admin JSON on unguarded routes.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: secret-guard correctness and dashboard contract are security-sensitive.
  - Skills: [`test-driven-development`, `playwright`] - both route guarding and DOM rendering must be locked.
  - Omitted: [`frontend-design`] - dashboard is functional, not decorative.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 6,7,8 | Blocked By: 1,2

  **References**:
  - Pattern: `.sisyphus/plans/qr-attendance-website-mvp.md:22-24` - Cloudflare simplicity, secret URL admin access, and seeded deployment model.
  - Pattern: `.sisyphus/plans/qr-attendance-website-mvp.md:62-65` - admin secret validation, dashboard fields, and scanner requirements.
  - External: `https://developers.cloudflare.com/workers/static-assets` - static admin asset delivery from Worker.

  **Acceptance Criteria**:
  - [ ] `rtk npm run test:integration -- admin-guard` passes and asserts wrong secret returns `404` for both HTML and JSON routes.
  - [ ] `rtk npm run test:integration -- dashboard-route` passes and asserts empty attendance returns total `3`, checked-in `0`, remaining `3` for the seeded dataset.
  - [ ] `rtk npm run test:e2e -- admin-dashboard` passes and asserts the guarded admin page renders the expected counters.

  **QA Scenarios**:
  ```
  Scenario: Admin page with correct secret
    Tool: Playwright
    Steps: Open `/admin/dev-admin-secret`
    Expected: `[data-testid="dashboard-total"]` shows `3`; page does not redirect or prompt for login
    Evidence: .sisyphus/evidence/task-5-admin-dashboard.png

  Scenario: Admin page with wrong secret
    Tool: Playwright
    Steps: Open `/admin/wrong-secret`
    Expected: HTTP 404 or visible not-found page; no dashboard selectors render
    Evidence: .sisyphus/evidence/task-5-admin-dashboard-error.png
  ```

  **Commit**: YES | Message: `feat(admin): add secret route and dashboard api` | Files: `src/worker/index.ts`, `public/admin.html`, `public/admin.js`, `test/integration/*`, `test/e2e/*`

- [ ] 6. Implement atomic token consumption and replay-safe attendance recording

  **What to do**:
  - Implement `POST /api/admin/<secret>/consume` accepting `{ "token": "..." }`.
  - Within one D1 transaction: load token, reject if missing/invalidated/used, mark `used_at`, and insert into `attendance` if the person is not already checked in.
  - If the person is already checked in, return `409` and do not create or overwrite attendance.
  - Return deterministic JSON statuses only: `checked_in`, `invalid_token`, `already_used`, `already_checked_in`.
  - Refresh dashboard counts from D1 after successful consumption.

  **Must NOT do**:
  - Do not treat replay as success.
  - Do not mutate attendance on malformed tokens.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: this is the highest-risk transactional logic in the app.
  - Skills: [`test-driven-development`] - race-safe consumption must be fully covered by failing tests first.
  - Omitted: [`playwright`] - core work is transactional backend logic.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: 7,8 | Blocked By: 1,2,4,5

  **References**:
  - Pattern: `.sisyphus/plans/qr-attendance-website-mvp.md:26-28` - single-use QR, camera admin, dashboard requirement, tests from start.
  - External: `https://developers.cloudflare.com/d1/` - durable SQL mutation path.

  **Acceptance Criteria**:
  - [ ] `rtk npm run test:unit -- token-consume` passes and proves consumed tokens cannot be reused.
  - [ ] `rtk npm run test:integration -- consume-route` passes and asserts first consume returns `checked_in` and second consume returns `already_used` or `already_checked_in` without a second attendance row.
  - [ ] `rtk npm run test:integration -- consume-route` passes malformed-token and invalidated-token cases with zero DB mutation.

  **QA Scenarios**:
  ```
  Scenario: Successful first scan
    Tool: Bash
    Steps: Issue token for `p_alice_tan`; POST it to `/api/admin/dev-admin-secret/consume`
    Expected: Response status is `checked_in`; D1 attendance contains exactly one row for `p_alice_tan`
    Evidence: .sisyphus/evidence/task-6-consume-success.txt

  Scenario: Replay protection
    Tool: Bash
    Steps: POST the same token again to `/api/admin/dev-admin-secret/consume`
    Expected: Response status is `already_used` or `already_checked_in`; attendance row count remains unchanged
    Evidence: .sisyphus/evidence/task-6-consume-replay.txt
  ```

  **Commit**: YES | Message: `feat(attendance): add atomic token consumption` | Files: `src/worker/index.ts`, `src/lib/*`, `test/unit/*`, `test/integration/*`

- [ ] 7. Implement the admin scanner UI and manual token fallback

  **What to do**:
  - In `public/admin.js`, start camera scanning only after explicit click on `[data-testid="start-scan"]`.
  - Add exact selectors: `[data-testid="scan-video"]`, `[data-testid="scan-result"]`, `[data-testid="manual-token-input"]`, `[data-testid="manual-token-submit"]`.
  - Use `getUserMedia` + `jsQR` + `<canvas>` loop for browser decoding.
  - On decoded token, call `/api/admin/<secret>/consume`, then refresh dashboard counters and attendee list.
  - Manual token submit must call the same consume endpoint and surface the same success/error states as camera scanning.

  **Must NOT do**:
  - Do not embed the admin secret in client-side constants outside the current path parsing logic.
  - Do not make the UI depend on a framework or bundler-specific runtime.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - Reason: browser camera behavior + admin UI state handling.
  - Skills: [`playwright`, `test-driven-development`] - browser behavior and fallback flow require scripted verification.
  - Omitted: [`frontend-design`] - UX should stay minimal and utilitarian.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: 8 | Blocked By: 4,5,6

  **References**:
  - Pattern: `.sisyphus/plans/qr-attendance-website-mvp.md:27-28` - browser-camera scan and dashboard requirement.
  - External: `https://github.com/cozmo/jsQR` - browser-side QR decode library.
  - External: `https://developers.cloudflare.com/workers/` - endpoint integration remains standard fetch.

  **Acceptance Criteria**:
  - [ ] `rtk npm run test:e2e -- admin-dashboard` passes and asserts manual token submit updates counters from `0/3` to `1/3` for `Alice Tan`.
  - [ ] `rtk npm run test:e2e -- admin-dashboard` passes and asserts failed token submission surfaces deterministic error text in `[data-testid="scan-result"]`.
  - [ ] Camera startup failure is handled gracefully with a visible message while manual token input remains usable.

  **QA Scenarios**:
  ```
  Scenario: Manual fallback consumes token and refreshes dashboard
    Tool: Playwright
    Steps: Open `/admin/dev-admin-secret`; fill `[data-testid="manual-token-input"]` with a valid token; click `[data-testid="manual-token-submit"]`
    Expected: `[data-testid="scan-result"]` shows success; `Alice Tan` becomes checked in; checked-in count increments to `1`
    Evidence: .sisyphus/evidence/task-7-manual-consume.png

  Scenario: Camera permission denied fallback
    Tool: Playwright
    Steps: Open `/admin/dev-admin-secret`; deny camera permission; click `[data-testid="start-scan"]`
    Expected: Visible camera-permission error appears and `[data-testid="manual-token-input"]` stays enabled
    Evidence: .sisyphus/evidence/task-7-camera-denied.png
  ```

  **Commit**: YES | Message: `feat(scanner): add camera scan and manual fallback` | Files: `public/admin.js`, `public/admin.html`, `public/styles.css`, `test/e2e/*`

- [ ] 8. Finalize local deploy flow, seed automation, and end-to-end smoke coverage

  **What to do**:
  - Add a single local bootstrap flow: migrate D1, seed people, and start the Worker in dev mode.
  - Add README-level executor notes only if strictly needed for running the app locally; keep them minimal.
  - Add full-path integration/e2e coverage for: valid check-in, invalid person, wrong admin secret, replay token, and dashboard counts.
  - Ensure the seeded test dataset is exactly: `Alice Tan`, `Bob Lee`, `Carla Diaz`.
  - Ensure Playwright tests use manual-token fallback for deterministic CI while keeping the real camera UI available in the product.

  **Must NOT do**:
  - Do not broaden scope with production infrastructure, analytics, or export features.
  - Do not leave seed steps as undocumented tribal knowledge.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: this is the consolidation and reliability pass across the full stack.
  - Skills: [`playwright`, `test-driven-development`] - final smoke coverage depends on both.
  - Omitted: [`frontend-design`] - final work is operational and verification-focused.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: F1-F4 | Blocked By: 1,2,3,4,5,6,7

  **References**:
  - Pattern: `.sisyphus/plans/qr-attendance-website-mvp.md:22-28` - tests from start, Cloudflare-first, URL auth, seeded list build-time.
  - Pattern: `.sisyphus/plans/qr-attendance-website-mvp.md:30-35` - locked MVP defaults and minimal dependency surface.
  - External: `https://developers.cloudflare.com/d1/`
  - External: `https://developers.cloudflare.com/workers/`

  **Acceptance Criteria**:
  - [ ] `rtk npm run test:unit` passes.
  - [ ] `rtk npm run test:integration` passes.
  - [ ] `rtk npm run test:e2e` passes.
  - [ ] `rtk npm run seed:local` is documented and reproducible on a clean checkout.

  **QA Scenarios**:
  ```
  Scenario: Full happy-path attendance smoke
    Tool: Playwright
    Steps: Open `/`; choose `Alice Tan`; generate QR/token; open `/admin/dev-admin-secret`; submit token via manual fallback; refresh dashboard
    Expected: `Alice Tan` marked checked in; totals show 3 total, 1 checked in, 2 remaining
    Evidence: .sisyphus/evidence/task-8-happy-path.png

  Scenario: End-to-end invalid admin secret
    Tool: Playwright
    Steps: Open `/admin/not-the-secret`
    Expected: Not-found experience only; no dashboard data leaked
    Evidence: .sisyphus/evidence/task-8-wrong-secret.png
  ```

  **Commit**: YES | Message: `chore(release): finalize seed flow and smoke coverage` | Files: `scripts/*`, `test/*`, minimal run docs

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [ ] F1. Plan Compliance Audit — oracle
- [ ] F2. Code Quality Review — unspecified-high
- [ ] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [ ] F4. Scope Fidelity Check — deep

## Commit Strategy
- Use Metis-recommended atomic commits in this exact order:
  1. `chore(worker): scaffold cloudflare attendance app`
  2. `feat(data): add d1 schema and seed validation`
  3. `feat(public): add attendee selection flow`
  4. `feat(token): add qr issuance flow`
  5. `feat(admin): add secret route and dashboard api`
  6. `feat(attendance): add atomic token consumption`
  7. `feat(scanner): add camera scan and manual fallback`
  8. `chore(release): finalize seed flow and smoke coverage`
- Each commit must leave relevant tests green before moving to the next task.
- Do not squash tasks together during execution.

## Success Criteria
- Public user can only generate QR for a seeded name.
- Each newly generated token invalidates the prior unused token for that person.
- Admin can open exactly one secret path and access dashboard + scanner without a login form.
- Consuming a valid token checks in the person once and only once.
- Replays, malformed tokens, and wrong secrets fail deterministically with no data corruption.
- Dashboard always shows accurate total, checked-in, and remaining counts for the seeded three-person dataset and for arbitrary larger seeded datasets.
