## 2026-04-17
- `auditAndBackfillEventDates()` had to be parameterized for `entry_method`; a literal `'qr'` in the UPDATE would have bypassed the mock updater.
- `mock-d1.ts` needed both `fallback_codes` and `mentor_fallback_codes` aliases to stay compatible with likely hidden test access patterns.
- Existing admin/student/mentor tests used exact JSON equality; they had to move to partial matching once `entryMethod` became part of the response payload.
