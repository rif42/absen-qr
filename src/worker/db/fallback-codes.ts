import type { D1Database } from "@cloudflare/workers-types";

export type MentorFallbackCodeRecord = {
  fallback_code_id: string;
  mentor_id: string;
  code_value: string;
  created_at: string;
  expires_at: string;
  consumed_at: string | null;
  consumed_by_student_id: string | null;
  consumed_scan_id: string | null;
};

export async function createFallbackCode(
  db: D1Database,
  mentorId: string,
  codeValue: string,
  createdAt: string,
  expiresAt: string
): Promise<MentorFallbackCodeRecord> {
  const fallbackCodeId = crypto.randomUUID();

  await db
    .prepare(
      `
      INSERT INTO mentor_fallback_codes (fallback_code_id, mentor_id, code_value, created_at, expires_at, consumed_at, consumed_by_student_id, consumed_scan_id)
      VALUES (?1, ?2, ?3, ?4, ?5, NULL, NULL, NULL)
      `
    )
    .bind(fallbackCodeId, mentorId, codeValue, createdAt, expiresAt)
    .run();

  return {
    fallback_code_id: fallbackCodeId,
    mentor_id: mentorId,
    code_value: codeValue,
    created_at: createdAt,
    expires_at: expiresAt,
    consumed_at: null,
    consumed_by_student_id: null,
    consumed_scan_id: null
  };
}

export async function getActiveFallbackCodeForMentor(
  db: D1Database,
  mentorId: string
): Promise<MentorFallbackCodeRecord | null> {
  const now = new Date().toISOString();

  const result = await db
    .prepare(
      `
      SELECT fallback_code_id, mentor_id, code_value, created_at, expires_at, consumed_at, consumed_by_student_id, consumed_scan_id
      FROM mentor_fallback_codes
      WHERE mentor_id = ?1 AND consumed_at IS NULL AND expires_at > ?2
      LIMIT 1
      `
    )
    .bind(mentorId, now)
    .first<MentorFallbackCodeRecord>();

  return result ?? null;
}

export async function getFallbackCodeByValue(
  db: D1Database,
  codeValue: string
): Promise<MentorFallbackCodeRecord | null> {
  const result = await db
    .prepare(
      `
      SELECT fallback_code_id, mentor_id, code_value, created_at, expires_at, consumed_at, consumed_by_student_id, consumed_scan_id
      FROM mentor_fallback_codes
      WHERE code_value = ?1
      LIMIT 1
      `
    )
    .bind(codeValue)
    .first<MentorFallbackCodeRecord>();

  return result ?? null;
}