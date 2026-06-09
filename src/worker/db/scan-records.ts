import type { ScanRecord } from "../types";

type CreateScanRecordInput = {
  scanId: string;
  fromId: string;
  toId: string;
  fromRole: ScanRecord["from_role"];
  toRole: ScanRecord["to_role"];
  eventDate: string;
  scannedAt: string;
  entryMethod?: ScanRecord["entry_method"];
  notes?: string;
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
          from_id,
          to_id,
          from_role,
          to_role,
          event_date,
          scanned_at,
          entry_method,
          notes,
          updated_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
      `
    )
    .bind(
      input.scanId,
      input.fromId,
      input.toId,
      input.fromRole,
      input.toRole,
      input.eventDate,
      input.scannedAt,
      input.entryMethod ?? "qr",
      input.notes ?? "",
      input.scannedAt
    )
    .run();

  return {
    scan_id: input.scanId,
    from_id: input.fromId,
    to_id: input.toId,
    from_role: input.fromRole,
    to_role: input.toRole,
    event_date: input.eventDate,
    scanned_at: input.scannedAt,
    entry_method: input.entryMethod ?? "qr",
    notes: input.notes ?? "",
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

export async function listPersonHistory(
  db: D1Database,
  personId: string,
  eventDate: string
): Promise<(ScanRecord & { from_name: string; to_name: string })[]> {
  const { results } = await db
    .prepare(
      `
        SELECT
          sr.*,
          from_person.display_name AS from_name,
          to_person.display_name AS to_name
        FROM scan_records AS sr
        JOIN people AS from_person
          ON from_person.person_id = sr.from_id
        JOIN people AS to_person
          ON to_person.person_id = sr.to_id
        WHERE (sr.from_id = ?1 OR sr.to_id = ?1)
          AND sr.event_date = ?2
        ORDER BY sr.scanned_at DESC
      `
    )
    .bind(personId, eventDate)
    .all<ScanRecord & { from_name: string; to_name: string }>();

  return results ?? [];
}

export async function findScanRecordByPairAndDate(
  db: D1Database,
  fromId: string,
  toId: string,
  eventDate: string
): Promise<ScanRecord | null> {
  const result = await db
    .prepare(
      `
        SELECT scan_id, from_id, to_id, from_role, to_role, event_date, scanned_at, entry_method, notes, updated_at
        FROM scan_records
        WHERE from_id = ?1 AND to_id = ?2 AND event_date = ?3
        LIMIT 1
      `
    )
    .bind(fromId, toId, eventDate)
    .first<ScanRecord>();

  return result ?? null;
}

export async function findStudentMentorScanRecordByEventDate(
  db: D1Database,
  fromId: string,
  toId: string,
  fromRole: string,
  toRole: string,
  eventDate: string
): Promise<ScanRecord | null> {
  const result = await db
    .prepare(
      `
        SELECT scan_id, from_id, to_id, from_role, to_role, event_date, scanned_at, entry_method, notes, updated_at
        FROM scan_records
        WHERE from_id = ?1 AND to_id = ?2 AND from_role = ?3 AND to_role = ?4 AND event_date = ?5
        LIMIT 1
      `
    )
    .bind(fromId, toId, fromRole, toRole, eventDate)
    .first<ScanRecord>();

  return result ?? null;
}

export async function findScanRecordById(
  db: D1Database,
  scanId: string
): Promise<ScanRecord | null> {
  const result = await db
    .prepare(
      `
        SELECT scan_id, from_id, to_id, from_role, to_role, event_date, scanned_at, entry_method, notes, updated_at
        FROM scan_records
        WHERE scan_id = ?1
        LIMIT 1
      `
    )
    .bind(scanId)
    .first<ScanRecord>();

  return result ?? null;
}

export async function updateScanRecordNotes(
  db: D1Database,
  scanId: string,
  notes: string
): Promise<ScanRecord | null> {
  const existingRecord = await findScanRecordById(db, scanId);

  if (!existingRecord) {
    return null;
  }

  const updatedAt = new Date().toISOString();

  await db
    .prepare(
      `
        UPDATE scan_records
        SET notes = ?1, updated_at = ?2
        WHERE scan_id = ?3
      `
    )
    .bind(notes, updatedAt, scanId)
    .run();

  return {
    ...existingRecord,
    notes,
    updated_at: updatedAt
  };
}

export async function deleteScanRecordById(
  db: D1Database,
  scanId: string
): Promise<boolean> {
  const result = await db
    .prepare(
      `
        DELETE FROM scan_records
        WHERE scan_id = ?1
      `
    )
    .bind(scanId)
    .run();

  return result.success;
}

export type BackfillCollision = {
  scanId: string;
  fromId: string;
  toId: string;
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
        SELECT scan_id, from_id, to_id, scanned_at, event_date
        FROM scan_records
        WHERE event_date != substr(scanned_at, 1, 10)
      `
    )
    .bind()
    .all<{ scan_id: string; from_id: string; to_id: string; scanned_at: string; event_date: string }>();

  const mismatchedRows = auditResult.results;
  const collisions: BackfillCollision[] = [];

  for (const row of mismatchedRows) {
    const derivedDay = row.scanned_at.substring(0, 10);

    const collisionCheck = await db
      .prepare(
        `
          SELECT scan_id
          FROM scan_records
          WHERE from_id = ?1
            AND to_id = ?2
            AND event_date = ?3
            AND scan_id != ?4
          LIMIT 1
        `
      )
      .bind(row.from_id, row.to_id, derivedDay, row.scan_id)
      .first<{ scan_id: string }>();

    if (collisionCheck) {
      collisions.push({
        scanId: row.scan_id,
        fromId: row.from_id,
        toId: row.to_id,
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
          `scan_id=${c.scanId} (from=${c.fromId}, to=${c.toId}) would collide with scan_id=${c.collidingScanId} on derived day ${c.derivedDay}`
      )
      .join("; ");
    throw new Error(
      `Backfill aborted: ${collisions.length} row(s) would violate the unique (from_id, to_id, event_date) constraint. Resolve manually before retrying. Collisions: ${details}`
    );
  }

  for (const row of mismatchedRows) {
    const derivedDay = row.scanned_at.substring(0, 10);
    await db
      .prepare(
        `
        UPDATE scan_records
        SET event_date = ?1, entry_method = ?2
        WHERE scan_id = ?3
      `
    )
      .bind(derivedDay, "qr", row.scan_id)
      .run();
  }

  return {
    mismatchedRows: mismatchedRows.length,
    updatedRows: mismatchedRows.length,
    collisions
  };
}
