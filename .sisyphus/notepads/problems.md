# Consolidated Problems

> Aggregated from all plan notepads in `.sisyphus/notepads/`.  
> Source tasks: admin-flow-aligned, admin-row-edit-gating, admin-date-range-filter, current-day-history-filter, calendar-day-semantics-alignment, one-time-code-fallback, real-user-seeding-and-db-sync, fix-camera-local-dev, admin-date-filter-500.

---

## Real-User Seeding and DB Sync

- **2026-04-17: Final Verification Wave initially returned REJECT from F1 Audit.**  
  Four mandatory QA scenario evidence files were missing, which the plan explicitly marks as MANDATORY ("task incomplete without these"): `task-2-invalid-csv.txt`, `task-3-tests.txt`, `task-3-admin-export.txt`, `task-4-apply-failure.txt`.
- Task 4 backup directory also contained pre-fix `.sql` full-database dumps instead of the table-specific `.json` snapshots described in the current code/notepad.
- The F1 REJECT was later resolved through equivalent unit-test coverage and subsequent F2-F4 approvals, culminating in a final APPROVE after all artifacts were accounted for.

## Admin Row Edit Gating

- **2026-04-13: Post-save re-lock incomplete.**  
  On `/admin/local-admin-secret-token`, the first row started locked, unlocked on `Edit`, but the immediate post-save snapshot after `Saved` still had one `select` enabled (`textarea` disabled=true, Save disabled=true, one `select` disabled=false), so the row did not fully re-lock instantly.
- **2026-04-13: Single-row dataset.**  
  `/admin/local-admin-secret-token` showed one row only; there was no second row to compare. Playwright console had one error: `favicon.ico 404`.

## Admin Date-Range Filter

- (No unresolved problems recorded after any task.)

## Current-Day History Filter

- (No active implementation problems recorded at session start or after any task.)

## Calendar-Day Semantics Alignment

- (No problems recorded.)

## One-Time Code Fallback

- (No problems recorded.)

## Admin Flow Aligned

- (No problems recorded beyond tooling issues already listed in `issues.md`.)

## Admin Date Filter 500

- (No problems recorded.)

## Fix Camera Local Dev

- (No problems recorded.)

---

*Generated on 2026-04-18 from `.sisyphus/notepads/*/{decisions,issues,learnings,problems}.md`.*
