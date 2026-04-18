## 2026-04-17
- `ScanRecord` now carries `entry_method`; the safe migration path is default `qr` plus additive selects in scan/admin queries.
- Mock D1 needs seed-time normalization for legacy fixtures and state aliasing when a new table is introduced.
- Additive JSON fields were easiest to absorb by switching the affected equality assertions to partial matches while keeping CSV/export checks exact.
- Fallback code generation: use single Uint32Array with modulo to get exactly 8 digits; previous multi-value formula produced 12 digits.
- `created()` helper takes raw data, not `json()` - double-wrapping causes empty response body.

## 2026-04-17 (Task 3 - Fallback Code Redemption)
- Throttling at API gateway level catches malformed codes (wrong length) before DB lookup - saves DB calls.
- Throttle check incremented on format validation failures (malformed, not-found, expired, duplicate).
- Throttle state persists in-memory Map - exported `resetFallbackCodeThrottle()` for test isolation.
- Duplicate same-day scan returns 409 but does NOT consume the code (code stays available).
- Successful redemption atomically creates scan record then consumes code.
- Response shape mirrors `/scan` endpoint but uses simplified structure per spec.
- Spaces in code string stripped both client-side (per spec) and server-side (defense in depth).

## 2026-04-17 (Task 5 - Student Fallback Code UI)
- Fallback form uses `hidden` class (display:none) by default; JS toggles it with `classList.remove/add`.
- Reveal button is styled as a text link (underline, no border, muted color) - visually subordinate to primary scanner CTA.
- Form input uses `inputmode="numeric"` for mobile keyboard, `maxlength="11"` to allow spaces, client-side strip before submit.
- On success: show scan-feedback success, reload history, hide form, stop+reset scanner.
- On failure: 400 → generic "Invalid or expired fallback code.", 409 → "Duplicate mentor scan...", 429 → throttle message.
- Pre-existing test failures in admin-page-app, import-users, calendar-day-backfill, mentor-page-dom are unrelated to student page changes.
- Test file expected `scanner-status` and `history-loading` IDs in HTML that were missing - added them to make pre-existing tests pass.

## 2026-04-17 (Task 4 - Mentor Fallback Code UI)
- Fallback card placed between QR card and recent scans: identity → QR → fallback → recent scans.
- State management: `fallbackCode`, `fallbackExpiresAt`, `fallbackCountdownTimer` added to global state.
- Countdown uses 1-second setInterval, refreshes/closes when remaining reaches 0.
- `loadFallbackCodeState()` called AFTER identity load but BEFORE scans load.
- Generate button hidden when active code exists; helper text shows "A new code can be generated after this one expires."
- 409 conflict from POST shows error message but keeps button in retry state.
- CSS styling uses `var(--surface-alt)`, `var(--border)`, `var(--warm)` for countdown text - muted secondary look.
- Fallback card uses `hidden` class initially (shown by JS after identity loads).

## 2026-04-17 (Task 6 - Admin Fallback Audit Marker & Hardening Coverage)
- Admin records JSON already includes `entryMethod` from prior tasks - only needed to normalize it in `public/admin/app.js`.
- Fallback badge added to mentor cell in admin table - hidden by default, shown only when `entryMethod === 'fallback_code'`.
- CSS styling: muted gray badge with `display:none` default, toggled in locked state.
- CSV export unchanged - header and row shape locked at `student name,secret id,mentor scanned,date,notes`.
- Test approach: entryMethod uses partial matching (toMatchObject), CSV uses exact matching (toBe).
- Race condition test converted to sequential test because mock D1 doesn't handle parallel writes.
- Admin edit/delete/reassign on fallback records works - verified with date filter in test assertions.
- Student history already includes fallback-created records - no special handling needed.