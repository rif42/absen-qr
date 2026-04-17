export type TestPersonFixture = {
  person_id: string;
  display_name: string;
  role: "student" | "mentor";
  secret_id: string;
  secret_path_token: string;
};

export const REAL_STUDENTS: TestPersonFixture[] = [
  {
    person_id: "student-bdn-titik-kurniawati-s-sit-m-kes-m-keb",
    display_name: "Bdn. Titik Kurniawati, S.SiT, M.Kes, M.Keb",
    role: "student",
    secret_id: "student-secret-bdn-titik-kurniawati-s-sit-m-kes-m-keb",
    secret_path_token: "student-bdn-titik-kurniawati-s-sit-m-kes-m-keb"
  },
  {
    person_id: "student-rizqitha-s-tr-keb-m-tr-keb",
    display_name: "Rizqitha, S.Tr.Keb., M.Tr.Keb",
    role: "student",
    secret_id: "student-secret-rizqitha-s-tr-keb-m-tr-keb",
    secret_path_token: "student-rizqitha-s-tr-keb-m-tr-keb"
  },
  {
    person_id: "student-qolbi-hanif-fadhlulloh-s-h-m-h",
    display_name: "Qolbi Hanif Fadhlulloh, S.H.,M.H.",
    role: "student",
    secret_id: "student-secret-qolbi-hanif-fadhlulloh-s-h-m-h",
    secret_path_token: "student-qolbi-hanif-fadhlulloh-s-h-m-h"
  },
  {
    person_id: "student-muhamad-agung-s-s-sos-m-sos",
    display_name: "Muhamad Agung S, S.Sos., M.Sos",
    role: "student",
    secret_id: "student-secret-muhamad-agung-s-s-sos-m-sos",
    secret_path_token: "student-muhamad-agung-s-s-sos-m-sos"
  },
  {
    person_id: "student-reni-nur-arifah-s-e-m-m",
    display_name: "Reni Nur Arifah, S.E., M.M.",
    role: "student",
    secret_id: "student-secret-reni-nur-arifah-s-e-m-m",
    secret_path_token: "student-reni-nur-arifah-s-e-m-m"
  },
  {
    person_id: "student-nadya-audina-ns-s-si-m-biomed",
    display_name: "Nadya Audina NS. S.Si., M.Biomed",
    role: "student",
    secret_id: "student-secret-nadya-audina-ns-s-si-m-biomed",
    secret_path_token: "student-nadya-audina-ns-s-si-m-biomed"
  },
  {
    person_id: "student-fauziah-novita-putri-rifai-s-si-m-biotech",
    display_name: "Fauziah Novita Putri Rifai, S.Si, M.Biotech",
    role: "student",
    secret_id: "student-secret-fauziah-novita-putri-rifai-s-si-m-biotech",
    secret_path_token: "student-fauziah-novita-putri-rifai-s-si-m-biotech"
  },
  {
    person_id: "student-erna-setyaningsih-s-s-t-m-tr-keb",
    display_name: "Erna Setyaningsih, S.S.T.,M.Tr.Keb",
    role: "student",
    secret_id: "student-secret-erna-setyaningsih-s-s-t-m-tr-keb",
    secret_path_token: "student-erna-setyaningsih-s-s-t-m-tr-keb"
  },
  {
    person_id: "student-diah-widyatun-s-s-t-m-tr-keb",
    display_name: "Diah Widyatun, S.S.T., M.Tr.Keb",
    role: "student",
    secret_id: "student-secret-diah-widyatun-s-s-t-m-tr-keb",
    secret_path_token: "student-diah-widyatun-s-s-t-m-tr-keb"
  },
  {
    person_id: "student-bdn-sri-mularsih-s-sit-m-kes",
    display_name: "Bdn. Sri Mularsih, S.SiT, M.Kes",
    role: "student",
    secret_id: "student-secret-bdn-sri-mularsih-s-sit-m-kes",
    secret_path_token: "student-bdn-sri-mularsih-s-sit-m-kes"
  }
];

export const REAL_MENTORS: TestPersonFixture[] = [
  {
    person_id: "mentor-mohammad-ariq-nazar-s-si-m-biomed",
    display_name: "Mohammad Ariq Nazar, S.Si, M.Biomed",
    role: "mentor",
    secret_id: "mentor-secret-mohammad-ariq-nazar-s-si-m-biomed",
    secret_path_token: "mentor-mohammad-ariq-nazar-s-si-m-biomed"
  },
  {
    person_id: "mentor-bd-mariza-mustika-d-s-tr-keb-m-tr-keb",
    display_name: "Bd. Mariza Mustika D, S.Tr.Keb., M.Tr.Keb",
    role: "mentor",
    secret_id: "mentor-secret-bd-mariza-mustika-d-s-tr-keb-m-tr-keb",
    secret_path_token: "mentor-bd-mariza-mustika-d-s-tr-keb-m-tr-keb"
  },
  {
    person_id: "mentor-naufal-sebastian-s-h-m-h",
    display_name: "Naufal Sebastian, S.H.,M.H.",
    role: "mentor",
    secret_id: "mentor-secret-naufal-sebastian-s-h-m-h",
    secret_path_token: "mentor-naufal-sebastian-s-h-m-h"
  },
  {
    person_id: "mentor-sutinnarto-s-i-kom-m-i-kom",
    display_name: "Sutinnarto, S.I.Kom., M.I.Kom",
    role: "mentor",
    secret_id: "mentor-secret-sutinnarto-s-i-kom-m-i-kom",
    secret_path_token: "mentor-sutinnarto-s-i-kom-m-i-kom"
  },
  {
    person_id: "mentor-najmi-rizki-khairani-s-sos-m-i-kom",
    display_name: "Najmi Rizki Khairani, S.Sos., M.I.Kom",
    role: "mentor",
    secret_id: "mentor-secret-najmi-rizki-khairani-s-sos-m-i-kom",
    secret_path_token: "mentor-najmi-rizki-khairani-s-sos-m-i-kom"
  },
  {
    person_id: "mentor-dr-ir-agus-f-abdillah-mba-ermap",
    display_name: "Dr. Ir. Agus F. Abdillah, MBA, ERMAP",
    role: "mentor",
    secret_id: "mentor-secret-dr-ir-agus-f-abdillah-mba-ermap",
    secret_path_token: "mentor-dr-ir-agus-f-abdillah-mba-ermap"
  },
  {
    person_id: "mentor-eva-fachria-s-e-m-s-m",
    display_name: "Eva Fachria, S.E., M.S.M.",
    role: "mentor",
    secret_id: "mentor-secret-eva-fachria-s-e-m-s-m",
    secret_path_token: "mentor-eva-fachria-s-e-m-s-m"
  },
  {
    person_id: "mentor-anindya-putri-utami-s-m-m-m",
    display_name: "Anindya Putri Utami, S.M., M.M.",
    role: "mentor",
    secret_id: "mentor-secret-anindya-putri-utami-s-m-m-m",
    secret_path_token: "mentor-anindya-putri-utami-s-m-m-m"
  },
  {
    person_id: "mentor-dian-respati-ayu-s-si-m-biomed",
    display_name: "Dian Respati Ayu, S.Si., M.Biomed",
    role: "mentor",
    secret_id: "mentor-secret-dian-respati-ayu-s-si-m-biomed",
    secret_path_token: "mentor-dian-respati-ayu-s-si-m-biomed"
  },
  {
    person_id: "mentor-dendi-krisna-nugraha-m-sc-ph-d",
    display_name: "Dendi Krisna Nugraha, M.Sc., Ph.D.",
    role: "mentor",
    secret_id: "mentor-secret-dendi-krisna-nugraha-m-sc-ph-d",
    secret_path_token: "mentor-dendi-krisna-nugraha-m-sc-ph-d"
  }
];

export const REAL_ROSTER: TestPersonFixture[] = [...REAL_STUDENTS, ...REAL_MENTORS];

export const REAL_STUDENTS_BY_NAME = [...REAL_STUDENTS].sort((left, right) =>
  left.display_name.localeCompare(right.display_name)
);

export const REAL_MENTORS_BY_NAME = [...REAL_MENTORS].sort((left, right) =>
  left.display_name.localeCompare(right.display_name)
);
