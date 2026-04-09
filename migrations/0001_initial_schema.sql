CREATE TABLE IF NOT EXISTS people (
  person_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'mentor')),
  secret_id TEXT NOT NULL UNIQUE,
  secret_path_token TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS scan_records (
  scan_id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  mentor_id TEXT NOT NULL,
  event_date TEXT NOT NULL,
  scanned_at TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  UNIQUE (student_id, mentor_id, event_date),
  FOREIGN KEY (student_id) REFERENCES people(person_id),
  FOREIGN KEY (mentor_id) REFERENCES people(person_id)
);

CREATE INDEX IF NOT EXISTS idx_people_role ON people(role);
CREATE INDEX IF NOT EXISTS idx_scan_records_student_date ON scan_records(student_id, event_date);
CREATE INDEX IF NOT EXISTS idx_scan_records_mentor_date ON scan_records(mentor_id, event_date);
