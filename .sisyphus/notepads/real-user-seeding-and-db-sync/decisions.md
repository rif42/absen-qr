
- The Task 4 importer treats remote apply as idempotent only when people already exactly matches the canonical roster and scan_records is empty; in that state it skips backup/apply entirely and reports zero deletes, inserts, and token changes instead of rewriting identical data.

- Post-apply evidence now records both required verification queries when a destructive apply actually runs: role counts from people and SELECT COUNT(*) AS count FROM scan_records;. Idempotent reruns still short-circuit before backup/apply and therefore continue to report the no-op rerun summary instead of synthetic post-apply checks.
