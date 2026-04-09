import type { ScanRecord } from "../types";

export async function listStudentHistory(
  db: D1Database,
  studentId: string,
  eventDate: string
): Promise<ScanRecord[]> {
  const result = await db
    .prepare(
      `
        SELECT scan_id, student_id, mentor_id, event_date, scanned_at, notes, updated_at
        FROM scan_records
        WHERE student_id = ?1 AND event_date = ?2
        ORDER BY scanned_at DESC
      `
    )
    .bind(studentId, eventDate)
    .all<ScanRecord>();

  return result.results;
}

export async function listMentorRecentScans(
  db: D1Database,
  mentorId: string,
  eventDate: string
): Promise<ScanRecord[]> {
  const result = await db
    .prepare(
      `
        SELECT scan_id, student_id, mentor_id, event_date, scanned_at, notes, updated_at
        FROM scan_records
        WHERE mentor_id = ?1 AND event_date = ?2
        ORDER BY scanned_at DESC
      `
    )
    .bind(mentorId, eventDate)
    .all<ScanRecord>();

  return result.results;
}
