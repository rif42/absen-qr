DELETE FROM scan_records;
DELETE FROM people;

INSERT INTO people (person_id, display_name, role, secret_id, secret_path_token) VALUES
  ('student-bdn-titik-kurniawati-s-sit-m-kes-m-keb', 'Bdn. Titik Kurniawati, S.SiT, M.Kes, M.Keb', 'student', 'student-secret-bdn-titik-kurniawati-s-sit-m-kes-m-keb', 'student-bdn-titik-kurniawati-s-sit-m-kes-m-keb'),
  ('student-rizqitha-s-tr-keb-m-tr-keb', 'Rizqitha, S.Tr.Keb., M.Tr.Keb', 'student', 'student-secret-rizqitha-s-tr-keb-m-tr-keb', 'student-rizqitha-s-tr-keb-m-tr-keb'),
  ('student-qolbi-hanif-fadhlulloh-s-h-m-h', 'Qolbi Hanif Fadhlulloh, S.H.,M.H.', 'student', 'student-secret-qolbi-hanif-fadhlulloh-s-h-m-h', 'student-qolbi-hanif-fadhlulloh-s-h-m-h'),
  ('student-muhamad-agung-s-s-sos-m-sos', 'Muhamad Agung S, S.Sos., M.Sos', 'student', 'student-secret-muhamad-agung-s-s-sos-m-sos', 'student-muhamad-agung-s-s-sos-m-sos'),
  ('student-reni-nur-arifah-s-e-m-m', 'Reni Nur Arifah, S.E., M.M.', 'student', 'student-secret-reni-nur-arifah-s-e-m-m', 'student-reni-nur-arifah-s-e-m-m'),
  ('student-nadya-audina-ns-s-si-m-biomed', 'Nadya Audina NS. S.Si., M.Biomed', 'student', 'student-secret-nadya-audina-ns-s-si-m-biomed', 'student-nadya-audina-ns-s-si-m-biomed'),
  ('student-fauziah-novita-putri-rifai-s-si-m-biotech', 'Fauziah Novita Putri Rifai, S.Si, M.Biotech', 'student', 'student-secret-fauziah-novita-putri-rifai-s-si-m-biotech', 'student-fauziah-novita-putri-rifai-s-si-m-biotech'),
  ('student-erna-setyaningsih-s-s-t-m-tr-keb', 'Erna Setyaningsih, S.S.T.,M.Tr.Keb', 'student', 'student-secret-erna-setyaningsih-s-s-t-m-tr-keb', 'student-erna-setyaningsih-s-s-t-m-tr-keb'),
  ('student-diah-widyatun-s-s-t-m-tr-keb', 'Diah Widyatun, S.S.T., M.Tr.Keb', 'student', 'student-secret-diah-widyatun-s-s-t-m-tr-keb', 'student-diah-widyatun-s-s-t-m-tr-keb'),
  ('student-bdn-sri-mularsih-s-sit-m-kes', 'Bdn. Sri Mularsih, S.SiT, M.Kes', 'student', 'student-secret-bdn-sri-mularsih-s-sit-m-kes', 'student-bdn-sri-mularsih-s-sit-m-kes'),
  ('mentor-mohammad-ariq-nazar-s-si-m-biomed', 'Mohammad Ariq Nazar, S.Si, M.Biomed', 'mentor', 'mentor-secret-mohammad-ariq-nazar-s-si-m-biomed', 'mentor-mohammad-ariq-nazar-s-si-m-biomed'),
  ('mentor-bd-mariza-mustika-d-s-tr-keb-m-tr-keb', 'Bd. Mariza Mustika D, S.Tr.Keb., M.Tr.Keb', 'mentor', 'mentor-secret-bd-mariza-mustika-d-s-tr-keb-m-tr-keb', 'mentor-bd-mariza-mustika-d-s-tr-keb-m-tr-keb'),
  ('mentor-naufal-sebastian-s-h-m-h', 'Naufal Sebastian, S.H.,M.H.', 'mentor', 'mentor-secret-naufal-sebastian-s-h-m-h', 'mentor-naufal-sebastian-s-h-m-h'),
  ('mentor-sutinnarto-s-i-kom-m-i-kom', 'Sutinnarto, S.I.Kom., M.I.Kom', 'mentor', 'mentor-secret-sutinnarto-s-i-kom-m-i-kom', 'mentor-sutinnarto-s-i-kom-m-i-kom'),
  ('mentor-najmi-rizki-khairani-s-sos-m-i-kom', 'Najmi Rizki Khairani, S.Sos., M.I.Kom', 'mentor', 'mentor-secret-najmi-rizki-khairani-s-sos-m-i-kom', 'mentor-najmi-rizki-khairani-s-sos-m-i-kom'),
  ('mentor-dr-ir-agus-f-abdillah-mba-ermap', 'Dr. Ir. Agus F. Abdillah, MBA, ERMAP', 'mentor', 'mentor-secret-dr-ir-agus-f-abdillah-mba-ermap', 'mentor-dr-ir-agus-f-abdillah-mba-ermap'),
  ('mentor-eva-fachria-s-e-m-s-m', 'Eva Fachria, S.E., M.S.M.', 'mentor', 'mentor-secret-eva-fachria-s-e-m-s-m', 'mentor-eva-fachria-s-e-m-s-m'),
  ('mentor-anindya-putri-utami-s-m-m-m', 'Anindya Putri Utami, S.M., M.M.', 'mentor', 'mentor-secret-anindya-putri-utami-s-m-m-m', 'mentor-anindya-putri-utami-s-m-m-m'),
  ('mentor-dian-respati-ayu-s-si-m-biomed', 'Dian Respati Ayu, S.Si., M.Biomed', 'mentor', 'mentor-secret-dian-respati-ayu-s-si-m-biomed', 'mentor-dian-respati-ayu-s-si-m-biomed'),
  ('mentor-dendi-krisna-nugraha-m-sc-ph-d', 'Dendi Krisna Nugraha, M.Sc., Ph.D.', 'mentor', 'mentor-secret-dendi-krisna-nugraha-m-sc-ph-d', 'mentor-dendi-krisna-nugraha-m-sc-ph-d');
