-- Migration: directional scan_records schema
-- Replaces (student_id, mentor_id) with (from_id, to_id, from_role, to_role)

CREATE TABLE scan_records_new (
  scan_id TEXT PRIMARY KEY,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  from_role TEXT NOT NULL CHECK (from_role IN ('student', 'mentor')),
  to_role TEXT NOT NULL CHECK (to_role IN ('student', 'mentor')),
  event_date TEXT NOT NULL,
  scanned_at TEXT NOT NULL,
  entry_method TEXT NOT NULL DEFAULT 'qr' CHECK (entry_method IN ('qr', 'fallback_code')),
  notes TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  UNIQUE (from_id, to_id, event_date),
  FOREIGN KEY (from_id) REFERENCES people(person_id),
  FOREIGN KEY (to_id) REFERENCES people(person_id)
);

INSERT INTO scan_records_new (
  scan_id, from_id, to_id, from_role, to_role,
  event_date, scanned_at, entry_method, notes, updated_at
)
SELECT
  scan_id,
  student_id AS from_id,
  mentor_id AS to_id,
  'student' AS from_role,
  'mentor' AS to_role,
  event_date,
  scanned_at,
  entry_method,
  notes,
  updated_at
FROM scan_records;

DROP TABLE scan_records;

ALTER TABLE scan_records_new RENAME TO scan_records;

DROP INDEX IF EXISTS idx_scan_records_student_date;
DROP INDEX IF EXISTS idx_scan_records_mentor_date;

CREATE INDEX idx_scan_records_from_date ON scan_records(from_id, from_role, event_date);
CREATE INDEX idx_scan_records_to_date ON scan_records(to_id, to_role, event_date);
CREATE INDEX idx_scan_records_pair_date ON scan_records(from_id, to_id, event_date);
