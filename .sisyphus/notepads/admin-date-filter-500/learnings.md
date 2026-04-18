
- Remote D1 `scan_records` schema does not include `entry_method`.
- Remote schema still matches the pre-0003 shape: `scan_records` has `scan_id`, `student_id`, `mentor_id`, `event_date`, `scanned_at`, `notes`, `updated_at`, plus the `(student_id, mentor_id, event_date)` unique constraint.
- Remote migration evidence says `0003_fallback_codes.sql` is still listed as pending and its side effects are absent remotely (`mentor_fallback_codes` not present).
- Exact conclusion for compatibility check: `scan_records.entry_method` does **not** exist remotely.

2026-04-18T10:35:22.6728658+07:00 - Canonical GET /admin/admin-secret-2026/api/records?startDate=2026-04-17&endDate=2026-04-19 returned HTTP/1.1 500 Internal Server Error with Cloudflare error code 1101; repro evidence saved in task-1-deployed-records-repro.txt.
