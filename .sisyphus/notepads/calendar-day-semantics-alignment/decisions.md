# Calendar-Day Semantics Alignment — Decisions

## Canonical Day Rule
- UTC midnight boundary is the canonical day rule.
- `event_date` is derived from `scanned_at` as `substr(scanned_at, 1, 10)`.
- No timezone support.
- No multi-event scope creep.
- No schema rename/removal of `event_date`.
- No API shape changes.
- No CSV column-order changes.

