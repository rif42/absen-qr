## 2026-04-13
- The admin save flow should treat locked state as the source of truth: locked rows ignore Save, unchanged saves re-lock immediately without PATCH, and successful PATCHes re-lock after syncing the returned record.
- Row action disabling stays row-local and temporary; Save/Delete are only disabled during an in-flight request for that row, then restored from the row lock state.
- Failed PATCHes must not overwrite control values or re-lock the row, which preserves the attempted edits for another save attempt.
## 2026-04-13
- PASS: On `/admin/local-admin-secret-token`, the first row started locked, unlocked on `Edit`, and immediately re-locked after `Saved` with both selects, textarea, and Save disabled; the page console stayed clean.
## 2026-04-13
- The admin row state is now inspectable and styleable through `tr.dataset.rowState` plus `row-locked` / `row-editing` classes, which keeps the shell stable while making row-local state obvious in tests and CSS.
- The static admin HTML still contains only the table shell (`table` + `tbody`) and no server-rendered rows; row state is introduced entirely by `public/admin/app.js` after records load.
## 2026-04-13
- After adding the `Edit` column, the action-button selectors must follow the 6-column row order: Edit in column 4, Save in column 5, and Delete in column 6.
## 2026-04-13
- The browser E2E should prove the locked state up front with row-scoped disabled assertions, then re-check the same row after `Save` and after reload so the lock/reload contract is explicit.
- When exercising a second admin save in the same row, pick a different mentor value than the current persisted one; otherwise Playwright will correctly surface the neutral `No changes to save.` path.
## 2026-04-13
- PASS: Targeted regression bundle completed cleanly — `admin-page-app`, `admin-page-dom`, `admin-api`, and `admin-records` Vitest suites passed; `npm run typecheck` exited 0; and `npm run test:e2e:admin` passed with the admin browser flow green.
## 2026-04-13
- Failed admin deletes now restore the row-local lock state before re-enabling Delete, so locked rows come back with Save still disabled and Delete available again after an error.
