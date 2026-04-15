## 2026-04-14 Task: session initialization
- Admin date filter must use stored `event_date`, never `scanned_at`.
- Query-param contract is exactly `startDate` and `endDate` for both records and CSV export.
- Default admin behavior must remain equivalent to configured event-day only.
- User requested minimal targeted tests, not a broad new test matrix.

## 2026-04-14 Task: inclusive range implementation
- Inclusive admin filtering works cleanly with `scan_records.event_date >= ?1 AND scan_records.event_date <= ?2`.
- Mock D1 must sort export rows by `scanned_at ASC, scan_id ASC` and records by `scanned_at DESC, scan_id DESC` to mirror the SQL contract.
- Keeping helper defaults (`endDate = startDate`) preserved route compatibility while the tests exercised the new range API.

## 2026-04-14 Task: admin date-filter shell
- The admin shell can expose exactly two visible `input[type="date"]` controls plus one apply button without disturbing the existing export/status/table hooks.
- A focused DOM contract test is enough for this phase because the task is markup-only and the admin JS remains untouched.

## 2026-04-14 Task: admin route contract
- The admin API route can normalize `startDate`/`endDate` with one local helper and still keep PATCH/DELETE behavior isolated.
- `GET /api/admin/records` should surface the active range in `dateFilter` rather than leaking helper internals.
- `GET /api/admin/export.csv` can share the same resolved range without changing CSV header order.

## 2026-04-14 Task: doc alignment
- PRD and implementation plan should describe the admin date-range feature as reporting-only, not multi-event support.
- Student and mentor history wording should stay runtime-day based while admin reporting uses the stored `event_date` range contract.
- The docs need to mention the fallback behavior explicitly: missing, malformed, or reversed admin params resolve to the configured event-day only.

## 2026-04-14 Task: admin UI wiring
- The admin page should treat `dateFilter` from `GET /api/admin/records` as the source of truth for the active range on first load.
- Keeping the filter state to just `startDate` and `endDate` made export, URL sync, and validation easier to keep aligned.
- Client-side invalid apply handling can preserve the last rendered table simply by refusing to fetch.

## 2026-04-14 Task: compact admin table follow-up
- The action column must keep a stable `.record-actions` wrapper mounted so compact button-group styling survives locked/editing state changes.
