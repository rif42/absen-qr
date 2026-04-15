import type { ScanRecord } from "../types";

type CreateScanRecordInput = {
  scanId: string;
  studentId: string;
  mentorId: string;
  eventDate: string;
  scannedAt: string;
};

export async function createScanRecord(
  db: D1Database,
  input: CreateScanRecordInput
): Promise<ScanRecord> {
  await db
    .prepare(
      `
        INSERT INTO scan_records (
          scan_id,
          student_id,
          mentor_id,
          event_date,
          scanned_at,
          notes,
          updated_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
      `
    )
    .bind(
      input.scanId,
      input.studentId,
      input.mentorId,
      input.eventDate,
      input.scannedAt,
      "",
      input.scannedAt
    )
    .run();

  return {
    scan_id: input.scanId,
    student_id: input.studentId,
    mentor_id: input.mentorId,
    event_date: input.eventDate,
    scanned_at: input.scannedAt,
    notes: "",
    updated_at: input.scannedAt
  };
}

export function isDuplicateScanRecordError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const normalizedMessage = error.message.toLowerCase();
  return normalizedMessage.includes("unique constraint failed") && normalizedMessage.includes("scan_records");
}

export async function listStudentHistory(
  db: D1Database,
  studentId: string,
  utcDate: string
): Promise<ScanRecord[]> {
  const result = await db
    .prepare(
      `
        SELECT scan_id, student_id, mentor_id, event_date, scanned_at, notes, updated_at
        FROM scan_records
        WHERE student_id = ?1 AND substr(scanned_at, 1, 10) = ?2
        ORDER BY scanned_at DESC
      `
    )
    .bind(studentId, utcDate)
    .all<ScanRecord>();

  return result.results;
}

export async function findStudentMentorScanRecordByEventDate(
  db: D1Database,
  studentId: string,
  mentorId: string,
  utcDate: string
): Promise<ScanRecord | null> {
  const result = await db
    .prepare(
      `
        SELECT scan_id, student_id, mentor_id, event_date, scanned_at, notes, updated_at
        FROM scan_records
        WHERE student_id = ?1 AND mentor_id = ?2 AND substr(scanned_at, 1, 10) = ?3
        LIMIT 1
      `
    )
    .bind(studentId, mentorId, utcDate)
    .first<ScanRecord>();

  return result ?? null;
}

export async function listMentorRecentScans(
  db: D1Database,
  mentorId: string,
  utcDate: string
): Promise<ScanRecord[]> {
  const result = await db
    .prepare(
      `
        SELECT scan_id, student_id, mentor_id, event_date, scanned_at, notes, updated_at
        FROM scan_records
        WHERE mentor_id = ?1 AND substr(scanned_at, 1, 10) = ?2
        ORDER BY scanned_at DESC
      `
    )
    .bind(mentorId, utcDate)
    .all<ScanRecord>();

  return result.results;
}

export async function findMentorScanRecordById(
  db: D1Database,
  mentorId: string,
  scanId: string
): Promise<ScanRecord | null> {
  const result = await db
    .prepare(
      `
        SELECT scan_id, student_id, mentor_id, event_date, scanned_at, notes, updated_at
        FROM scan_records
        WHERE mentor_id = ?1 AND scan_id = ?2
        LIMIT 1
      `
    )
    .bind(mentorId, scanId)
    .first<ScanRecord>();

  return result ?? null;
}

export async function updateScanRecordNotes(
  db: D1Database,
  mentorId: string,
  scanId: string,
  notes: string,
  updatedAt: string
): Promise<ScanRecord | null> {
  const existingRecord = await findMentorScanRecordById(db, mentorId, scanId);

  if (!existingRecord) {
    return null;
  }

  await db
    .prepare(
      `
        UPDATE scan_records
        SET notes = ?1, updated_at = ?2
        WHERE mentor_id = ?3 AND scan_id = ?4
      `
    )
    .bind(notes, updatedAt, mentorId, scanId)
    .run();

  return {
    ...existingRecord,
    notes,
    updated_at: updatedAt
  };
}

export type BackfillCollision = {
  scanId: string;
  studentId: string;
  mentorId: string;
  scannedAt: string;
  currentEventDate: string;
  derivedDay: string;
  collidingScanId: string;
};

export type BackfillResult = {
  mismatchedRows: number;
  updatedRows: number;
  collisions: BackfillCollision[];
};

export async function auditAndBackfillEventDates(db: D1Database): Promise<BackfillResult> {
  const auditResult = await db
    .prepare(
      `
        SELECT scan_id, student_id, mentor_id, scanned_at, event_date
        FROM scan_records
        WHERE event_date != substr(scanned_at, 1, 10)
      `
    )
    .bind()
    .all<{ scan_id: string; student_id: string; mentor_id: string; scanned_at: string; event_date: string }>();

  const mismatchedRows = auditResult.results;
  const collisions: BackfillCollision[] = [];

  for (const row of mismatchedRows) {
    const derivedDay = row.scanned_at.substring(0, 10);

    const collisionCheck = await db
      .prepare(
        `
          SELECT scan_id
          FROM scan_records
          WHERE student_id = ?1
            AND mentor_id = ?2
            AND event_date = ?3
            AND scan_id != ?4
          LIMIT 1
        `
      )
      .bind(row.student_id, row.mentor_id, derivedDay, row.scan_id)
      .first<{ scan_id: string }>();

    if (collisionCheck) {
      collisions.push({
        scanId: row.scan_id,
        studentId: row.student_id,
        mentorId: row.mentor_id,
        scannedAt: row.scanned_at,
        currentEventDate: row.event_date,
        derivedDay,
        collidingScanId: collisionCheck.scan_id
      });
    }
  }

  if (collisions.length > 0) {
    const details = collisions
      .map(
        (c) =>
          `scan_id=${c.scanId} (student=${c.studentId}, mentor=${c.mentorId}) would collide with scan_id=${c.collidingScanId} on derived day ${c.derivedDay}`
      )
      .join("; ");
    throw new Error(
      `Backfill aborted: ${collisions.length} row(s) would violate the unique (student_id, mentor_id, event_date) constraint. Resolve manually before retrying. Collisions: ${details}`
    );
  }

  for (const row of mismatchedRows) {
    const derivedDay = row.scanned_at.substring(0, 10);
    await db
      .prepare(
        `
          UPDATE scan_records
          SET event_date = ?1
          WHERE scan_id = ?2
        `
      )
      .bind(derivedDay, row.scan_id)
      .run();
  }

  return {
    mismatchedRows: mismatchedRows.length,
    updatedRows: mismatchedRows.length,
    collisions
  };
}
