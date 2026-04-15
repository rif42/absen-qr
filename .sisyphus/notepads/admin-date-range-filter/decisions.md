## 2026-04-14 Task: session initialization
- Admin records table and CSV export must share one inclusive `event_date` range contract.
- Invalid or partial server-side date params fall back to configured event-day.
- Browser UI will expose exactly two visible date inputs and one apply action.
- Docs updates are limited to `docs/prd/mentor-student-qr-attendance-v1.md` and `docs/implementation/mentor-student-qr-attendance-v1-plan.md`.

## 2026-04-14 Task: inclusive range implementation
- Admin helpers now accept inclusive start/end dates while still defaulting `endDate` to `startDate` for existing route compatibility.
- The mock D1 admin branch now keys on the exact range SQL shape, not the legacy single-date predicate.

## 2026-04-14 Task: admin date-filter shell
- Use `startDate`, `endDate`, and `apply-filters-button` as the new admin shell hooks so the future filtering behavior has stable DOM anchors.
- Keep the existing `#export-csv-button`, `#status-banner`, `#records-loading`, `#records-empty-state`, `#records-table`, and `#records-table-body` hooks unchanged.

## 2026-04-14 Task: admin route contract
- Use a local resolver in `src/worker/routes/admin.ts` that falls back to `getConfiguredEventDate(env)` when either query param is missing, malformed, or reversed.
- Preserve the CSV filename behavior for now; only the row selection contract changes in this task.

## 2026-04-14 Task: doc alignment
- Keep the docs scoped to an admin-only reporting enhancement over stored `event_date`, not a product-level multi-event feature.
- Preserve the runtime-day student/mentor history wording so the new admin range language does not imply a broader behavioral change.
- Document the visible `startDate` / `endDate` controls and shared contract consistently in both PRD and implementation plan.

## 2026-04-14 Task: admin UI wiring
- Use the server-returned `dateFilter` to hydrate the initial admin inputs when the URL does not already provide a valid range.
- Keep export and reload behavior tied to the current active filter instead of re-defaulting to the configured event day.
- Block invalid apply attempts entirely on the client so the current table stays visible and no unnecessary fetch occurs.
