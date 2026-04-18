
- Wrangler `d1 migrations list absen-qr --remote` only reports pending migrations, not a full applied-history ledger. I had to pair it with a schema probe (`sqlite_schema` / `PRAGMA table_info`) to prove remote state.

2026-04-18T10:35:22.6728658+07:00 - Bounded wrangler tail for absen-qr produced no app logs for the canonical request window. A stale wrangler tail process had to be stopped to release the evidence file lock; task-1-worker-tail.txt now records the no-output limitation explicitly.
