PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE d1_migrations(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(1,'0001_initial_schema.sql','2026-04-10 04:40:08');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(2,'0002_backfill_event_dates.sql','2026-04-18 06:46:45');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(3,'0003_fallback_codes.sql','2026-04-18 06:46:45');
CREATE TABLE people (
  person_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'mentor')),
  secret_id TEXT NOT NULL UNIQUE,
  secret_path_token TEXT NOT NULL UNIQUE
);
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('mentor-anindya-putri-utami-s-m-m-m','Anindya Putri Utami, S.M., M.M.','mentor','mentor-secret-anindya-putri-utami-s-m-m-m','7j896r34xe3y');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('mentor-bd-mariza-mustika-d-s-tr-keb-m-tr-keb','Bd. Mariza Mustika D, S.Tr.Keb., M.Tr.Keb','mentor','mentor-secret-bd-mariza-mustika-d-s-tr-keb-m-tr-keb','tibk4uhnvvfh');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('mentor-bondan-eko-suratno-m-hum','Bondan Eko Suratno, M.Hum','mentor','mentor-secret-bondan-eko-suratno-m-hum','0r2aj56to52q');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('mentor-daffa-restu-fadhillah-s-kom','Daffa Restu Fadhillah, S.Kom','mentor','mentor-secret-daffa-restu-fadhillah-s-kom','dphquxhopg6u');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('mentor-dendi-krisna-nugraha-m-sc-ph-d','Dendi Krisna Nugraha, M.Sc., Ph.D.','mentor','mentor-secret-dendi-krisna-nugraha-m-sc-ph-d','zcccq4ekctzm');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('mentor-dian-respati-ayu-s-si-m-biomed','Dian Respati Ayu, S.Si., M.Biomed','mentor','mentor-secret-dian-respati-ayu-s-si-m-biomed','rodxna8fda4r');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('mentor-dina-haida-shofwa-a-md-keb','Dina Haida Shofwa, A.Md.Keb.','mentor','mentor-secret-dina-haida-shofwa-a-md-keb','os76g82sex8k');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('mentor-dr-ir-agus-f-abdillah-mba-ermap','Dr. Ir. Agus F. Abdillah, MBA, ERMAP','mentor','mentor-secret-dr-ir-agus-f-abdillah-mba-ermap','uunfierj9lmr');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('mentor-eva-fachria-s-e-m-s-m','Eva Fachria, S.E., M.S.M.','mentor','mentor-secret-eva-fachria-s-e-m-s-m','znm7ma09269q');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('mentor-mohammad-ariq-nazar-s-si-m-biomed','Mohammad Ariq Nazar, S.Si, M.Biomed','mentor','mentor-secret-mohammad-ariq-nazar-s-si-m-biomed','wk19xijm3dqq');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('mentor-mr-adam','Adam Prabowo, B.MLS.','mentor','mentor-secret-mr-adam','m58gajvc5djr');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('mentor-mr-dendi','Dendi Krisna Nugraha, M.Sc., Ph.D.','mentor','mentor-secret-mr-dendi','ndvvyfm8h6yq');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('mentor-mr-faheem','Faheem Ahmed Khan, Ph.D.','mentor','mentor-secret-mr-faheem','hu0t15p89e9q');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('mentor-mr-faris','Muhammad Faris, M.T.M.','mentor','mentor-secret-mr-faris','v4iwny3jmmet');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('mentor-mr-naufal-sebastian-anggoro','Naufal Sebastian Anggoro, S.Si., M.Si.','mentor','mentor-secret-mr-naufal-sebastian-anggoro','n101rq5kfm50');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('mentor-ms-endah','Endah Agustina Lestari, B. Sc., M.Sc.','mentor','mentor-secret-ms-endah','e2xfw5o4mm9x');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('mentor-ms-nina','Hernina Dinanda Pangestika, S.KM.','mentor','mentor-secret-ms-nina','ikb7ztlw3u70');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('mentor-ms-waheni','Waheni Rizki Aprilia, S.Si., Ph.D.','mentor','mentor-secret-ms-waheni','b6dhcl8ocrdc');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('mentor-najmi-rizki-khairani-s-sos-m-i-kom','Najmi Rizki Khairani, S.Sos., M.I.Kom','mentor','mentor-secret-najmi-rizki-khairani-s-sos-m-i-kom','ihz6y2f7w4nn');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('mentor-naufal-sebastian-s-h-m-h','Naufal Sebastian, S.H.,M.H.','mentor','mentor-secret-naufal-sebastian-s-h-m-h','xitzhuk8duyb');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('mentor-nurul-hidayah-s-si-m-biotech','Nurul Hidayah S.Si, M.Biotech','mentor','mentor-secret-nurul-hidayah-s-si-m-biotech','uwdwgsbvs4v8');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('mentor-panji-agung-pedekso-s-hum','Panji Agung Pedekso, S.Hum','mentor','mentor-secret-panji-agung-pedekso-s-hum','1d83leiqo3dk');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('mentor-prof-yayuk','Prof Yayuk Astuti, S.Si., Ph.D','mentor','mentor-secret-prof-yayuk','w0jt5m186p83');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('mentor-rifky-ariya-pratama-s-kom','Rifky Ariya Pratama, S.Kom.','mentor','mentor-secret-rifky-ariya-pratama-s-kom','fxgruau2s5b5');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('mentor-salindri-prawitasari-s-si-m-si','Salindri Prawitasari, S.Si, M.Si.','mentor','mentor-secret-salindri-prawitasari-s-si-m-si','f4lnr30vyrji');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('mentor-sutinnarto-s-i-kom-m-i-kom','Sutinnarto, S.I.Kom., M.I.Kom','mentor','mentor-secret-sutinnarto-s-i-kom-m-i-kom','1so9u86kb9e3');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('student-alvin-syaptia-pratama-s-i-kom','Alvin Syaptia Pratama, S.I.Kom','student','student-secret-alvin-syaptia-pratama-s-i-kom','guiorvvmg0ix');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('student-alya-namira-ikfinasulkha-s-ip','Alya Namira Ikfinasulkha, S.IP.','student','student-secret-alya-namira-ikfinasulkha-s-ip','wrluk3z2sfxa');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('student-alya-pramesty-s-si','Alya Pramesty, S.Si','student','student-secret-alya-pramesty-s-si','i6nkiw5ght2h');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('student-bdn-sri-mularsih-s-sit-m-kes','Bdn. Sri Mularsih, S.SiT, M.Kes','student','student-secret-bdn-sri-mularsih-s-sit-m-kes','o9yjqttaxqrc');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('student-bdn-titik-kurniawati-s-sit-m-kes-m-keb','Bdn. Titik Kurniawati, S.SiT, M.Kes, M.Keb','student','student-secret-bdn-titik-kurniawati-s-sit-m-kes-m-keb','6f6dx491tgl8');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('student-bela-pristiandani-s-ak','Bela Pristiandani, S.Ak','student','student-secret-bela-pristiandani-s-ak','76ahck788ftn');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('student-claudea-winandyaz-r-s-pd-m-pd','Claudea Winandyaz R, S.Pd, M.Pd.','student','student-secret-claudea-winandyaz-r-s-pd-m-pd','o6001hbzxzb1');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('student-dewi-elliana-skm-s-tr-keb-m-kes','Dewi Elliana, SKM, S.Tr.Keb, M.Kes','student','student-secret-dewi-elliana-skm-s-tr-keb-m-kes','x3ud9sg3i5iz');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('student-diah-widyatun-s-s-t-m-tr-keb','Diah Widyatun, S.S.T., M.Tr.Keb','student','student-secret-diah-widyatun-s-s-t-m-tr-keb','dpm5yt5qgtmf');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('student-dini-cahyani-s-si-m-biotech','Dini Cahyani, S.Si, M.Biotech','student','student-secret-dini-cahyani-s-si-m-biotech','po7p58592lit');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('student-dr-erwin-s-h-m-h','dr. Erwin, S.H., M.H','student','student-secret-dr-erwin-s-h-m-h','0b3t21yrms3q');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('student-erna-setyaningsih-s-s-t-m-tr-keb','Erna Setyaningsih, S.S.T.,M.Tr.Keb','student','student-secret-erna-setyaningsih-s-s-t-m-tr-keb','u55073jk3xyi');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('student-fauziah-novita-putri-rifai-s-si-m-biotech','Fauziah Novita Putri Rifai, S.Si, M.Biotech','student','student-secret-fauziah-novita-putri-rifai-s-si-m-biotech','fjz1blwsdlqp');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('student-firda-rismadhani-s-m','Firda Rismadhani, S.M','student','student-secret-firda-rismadhani-s-m','ar5z2cmemj3d');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('student-galih-nanda-purnama-s-ds','Galih Nanda Purnama , S.Ds','student','student-secret-galih-nanda-purnama-s-ds','w236ipo304z2');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('student-labbra-pasaribu-s-m','Labbra Pasaribu, S.M','student','student-secret-labbra-pasaribu-s-m','13qml1einddg');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('student-lakna-tulas-un-s-sos-m-i-kom','Lakna Tulas''un, S.Sos, M.I.Kom','student','student-secret-lakna-tulas-un-s-sos-m-i-kom','igmpt7klpfgd');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('student-muhamad-agung-s-s-sos-m-sos','Muhamad Agung S, S.Sos., M.Sos','student','student-secret-muhamad-agung-s-s-sos-m-sos','5r20f00coacy');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('student-nadya-audina-ns-s-si-m-biomed','Nadya Audina NS. S.Si., M.Biomed','student','student-secret-nadya-audina-ns-s-si-m-biomed','vf46dzevx72f');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('student-putri-aryo-jelang-fitri-khothimah-s-e-m-m','Putri Aryo Jelang Fitri Khothimah, S.E., M.M.','student','student-secret-putri-aryo-jelang-fitri-khothimah-s-e-m-m','n3i67gm324cz');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('student-qolbi-hanif-fadhlulloh-s-h-m-h','Qolbi Hanif Fadhlulloh, S.H.,M.H.','student','student-secret-qolbi-hanif-fadhlulloh-s-h-m-h','sm89ph4eboth');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('student-rahmawati-s-a-b','Rahmawati, S.A.B','student','student-secret-rahmawati-s-a-b','vxt060xpgpci');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('student-randika-shafly-fawwaz-s-m-m-m','Randika Shafly Fawwaz, S.M., M.M','student','student-secret-randika-shafly-fawwaz-s-m-m-m','zjq53ts8gz6c');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('student-reni-nur-arifah-s-e-m-m','Reni Nur Arifah, S.E., M.M.','student','student-secret-reni-nur-arifah-s-e-m-m','vojggkrsf4ou');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('student-ridha-azahra-s-pd','Ridha Azahra, S.Pd','student','student-secret-ridha-azahra-s-pd','68csl6vlwldx');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('student-rif-atul-himmah-s-sos-m-i-kom','Rif''atul Himmah, S.Sos. M.I.Kom.','student','student-secret-rif-atul-himmah-s-sos-m-i-kom','usx7tfldjyc7');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('student-risky-chandra-satria-irawan-s-si-m-biomed','Risky Chandra Satria Irawan S.Si, M.Biomed','student','student-secret-risky-chandra-satria-irawan-s-si-m-biomed','0ld6mp93avpp');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('student-rizqitha-s-tr-keb-m-tr-keb','Rizqitha, S.Tr.Keb., M.Tr.Keb','student','student-secret-rizqitha-s-tr-keb-m-tr-keb','wb379uqi80vv');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('student-rudi-hermawan-s-kom','Rudi Hermawan S.Kom','student','student-secret-rudi-hermawan-s-kom','qaecvupd642x');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('student-yetty-yuliany-k-s-e-m-m','Yetty Yuliany K, S.E., M.M','student','student-secret-yetty-yuliany-k-s-e-m-m','ks7mgxadtej4');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('student-zain-arfin-utama-s-h-m-h','Zain Arfin Utama, S.H., M.H.','student','student-secret-zain-arfin-utama-s-h-m-h','u3b6iwlm6k02');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('student-ms-rita','dr. Rita Agustina, M.Biomed','student','student-secret-ms-rita','y1qxdfl8j62w');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('test-student-01','Test Student 01','student','test-student-secret-01','test-student-01');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('test-student-02','Test Student 02','student','test-student-secret-02','test-student-02');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('test-student-03','Test Student 03','student','test-student-secret-03','test-student-03');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('test-student-04','Test Student 04','student','test-student-secret-04','test-student-04');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('test-student-05','Test Student 05','student','test-student-secret-05','test-student-05');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('test-student-06','Test Student 06','student','test-student-secret-06','test-student-06');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('test-student-07','Test Student 07','student','test-student-secret-07','test-student-07');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('test-student-08','Test Student 08','student','test-student-secret-08','test-student-08');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('test-student-09','Test Student 09','student','test-student-secret-09','test-student-09');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('test-student-10','Test Student 10','student','test-student-secret-10','test-student-10');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('test-mentor-01','Test Mentor 01','mentor','test-mentor-secret-01','test-mentor-01');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('test-mentor-02','Test Mentor 02','mentor','test-mentor-secret-02','test-mentor-02');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('test-mentor-03','Test Mentor 03','mentor','test-mentor-secret-03','test-mentor-03');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('test-mentor-04','Test Mentor 04','mentor','test-mentor-secret-04','test-mentor-04');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('test-mentor-05','Test Mentor 05','mentor','test-mentor-secret-05','test-mentor-05');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('test-mentor-06','Test Mentor 06','mentor','test-mentor-secret-06','test-mentor-06');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('test-mentor-07','Test Mentor 07','mentor','test-mentor-secret-07','test-mentor-07');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('test-mentor-08','Test Mentor 08','mentor','test-mentor-secret-08','test-mentor-08');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('test-mentor-09','Test Mentor 09','mentor','test-mentor-secret-09','test-mentor-09');
INSERT INTO "people" ("person_id","display_name","role","secret_id","secret_path_token") VALUES('test-mentor-10','Test Mentor 10','mentor','test-mentor-secret-10','test-mentor-10');
CREATE TABLE scan_records (
  scan_id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  mentor_id TEXT NOT NULL,
  event_date TEXT NOT NULL,
  scanned_at TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL, entry_method TEXT NOT NULL DEFAULT 'qr'
  CHECK (entry_method IN ('qr', 'fallback_code')),
  UNIQUE (student_id, mentor_id, event_date),
  FOREIGN KEY (student_id) REFERENCES people(person_id),
  FOREIGN KEY (mentor_id) REFERENCES people(person_id)
);
INSERT INTO "scan_records" ("scan_id","student_id","mentor_id","event_date","scanned_at","notes","updated_at","entry_method") VALUES('c543ce58-b789-463f-b636-26c5c3636906','student-dr-erwin-s-h-m-h','mentor-bondan-eko-suratno-m-hum','2026-04-18','2026-04-18T01:33:07.669Z','OK','2026-04-18T01:38:17.326Z','qr');
INSERT INTO "scan_records" ("scan_id","student_id","mentor_id","event_date","scanned_at","notes","updated_at","entry_method") VALUES('6f6672f7-8809-47fa-9ad9-95657f5374cd','student-alvin-syaptia-pratama-s-i-kom','mentor-panji-agung-pedekso-s-hum','2026-04-18','2026-04-18T06:48:41.684Z','','2026-04-18T06:48:41.684Z','qr');
INSERT INTO "scan_records" ("scan_id","student_id","mentor_id","event_date","scanned_at","notes","updated_at","entry_method") VALUES('67ebb42a-b487-4d87-bf81-c6c31e932b9f','test-student-01','test-mentor-01','2026-04-21','2026-04-21T04:41:01.772Z','good job','2026-04-21T04:41:10.621Z','qr');
INSERT INTO "scan_records" ("scan_id","student_id","mentor_id","event_date","scanned_at","notes","updated_at","entry_method") VALUES('434d1ffc-ef0c-4155-b60f-69c5d5acde46','test-student-02','test-mentor-02','2026-04-21','2026-04-21T04:41:55.679Z','tessss','2026-04-21T04:42:10.416Z','qr');
INSERT INTO "scan_records" ("scan_id","student_id","mentor_id","event_date","scanned_at","notes","updated_at","entry_method") VALUES('d2b59ed4-ea22-4817-8d4f-f2d3eeba1e7f','test-student-01','test-mentor-05','2026-04-22','2026-04-22T04:42:06.796Z','teeeesssss3333','2026-04-22T04:43:03.431Z','qr');
INSERT INTO "scan_records" ("scan_id","student_id","mentor_id","event_date","scanned_at","notes","updated_at","entry_method") VALUES('3d110054-2c77-458d-bc3b-06297cc82c0d','test-student-01','test-mentor-02','2026-04-22','2026-04-22T06:33:06.056Z','Good job guyss','2026-04-22T06:33:50.339Z','qr');
INSERT INTO "scan_records" ("scan_id","student_id","mentor_id","event_date","scanned_at","notes","updated_at","entry_method") VALUES('104b8b2b-4378-44e5-8a5c-f15a2e06f7ce','test-student-01','test-mentor-01','2026-04-22','2026-04-22T06:38:38.856Z','Thanks, Bu Rifa. Good job! ','2026-04-22T06:39:04.979Z','qr');
INSERT INTO "scan_records" ("scan_id","student_id","mentor_id","event_date","scanned_at","notes","updated_at","entry_method") VALUES('b6e9e356-ca93-4aa0-8e94-c183c06bd93a','test-student-02','test-mentor-01','2026-04-22','2026-04-22T06:40:44.964Z','Hi Bu Qiqit! Thank you! ','2026-04-22T06:41:16.313Z','qr');
INSERT INTO "scan_records" ("scan_id","student_id","mentor_id","event_date","scanned_at","notes","updated_at","entry_method") VALUES('d3e59ade-a40a-4019-acd6-257e6988065a','test-student-03','test-mentor-01','2026-04-22','2026-04-22T06:44:54.721Z','Thanks, Mr Erwin. Well-done! ','2026-04-22T06:45:16.530Z','qr');
INSERT INTO "scan_records" ("scan_id","student_id","mentor_id","event_date","scanned_at","notes","updated_at","entry_method") VALUES('00ec3d59-3761-4f64-9d09-8dbc14ef1b67','test-student-04','test-mentor-01','2026-04-22','2026-04-22T06:46:30.911Z','Thank you, Pak Agung. Keep improving! ','2026-04-22T06:46:54.361Z','qr');
INSERT INTO "scan_records" ("scan_id","student_id","mentor_id","event_date","scanned_at","notes","updated_at","entry_method") VALUES('54422ca0-8ff8-4c93-8b92-c9d8b3a9fe25','test-student-05','test-mentor-01','2026-04-22','2026-04-22T06:48:20.196Z','Assalamu''alaikum. Okay, Pak. ','2026-04-22T06:49:00.619Z','qr');
INSERT INTO "scan_records" ("scan_id","student_id","mentor_id","event_date","scanned_at","notes","updated_at","entry_method") VALUES('00d345b4-6b19-47e4-a2d8-b4c818607fbb','test-student-02','test-mentor-02','2026-04-22','2026-04-22T06:59:01.318Z','Good','2026-04-22T06:59:14.598Z','fallback_code');
INSERT INTO "scan_records" ("scan_id","student_id","mentor_id","event_date","scanned_at","notes","updated_at","entry_method") VALUES('91fe4985-d2f3-441c-b3b7-864e1ba8f866','test-student-06','test-mentor-02','2026-04-22','2026-04-22T07:00:27.547Z','Oke','2026-04-22T07:00:38.577Z','fallback_code');
CREATE TABLE mentor_fallback_codes (
  fallback_code_id TEXT PRIMARY KEY,
  mentor_id TEXT NOT NULL,
  code_value TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  consumed_by_student_id TEXT,
  consumed_scan_id TEXT
);
INSERT INTO "mentor_fallback_codes" ("fallback_code_id","mentor_id","code_value","created_at","expires_at","consumed_at","consumed_by_student_id","consumed_scan_id") VALUES('be38294b-670f-4371-b1aa-2f61f81797d7','test-mentor-02','64431369','2026-04-21T04:42:41.236Z','2026-04-21T04:47:41.236Z',NULL,NULL,NULL);
INSERT INTO "mentor_fallback_codes" ("fallback_code_id","mentor_id","code_value","created_at","expires_at","consumed_at","consumed_by_student_id","consumed_scan_id") VALUES('ec512aa9-cf0a-4c8c-ab2d-78e9a7754a20','test-mentor-02','88752940','2026-04-22T06:58:45.783Z','2026-04-22T07:03:45.783Z','2026-04-22T06:59:01.342Z','test-student-02','00d345b4-6b19-47e4-a2d8-b4c818607fbb');
INSERT INTO "mentor_fallback_codes" ("fallback_code_id","mentor_id","code_value","created_at","expires_at","consumed_at","consumed_by_student_id","consumed_scan_id") VALUES('ec58a04a-c3fa-4b6c-b494-4885994149b4','test-mentor-02','45562279','2026-04-22T07:00:09.850Z','2026-04-22T07:05:09.850Z','2026-04-22T07:00:27.616Z','test-student-06','91fe4985-d2f3-441c-b3b7-864e1ba8f866');
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('d1_migrations',3);
CREATE INDEX idx_people_role ON people(role);
CREATE INDEX idx_scan_records_student_date ON scan_records(student_id, event_date);
CREATE INDEX idx_scan_records_mentor_date ON scan_records(mentor_id, event_date);
CREATE INDEX idx_fallback_mentor_active ON mentor_fallback_codes(mentor_id, expires_at);
CREATE INDEX idx_fallback_code_value ON mentor_fallback_codes(code_value);
