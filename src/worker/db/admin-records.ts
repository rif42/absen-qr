import { listPeopleByRole } from "./people";

type AdminPersonOption = {
  personId: string;
  displayName: string;
};

type AdminRecord = {
  scanId: string;
  fromId: string;
  fromName: string;
  fromRole: "student" | "mentor";
  toId: string;
  toName: string;
  toRole: "student" | "mentor";
  eventDate: string;
  scannedAt: string;
  entryMethod: "qr" | "fallback_code";
  notes: string;
  updatedAt: string;
};

type AdminExportRow = {
  scannerName: string;
  scannerRole: "student" | "mentor";
  scannedName: string;
  scannedRole: "student" | "mentor";
  eventDate: string;
  notes: string;
  entryMethod: "qr" | "fallback_code";
};

type AdminRecordsPayload = {
  startDate: string;
  endDate: string;
  records: AdminRecord[];
  students: AdminPersonOption[];
  mentors: AdminPersonOption[];
};

type AdminUpdateScanRecordPayload = {
  scanId: string;
  notes?: string;
  fromId?: string;
  toId?: string;
  fromRole?: "student" | "mentor";
  toRole?: "student" | "mentor";
  updatedAt: string;
};

type AdminRecordRow = {
  scan_id: string;
  from_id: string;
  from_name: string;
  from_role: "student" | "mentor";
  to_id: string;
  to_name: string;
  to_role: "student" | "mentor";
  event_date: string;
  scanned_at: string;
  entry_method: "qr" | "fallback_code";
  notes: string;
  updated_at: string;
};

type AdminExportRowRecord = {
  from_name: string;
  from_role: "student" | "mentor";
  to_name: string;
  to_role: "student" | "mentor";
  event_date: string;
  notes: string;
  entry_method: "qr" | "fallback_code";
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
    fromId: row.from_id,
    fromName: row.from_name,
    fromRole: row.from_role,
    toId: row.to_id,
    toName: row.to_name,
    toRole: row.to_role,
    eventDate: row.event_date,
    scannedAt: row.scanned_at,
    entryMethod: row.entry_method,
    notes: row.notes,
    updatedAt: row.updated_at
  };
}

function mapAdminExportRow(row: AdminExportRowRecord): AdminExportRow {
  return {
    scannerName: row.from_name,
    scannerRole: row.from_role,
    scannedName: row.to_name,
    scannedRole: row.to_role,
    eventDate: row.event_date,
    notes: row.notes,
    entryMethod: row.entry_method
  };
}

function isMissingScanRecordsEntryMethodColumnError(error: unknown): boolean {
  return error instanceof Error && /no such column:.*entry_method/i.test(error.message);
}

function buildAdminRecordSelectQuery(entryMethodExpression: string, whereClause: string, orderClause: string): string {
  return `
    SELECT
      sr.scan_id,
      sr.from_id,
      sr.to_id,
      sr.from_role,
      sr.to_role,
      sr.event_date,
      sr.scanned_at,
      ${entryMethodExpression} AS entry_method,
      sr.notes,
      sr.updated_at,
      from_person.display_name AS from_name,
      to_person.display_name AS to_name
    FROM scan_records AS sr
    JOIN people AS from_person
      ON from_person.person_id = sr.from_id
    JOIN people AS to_person
      ON to_person.person_id = sr.to_id
    ${whereClause}
    ${orderClause}
  `;
}

async function queryAdminRecords(
  db: D1Database,
  startDate: string,
  endDate: string,
  entryMethodExpression: string
): Promise<AdminRecord[]> {
  const result = await db
    .prepare(
      buildAdminRecordSelectQuery(
        entryMethodExpression,
        `WHERE sr.event_date >= ?1
          AND sr.event_date <= ?2`,
        `ORDER BY sr.scanned_at DESC, sr.scan_id DESC`
      )
    )
    .bind(startDate, endDate)
    .all<AdminRecordRow>();

  return result.results.map(mapAdminRecord);
}

async function queryAdminRecordById(
  db: D1Database,
  scanId: string,
  entryMethodExpression: string
): Promise<AdminRecord | null> {
  const result = await db
    .prepare(
      buildAdminRecordSelectQuery(
        entryMethodExpression,
        `WHERE sr.scan_id = ?1`,
        `LIMIT 1`
      )
    )
    .bind(scanId)
    .first<AdminRecordRow>();

  return result ? mapAdminRecord(result) : null;
}

export async function listAdminStudentOptions(db: D1Database): Promise<AdminPersonOption[]> {
  const students = await listPeopleByRole(db, "student");
  return students.map(mapAdminPersonOption);
}

export async function listAdminMentorOptions(db: D1Database): Promise<AdminPersonOption[]> {
  const mentors = await listPeopleByRole(db, "mentor");
  return mentors.map(mapAdminPersonOption);
}

export async function listAdminRecords(
  db: D1Database,
  startDate: string,
  endDate = startDate
): Promise<AdminRecord[]> {
  try {
    return await queryAdminRecords(db, startDate, endDate, "sr.entry_method");
  } catch (error) {
    if (!isMissingScanRecordsEntryMethodColumnError(error)) {
      throw error;
    }

    return queryAdminRecords(db, startDate, endDate, "'qr'");
  }
}

export async function findAdminRecordById(db: D1Database, scanId: string): Promise<AdminRecord | null> {
  try {
    return await queryAdminRecordById(db, scanId, "sr.entry_method");
  } catch (error) {
    if (!isMissingScanRecordsEntryMethodColumnError(error)) {
      throw error;
    }

    return queryAdminRecordById(db, scanId, "'qr'");
  }
}

export async function updateAdminRecord(db: D1Database, input: AdminUpdateScanRecordPayload): Promise<AdminRecord | null> {
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

  if (input.fromId !== undefined) {
    assignments.push(`from_id = ?${assignments.length + 1}`);
    values.push(input.fromId);
  }

  if (input.toId !== undefined) {
    assignments.push(`to_id = ?${assignments.length + 1}`);
    values.push(input.toId);
  }

  if (input.fromRole !== undefined) {
    assignments.push(`from_role = ?${assignments.length + 1}`);
    values.push(input.fromRole);
  }

  if (input.toRole !== undefined) {
    assignments.push(`to_role = ?${assignments.length + 1}`);
    values.push(input.toRole);
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

export async function listAdminExportRows(
  db: D1Database,
  startDate: string,
  endDate = startDate
): Promise<AdminExportRow[]> {
  const result = await db
    .prepare(
      `
        SELECT
          from_person.display_name AS from_name,
          from_person.role AS from_role,
          to_person.display_name AS to_name,
          to_person.role AS to_role,
          sr.event_date,
          sr.notes,
          sr.entry_method
        FROM scan_records AS sr
        JOIN people AS from_person
          ON from_person.person_id = sr.from_id
        JOIN people AS to_person
          ON to_person.person_id = sr.to_id
        WHERE sr.event_date >= ?1
          AND sr.event_date <= ?2
        ORDER BY sr.scanned_at ASC, sr.scan_id ASC
      `
    )
    .bind(startDate, endDate)
    .all<AdminExportRowRecord>();

  return result.results.map(mapAdminExportRow);
}

export async function getAdminRecordsPayload(
  db: D1Database,
  startDate: string,
  endDate = startDate
): Promise<AdminRecordsPayload> {
  const [records, students, mentors] = await Promise.all([
    listAdminRecords(db, startDate, endDate),
    listAdminStudentOptions(db),
    listAdminMentorOptions(db)
  ]);

  return {
    startDate,
    endDate,
    records,
    students,
    mentors
  };
}

export type { AdminExportRow, AdminPersonOption, AdminRecord, AdminRecordsPayload, AdminUpdateScanRecordPayload };
