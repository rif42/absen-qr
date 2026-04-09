DELETE FROM scan_records;
DELETE FROM people;

INSERT INTO people (person_id, display_name, role, secret_id, secret_path_token) VALUES
  ('student-001', 'Student Local 01', 'student', 'student-secret-001', 'local-student-token-001'),
  ('student-002', 'Student Local 02', 'student', 'student-secret-002', 'local-student-token-002'),
  ('student-003', 'Student Local 03', 'student', 'student-secret-003', 'local-student-token-003'),
  ('student-004', 'Student Local 04', 'student', 'student-secret-004', 'local-student-token-004'),
  ('student-005', 'Student Local 05', 'student', 'student-secret-005', 'local-student-token-005'),
  ('mentor-001', 'Mentor Local 01', 'mentor', 'mentor-secret-001', 'local-mentor-token-001'),
  ('mentor-002', 'Mentor Local 02', 'mentor', 'mentor-secret-002', 'local-mentor-token-002'),
  ('mentor-003', 'Mentor Local 03', 'mentor', 'mentor-secret-003', 'local-mentor-token-003'),
  ('mentor-004', 'Mentor Local 04', 'mentor', 'mentor-secret-004', 'local-mentor-token-004'),
  ('mentor-005', 'Mentor Local 05', 'mentor', 'mentor-secret-005', 'local-mentor-token-005');
