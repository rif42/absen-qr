ALTER TABLE scan_records ADD COLUMN entry_method TEXT NOT NULL DEFAULT 'qr'
  CHECK (entry_method IN ('qr', 'fallback_code'));

CREATE TABLE IF NOT EXISTS mentor_fallback_codes (
  fallback_code_id TEXT PRIMARY KEY,
  mentor_id TEXT NOT NULL,
  code_value TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  consumed_by_student_id TEXT,
  consumed_scan_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_fallback_mentor_active ON mentor_fallback_codes(mentor_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_fallback_code_value ON mentor_fallback_codes(code_value);
