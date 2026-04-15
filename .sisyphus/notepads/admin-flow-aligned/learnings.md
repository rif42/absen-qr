# Learnings

- 2026-04-11: `test/support/mock-d1.ts` now mirrors planned admin helper SQL by recognizing `people` role-list queries ordered by `display_name ASC`, event-day `scan_records` joins against `people AS student` and `people AS mentor`, and single-record lookups by `scan_id`.
- 2026-04-11: The admin mock returns joined rows with `student_name`, `student_secret_id`, and `mentor_name` layered onto the underlying `scan_records` fields, which keeps future admin table/export helpers aligned with D1-style joined query results.
- 2026-04-11: Generic admin-style `UPDATE scan_records ... WHERE scan_id = ?n` handling can stay minimal by parsing the `SET` clause for `notes`, `student_id`, `mentor_id`, and `updated_at`, then checking the existing `(student_id, mentor_id, event_date)` uniqueness rule before mutating in-memory state.
- 2026-04-11: Admin record ordering needs explicit scan-id tie breaking: records list uses `scanned_at DESC, scan_id DESC`, while export uses `scanned_at ASC, scan_id ASC`.

- Admin now follows the same static shell convention as the student and mentor pages: `main.shell` → `header.page-header` → stacked card sections with stable IDs for tests.
- The locked admin contract can stay purely static while still exposing the required hooks exactly once: `page-title`, `status-banner`, `controls-card`, `export-csv-button`, `records-card`, `records-loading`, `records-empty-state`, `records-table`, and `records-table-body`.

- 2026-04-11: `src/worker/db/admin-records.ts` keeps every admin joined query in one place and maps the D1-style snake_case row fields into a locked camelCase table/export contract before returning data to callers.
- 2026-04-11: Admin option lists should reuse `listPeopleByRole` but must narrow each person down to `{ personId, displayName }`, which prevents `secret_path_token` from leaking through the shared admin records payload.
- 2026-04-11: `GET /admin/:secret/api/records` can return `getAdminRecordsPayload(env.DB, eventDate)` directly once the admin secret passes, and the route can keep the existing `403` and `405` conventions without touching the export or record-mutation branches.
- 2026-04-11: The integration contract for admin records should stay exact: response JSON only exposes `eventDate`, `records`, `students`, and `mentors`, with the records list still ordered newest-first from the helper.
- 2026-04-11: `GET /admin/:secret/api/export.csv` should stay on a local serializer in the route, using `listAdminExportRows(env.DB, eventDate)` plus the exact header `student name,secret id,mentor scanned,date,notes`, `text/csv; charset=utf-8`, and an `attachment; filename="attendance-<eventDate>.csv"` disposition.
- 2026-04-11: CSV notes must escape commas, double quotes, and embedded newlines by quoting the field and doubling `"`, while the `date` column must continue to come from `event_date`.
- 2026-04-11: `PATCH /admin/:secret/api/records/:scanId` now rejects non-object JSON, unknown keys, and wrong field types up front, while still allowing any valid combination of `notes`, `studentId`, and `mentorId`, including `notes: ""` to clear stored notes.
- 2026-04-11: Admin PATCH updates should mutate the existing `scan_records` row in place, always refresh `updated_at`, and then re-read the joined admin row so the response, `GET /records`, and `GET /export.csv` all reflect the same latest corrected state.
- 2026-04-11: Admin DELETE now follows the same locked admin contract pattern as PATCH: a small `deleteAdminRecord` helper hard-deletes by `scan_id`, and the route returns `{ deleted: true, scanId }` only after the row is confirmed present and removed.
- 2026-04-13: The admin page runtime can stay framework-free by deriving `/admin/:secret` from `window.location.pathname`, fetching `GET /admin/:secret/api/records` on load, and wiring row-level save/delete handlers directly against the locked admin APIs.
- 2026-04-13: The admin export button works best as a direct browser navigation to `/admin/:secret/api/export.csv`; that keeps CSV generation server-side and avoids any client-side serialization path.
- 2026-04-13: The admin page integration test can run without jsdom by stubbing `document`, `window`, and `fetch` with a tiny in-test fake DOM that supports `classList`, `replaceChildren`, event listeners, and `remove()`.
- 2026-04-13: Admin load success copy should stay non-numeric; `Records loaded and ready.` keeps the status useful without reintroducing a record counter.

- 2026-04-13: Playwright support is not yet present in package scripts or deps; the repo currently has only Vitest/Wrangler scripts in package.json, so adding Task 9 will need a new playwright devDependency plus test:e2e and likely playwright test scripts.
- 2026-04-13: TypeScript config is strict ES2022/Bundler/WebWorker with allowJs false and include limited to src/**/*.ts, src/**/*.d.ts, test/**/*.ts, and vitest.config.ts; that means playwright.config.ts will need to be TypeScript-safe at repo root, while helper code should stay in .ts files under test/ (or src/ if shared).
- 2026-04-13: Admin runtime derives /admin/:secret from window.location.pathname and fetches /api/records, while export navigates to /api/export.csv; an E2E spec opening /admin/local-admin-secret-token should assert both path derivation and server-side secret gating.
- 2026-04-13: Wrangler assets are served from ./public with html_handling force-trailing-slash and the admin page asset path is /admin/index.html; Playwright can target the emitted page directly through the dev server rather than relying on a separate static server.
- 2026-04-13: Existing test layout is test/unit/*.test.ts, test/integration/*.test.ts, with shared helpers under test/support/; a new browser spec should fit test/e2e/admin-flow.spec.ts, and any reusable setup/helper should live alongside it or under test/support/.
- 2026-04-13: .sisyphus/ already uses temporary wrangler logs named tmp-wrangler-*-out.log/-err.log plus evidence artifacts; deterministic browser setup can mirror this pattern if a seed or setup command needs transient outputs.
- 2026-04-13: The plan for Task 9 explicitly locks the browser URL to /admin/local-admin-secret-token, requires seeded E2E data before the spec starts, and calls for seed/e2e-admin.sql plus Playwright global setup or a dedicated pre-test command.

- Package scripts currently available: dev -> wrangler dev, deploy -> wrangler deploy, 	ypecheck -> 	sc --noEmit, 	est -> itest run, d1:migrate:local -> wrangler d1 migrations apply DB --local, seed:local -> wrangler d1 execute DB --local --file ./seed/dev.sql (package.json:6-12). Task 9 will need extensions here for Playwright/browser runs and any local bootstrap wrapper.
- Current test layout is 	est/unit/, 	est/integration/, and 	est/support/; Vitest is configured to run 	est/**/*.test.ts in itest.config.ts:3-7. Existing integration tests import the Worker directly and build mock envs inline (	est/integration/student-api.test.ts, 	est/integration/worker-smoke.test.ts).
- Wrangler local-dev config is already centered on a single Worker entry with static assets binding: main: src/worker/index.ts, ssets.binding = ASSETS, ssets.directory = ./public, ars.EVENT_DATE = 2026-01-15, and D1 binding DB with migrations_dir = ./migrations (wrangler.jsonc:1-24). 
pm run dev will therefore serve from Wrangler’s default local dev port unless a future script adds explicit flags; tests currently assume localhost-style paths but no custom port config exists in repo.
- Seed/migration baseline for E2E is migrations/0001_initial_schema.sql (people + scan_records tables, unique scan constraint) and seed/dev.sql (clears both tables, inserts 5 students + 5 mentors with stable local secret tokens). This is the deterministic dataset Task 9 should build on.
- Existing file patterns to mirror for config/setup: 	est/integration/*-dom.test.ts for DOM contract checks, 	est/integration/*-api.test.ts for Worker API assertions, 	est/unit/mock-d1*.test.ts for D1 harness behavior, and public/*/app.js plus public/*/index.html for role-page wiring. Admin page DOM contract already locks page-title, status-banner, controls-card, export-csv-button, 
ecords-card, 
ecords-loading, 
ecords-empty-state, 
ecords-table, and 
ecords-table-body (	est/integration/admin-page-dom.test.ts:8-44).
- Task 9 plan references the exact deliverables to add: playwright.config.ts, 	est/e2e/admin-flow.spec.ts, deterministic E2E seed/setup support, and package.json scripts for browser E2E (.sisyphus/plans/admin-flow-aligned.md:38-48, 89-94).

- 2026-04-13: Wrangler local Worker vars for browser runs need explicit `wrangler dev --var KEY:value` flags; passing `ADMIN_SECRET` and `EVENT_DATE` through Playwright `webServer.env` alone did not populate `env.ADMIN_SECRET`/`env.EVENT_DATE` inside the Worker.
- 2026-04-13: A deterministic Playwright setup project works cleanly for this repo: `test/e2e/admin.setup.ts` runs local D1 migrations plus `seed/dev.sql` and `seed/e2e-admin.sql` against a shared `--persist-to .wrangler/state/e2e` directory before the browser project starts.
- 2026-04-13: The admin browser flow can cover edit, mentor reassignment, delete, CSV download, and bad-secret rejection entirely through the existing admin page shell and APIs; no extra admin endpoints or UI hooks were needed.
- 2026-04-13: The visual polish pass stayed CSS-only for the public pages: admin got a dedicated stylesheet with calm white cards and green accents, while student and mentor kept their existing mobile flow and only tightened the top-level card outline to a light green border.
- 2026-04-15: A regression test now locks the admin action wrapper contract in both Vitest and Playwright, so the four-column compact table still exposes `.record-actions` even while switching between Edit and Save states.
