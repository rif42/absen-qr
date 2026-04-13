DELETE FROM scan_records;

INSERT INTO scan_records (scan_id, student_id, mentor_id, event_date, scanned_at, notes, updated_at) VALUES
  (
    'scan-e2e-admin-001',
    'student-001',
    'mentor-001',
    '2026-04-11',
    '2026-04-11T08:00:00.000Z',
    'Seeded admin note',
    '2026-04-11T08:00:00.000Z'
  );
