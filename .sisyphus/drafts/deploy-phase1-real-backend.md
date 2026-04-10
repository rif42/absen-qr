# Draft: Deploy Phase 1 Real Backend

## Requirements (confirmed)
- [user request]: "how to deploy the cloudflare worker and complete the phase 1 with real database and backend"
- [doc constraint]: v1 remains Cloudflare Workers + D1
- [doc constraint]: single event-day only
- [doc constraint]: one secret link per person
- [doc constraint]: duplicate student→mentor scans rejected
- [doc constraint]: admin corrections are last-write-wins

## Technical Decisions
- [plan scope]: finish remaining Phase 1 foundations first, then deploy the real Worker + remote D1
- [rollout path]: direct pilot/prod deployment
- [hostname]: use `workers.dev` first for secret links
- [initial remote data]: start with demo data in the real remote database

## Research Findings
- [docs/README.md]: project-facing source of truth is under `docs/`
- [docs/prd/mentor-student-qr-attendance-v1.md]: recommended stack is Cloudflare Workers + D1 for v1
- [docs/implementation/mentor-student-qr-attendance-v1-plan.md]: Phase 1 covers scaffolding, D1 config/migrations/seeding, seeded identity model, and secret-link resolution rules
- [gap analysis]: core Phase 1 foundations were already implemented in repo code, but the test foundation model lagged the canonical 5-student/5-mentor seed and needed alignment before treating Phase 1 as done

## Open Questions
- [none blocking for Phase 1]: local Phase 1 foundations are now complete; remaining questions are deployment-specific

## Phase 1 Completion Work (done)
- [implemented]: aligned `test/support/mock-d1.ts` default roster to the same 5 students + 5 mentors used by `seed/dev.sql`
- [implemented]: added `test/unit/mock-d1.test.ts` as a regression guard to keep the mock foundation seed aligned with the pilot roster

## Verification (completed)
- [test]: `rtk npm run test -- "test/unit/mock-d1.test.ts"` ✅
- [test]: `rtk npm run test` ✅ (21 passing)
- [typecheck]: `rtk npm run typecheck` ✅
- [local d1]: `rtk npm run d1:migrate:local` ✅
- [local d1]: `rtk npm run seed:local` ✅
- [local d1]: `rtk wrangler d1 execute absen-qr-local --local --command "SELECT role, COUNT(*) AS count FROM people GROUP BY role ORDER BY role;"` ✅ returning mentor=5 and student=5
- [local worker]: `npm run dev -- --port 8787` booted successfully and returned `200` for `/` and `/student/local-student-token-001`

## Current Status
- [phase 1]: complete locally
- [done]: Worker scaffold, D1 schema, local migrate flow, local seed flow, canonical 5+5 demo roster, and secret-link resolution rules are all in place and locally verified
- [stopped here]: no remote database creation or deployment was performed yet

## Remaining Deployment Steps (next phase, not yet executed)
1. Create the real remote D1 database for the pilot environment.
2. Replace placeholder `database_id` / `preview_database_id` values in `wrangler.jsonc` with the real remote IDs.
3. Confirm production-ready values for `ADMIN_SECRET` and `EVENT_DATE`.
4. Run remote D1 migrations.
5. Seed the remote D1 database with the demo roster first.
6. Deploy the Worker to `workers.dev`.
7. Verify live root route, secret-link student route, and remote D1-backed behavior before moving beyond Phase 1.

## Scope Boundaries
- INCLUDE: Cloudflare Worker deployment path, real D1/database setup, env/secrets/migrations/seeding, and Phase 1 completion gaps
- EXCLUDE: expanding product scope beyond the approved v1 docs unless explicitly approved
