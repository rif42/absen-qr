## 2026-04-13
- Admin row browser tests should always enter edit mode explicitly before filling selects or textareas on a locked row.
- Future admin-row Playwright selectors should target the row first, click `Edit`, then modify fields in that same row to preserve row-local scope.
## 2026-04-13
- Save lifecycle now distinguishes three paths in `public/admin/app.js`: locked rows short-circuit, unchanged edits re-lock with a neutral status and no PATCH, and successful PATCHes re-lock after applying the response payload.
- Delete remains available outside the request window; only the same row's actions are disabled while a save is in flight.
## 2026-04-13
- Adopted `data-row-state` plus `row-locked` / `row-editing` on each record row as the single DOM contract for read-only vs editing affordances; this keeps the action area unchanged while giving CSS and tests a stable hook.
- Kept `public/admin/index.html` untouched so the admin shell contract stays fixed and the new affordances are added only in client-side row rendering.
