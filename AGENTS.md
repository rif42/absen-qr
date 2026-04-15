# AGENTS.md

## Project documentation first
Before planning, implementing, or reviewing work in this repository, read the project documentation in `docs/`.

Minimum required reading:
- `docs/README.md`
- `docs/prd/mentor-student-qr-attendance-v1.md`
- `docs/implementation/mentor-student-qr-attendance-v1-plan.md`

## Source of truth
- `docs/` is the project-facing source of truth.
- `.sisyphus/` may contain drafts, planning artifacts, and working notes, but it should not override finalized documents in `docs/`.

## Working rules for agents
- Align implementation to the current PRD and implementation plan before proposing scope changes.
- If code behavior conflicts with `docs/`, update the code or explicitly call out the mismatch.
- Do not invent extra scope beyond the v1 documents without user approval.
- Keep CSV export order exactly as documented.
- Preserve the locked v1 constraints: single UTC calendar-day, one secret link per person, duplicate scans rejected, and admin last-write-wins corrections.

## Student-page design language
- For `public/student/*`, treat mobile as the primary layout target before desktop refinement.
- Keep the student flow visually simple and sequential from top to bottom: student identity, camera scanner, then same-day history.
- Prefer lightweight edits to `public/student/index.html` and `public/student/styles.css`; keep `public/student/app.js`, `src/worker/routes/student.ts`, and `test/integration/student-api.test.ts` behavior stable unless the DOM contract must change.
- Use restrained accent color: lightly vibrant green for positive guidance and bright orange for emphasis, while preserving a clean, readable interface.
