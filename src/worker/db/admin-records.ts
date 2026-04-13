import { listPeopleByRole } from "./people";

type AdminPersonOption = {
  personId: string;
  displayName: string;
};

type AdminRecord = {
  scanId: string;
  studentId: string;
  studentName: string;
  studentSecretId: string;
  mentorId: string;
  mentorName: string;
  eventDate: string;
  scannedAt: string;
  notes: string;
  updatedAt: string;
};

type AdminExportRow = {
  studentName: string;
  studentSecretId: string;
  mentorName: string;
  eventDate: string;
  notes: string;
};

type AdminRecordsPayload = {
  eventDate: string;
  records: AdminRecord[];
  students: AdminPersonOption[];
  mentors: AdminPersonOption[];
};

type UpdateAdminRecordInput = {
  scanId: string;
  notes?: string;
  studentId?: string;
  mentorId?: string;
  updatedAt: string;
};

type AdminRecordRow = {
  scan_id: string;
  student_id: string;
  student_name: string;
  student_secret_id: string;
  mentor_id: string;
  mentor_name: string;
  event_date: string;
  scanned_at: string;
  notes: string;
  updated_at: string;
};

type AdminExportRowRecord = {
  student_name: string;
  student_secret_id: string;
  mentor_name: string;
  event_date: string;
  notes: string;
};

function mapAdminPersonOption(person: { person_id: string; display_name: string }): AdminPersonOption {
  return {
    personId: person.person_id,
    displayName: person.display_name
  };
}

function mapAdminRecord(row: AdminRecordRow): AdminRecord {
  return {
    scanId: row.scan_id,
    studentId: row.student_id,
    studentName: row.student_name,
    studentSecretId: row.student_secret_id,
    mentorId: row.mentor_id,
    mentorName: row.mentor_name,
    eventDate: row.event_date,
    scannedAt: row.scanned_at,
    notes: row.notes,
    updatedAt: row.updated_at
  };
}

function mapAdminExportRow(row: AdminExportRowRecord): AdminExportRow {
  return {
    studentName: row.student_name,
    studentSecretId: row.student_secret_id,
    mentorName: row.mentor_name,
    eventDate: row.event_date,
    notes: row.notes
  };
}

export async function listAdminStudentOptions(db: D1Database): Promise<AdminPersonOption[]> {
  const students = await listPeopleByRole(db, "student");
  return students.map(mapAdminPersonOption);
}

export async function listAdminMentorOptions(db: D1Database): Promise<AdminPersonOption[]> {
  const mentors = await listPeopleByRole(db, "mentor");
  return mentors.map(mapAdminPersonOption);
}

export async function listAdminRecords(db: D1Database, eventDate: string): Promise<AdminRecord[]> {
  const result = await db
    .prepare(
      `
        SELECT
          scan_records.scan_id,
          scan_records.student_id,
          student.display_name AS student_name,
          student.secret_id AS student_secret_id,
          scan_records.mentor_id,
          mentor.display_name AS mentor_name,
          scan_records.event_date,
          scan_records.scanned_at,
          scan_records.notes,
          scan_records.updated_at
        FROM scan_records
        JOIN people AS student
          ON student.person_id = scan_records.student_id
         AND student.role = 'student'
        JOIN people AS mentor
          ON mentor.person_id = scan_records.mentor_id
         AND mentor.role = 'mentor'
        WHERE scan_records.event_date = ?1
        ORDER BY scan_records.scanned_at DESC, scan_records.scan_id DESC
      `
    )
    .bind(eventDate)
    .all<AdminRecordRow>();

  return result.results.map(mapAdminRecord);
}

export async function findAdminRecordById(db: D1Database, scanId: string): Promise<AdminRecord | null> {
  const result = await db
    .prepare(
      `
        SELECT
          scan_records.scan_id,
          scan_records.student_id,
          student.display_name AS student_name,
          student.secret_id AS student_secret_id,
          scan_records.mentor_id,
          mentor.display_name AS mentor_name,
          scan_records.event_date,
          scan_records.scanned_at,
          scan_records.notes,
          scan_records.updated_at
        FROM scan_records
        JOIN people AS student
          ON student.person_id = scan_records.student_id
         AND student.role = 'student'
        JOIN people AS mentor
          ON mentor.person_id = scan_records.mentor_id
         AND mentor.role = 'mentor'
        WHERE scan_records.scan_id = ?1
        LIMIT 1
      `
    )
    .bind(scanId)
    .first<AdminRecordRow>();

  return result ? mapAdminRecord(result) : null;
}

export async function updateAdminRecord(db: D1Database, input: UpdateAdminRecordInput): Promise<AdminRecord | null> {
  const existingRecord = await findAdminRecordById(db, input.scanId);

  if (!existingRecord) {
    return null;
  }

  const assignments: string[] = [];
  const values: string[] = [];

  if (input.notes !== undefined) {
    assignments.push(`notes = ?${assignments.length + 1}`);
    values.push(input.notes);
  }

  if (input.studentId !== undefined) {
    assignments.push(`student_id = ?${assignments.length + 1}`);
    values.push(input.studentId);
  }

  if (input.mentorId !== undefined) {
    assignments.push(`mentor_id = ?${assignments.length + 1}`);
    values.push(input.mentorId);
  }

  assignments.push(`updated_at = ?${assignments.length + 1}`);
  values.push(input.updatedAt);

  const scanIdPlaceholder = assignments.length + 1;

  await db
    .prepare(
      `
        UPDATE scan_records
        SET ${assignments.join(", ")}
        WHERE scan_id = ?${scanIdPlaceholder}
      `
    )
    .bind(...values, input.scanId)
    .run();

  return findAdminRecordById(db, input.scanId);
}

export async function deleteAdminRecord(db: D1Database, scanId: string): Promise<boolean> {
  const existingRecord = await findAdminRecordById(db, scanId);

  if (!existingRecord) {
    return false;
  }

  await db
    .prepare(
      `
        DELETE FROM scan_records
        WHERE scan_id = ?1
      `
    )
    .bind(scanId)
    .run();

  return true;
}

export async function listAdminExportRows(db: D1Database, eventDate: string): Promise<AdminExportRow[]> {
  const result = await db
    .prepare(
      `
        SELECT
          student.display_name AS student_name,
          student.secret_id AS student_secret_id,
          mentor.display_name AS mentor_name,
          scan_records.event_date,
          scan_records.notes
        FROM scan_records
        JOIN people AS student
          ON student.person_id = scan_records.student_id
         AND student.role = 'student'
        JOIN people AS mentor
          ON mentor.person_id = scan_records.mentor_id
         AND mentor.role = 'mentor'
        WHERE scan_records.event_date = ?1
        ORDER BY scan_records.scanned_at ASC, scan_records.scan_id ASC
      `
    )
    .bind(eventDate)
    .all<AdminExportRowRecord>();

  return result.results.map(mapAdminExportRow);
}

export async function getAdminRecordsPayload(
  db: D1Database,
  eventDate: string
): Promise<AdminRecordsPayload> {
  const [records, students, mentors] = await Promise.all([
    listAdminRecords(db, eventDate),
    listAdminStudentOptions(db),
    listAdminMentorOptions(db)
  ]);

  return {
    eventDate,
    records,
    students,
    mentors
  };
}

export type { AdminExportRow, AdminPersonOption, AdminRecord, AdminRecordsPayload, UpdateAdminRecordInput };
