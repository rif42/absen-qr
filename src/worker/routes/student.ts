import { findPersonById, findPersonBySecretToken } from "../db/people";
import {
  consumeFallbackCode,
  getFallbackCodeByValue
} from "../db/fallback-codes";
import {
  createScanRecord,
  findStudentMentorScanRecordByEventDate,
  isDuplicateScanRecordError,
  listStudentHistory
} from "../db/scan-records";
import { getCurrentUtcDate, getUtcDayKey } from "../services/event-day";
import { badRequest, conflict, internalServerError, json, methodNotAllowed, notFound, notImplemented } from "../services/http";
import { parseMentorQrPayload } from "../services/mentor-qr";
import { fetchAssetWithRedirectFallback, getRolePageAssetPath } from "../services/secret-links";
import type { Env } from "../types";

export function handleStudentPage(request: Request, env: Env): Promise<Response> {
  return fetchAssetWithRedirectFallback(request, env.ASSETS, getRolePageAssetPath("student"));
}

// Throttling for fallback code redemption attempts
type ThrottleEntry = { count: number; resetAt: number };
const fallbackCodeThrottle = new Map<string, ThrottleEntry>();

function checkThrottle(secretToken: string): boolean {
  const now = Date.now();
  const entry = fallbackCodeThrottle.get(secretToken);

  if (!entry || now > entry.resetAt) {
    fallbackCodeThrottle.set(secretToken, { count: 1, resetAt: now + 60000 });
    return true;
  }

  if (entry.count >= 5) {
    return false;
  }

  entry.count++;
  return true;
}

// Export for testing - reset throttle state
export function resetFallbackCodeThrottle(): void {
  fallbackCodeThrottle.clear();
}

export async function handleStudentApi(request: Request, env: Env, secretToken: string): Promise<Response> {
  const pathname = new URL(request.url).pathname;
  const apiPath = pathname.replace(`/student/${secretToken}/api`, "") || "/";

  if (apiPath === "/me") {
    if (request.method !== "GET") {
      return methodNotAllowed(["GET"]);
    }

    const student = await findPersonBySecretToken(env.DB, "student", secretToken);

    if (!student) {
      return notFound();
    }

    return json({
      student: {
        personId: student.person_id,
        displayName: student.display_name,
        secretId: student.secret_id
      }
    });
  }

  if (apiPath === "/scan") {
    if (request.method !== "POST") {
      return methodNotAllowed(["POST"]);
    }

    const student = await findPersonBySecretToken(env.DB, "student", secretToken);

    if (!student) {
      return notFound();
    }

    let requestBody: unknown;

    try {
      requestBody = await request.json();
    } catch (error) {
      return badRequest(error instanceof Error ? error.message : "Invalid scan request body.");
    }

    const qrPayload =
      typeof requestBody === "object" && requestBody !== null && "qrPayload" in requestBody
        ? requestBody.qrPayload
        : null;

    if (typeof qrPayload !== "string") {
      return badRequest("Invalid mentor QR payload.");
    }

    const mentorQr = parseMentorQrPayload(qrPayload);

    if (!mentorQr) {
      return badRequest("Invalid mentor QR payload.");
    }

    const mentor = await findPersonById(env.DB, "mentor", mentorQr.mentorId);

    if (!mentor) {
      return badRequest("Invalid mentor QR payload.");
    }

    const scannedAt = new Date().toISOString();
    const eventDate = getUtcDayKey(scannedAt);

    const existingScan = await findStudentMentorScanRecordByEventDate(
      env.DB,
      student.person_id,
      mentor.person_id,
      eventDate
    );

    if (existingScan) {
      return conflict("Duplicate mentor scan already recorded for this calendar day.");
    }

    let scan;

    try {
      scan = await createScanRecord(env.DB, {
        scanId: crypto.randomUUID(),
        studentId: student.person_id,
        mentorId: mentor.person_id,
        eventDate,
        scannedAt
      });
    } catch (error) {
      if (isDuplicateScanRecordError(error)) {
        return conflict("Duplicate mentor scan already recorded for this calendar day.");
      }

      return internalServerError("Could not create scan record.");
    }

    return json(
      {
        scan: {
          scanId: scan.scan_id,
          studentId: scan.student_id,
          mentorId: scan.mentor_id,
          eventDate: scan.event_date,
          scannedAt: scan.scanned_at
        },
        mentor: {
          personId: mentor.person_id,
          displayName: mentor.display_name
        }
      },
      { status: 201 }
    );
  }

  if (apiPath === "/history") {
    if (request.method !== "GET") {
      return methodNotAllowed(["GET"]);
    }

    let currentUtcDate: string;

    try {
      currentUtcDate = getUtcDayKey(new Date());
    } catch {
      return internalServerError("Invalid current date configuration.");
    }

    const student = await findPersonBySecretToken(env.DB, "student", secretToken);

    if (!student) {
      return notFound();
    }

    const history = await listStudentHistory(env.DB, student.person_id, currentUtcDate);
    const historyEntries = await Promise.all(
      history.map(async (scanRecord) => {
        const mentor = await findPersonById(env.DB, "mentor", scanRecord.mentor_id);

        return {
          scanId: scanRecord.scan_id,
          mentorId: scanRecord.mentor_id,
          mentorName: mentor?.display_name ?? "Mentor",
          scannedAt: scanRecord.scanned_at,
          entryMethod: scanRecord.entry_method,
          notes: scanRecord.notes
        };
      })
    );

    return json({ history: historyEntries });
  }

  if (apiPath === "/redeem-code") {
    if (request.method !== "POST") {
      return methodNotAllowed(["POST"]);
    }

    const student = await findPersonBySecretToken(env.DB, "student", secretToken);

    if (!student) {
      return notFound();
    }

    let requestBody: unknown;

    try {
      requestBody = await request.json();
    } catch {
      return badRequest("Invalid or expired fallback code.");
    }

    const rawCode =
      typeof requestBody === "object" && requestBody !== null && "code" in requestBody
        ? requestBody.code
        : null;

    if (typeof rawCode !== "string") {
      if (!checkThrottle(secretToken)) {
        return json(
          { error: "Too many failed redemption attempts. Please wait before trying again." },
          { status: 429 }
        );
      }
      return badRequest("Invalid or expired fallback code.");
    }

    // Strip spaces from code
    const code = rawCode.replace(/\s/g, "");

    // Validate: require exactly 8 numeric digits
    if (!/^\d{8}$/.test(code)) {
      if (!checkThrottle(secretToken)) {
        return json(
          { error: "Too many failed redemption attempts. Please wait before trying again." },
          { status: 429 }
        );
      }
      return badRequest("Invalid or expired fallback code.");
    }

    // Lookup code
    const fallbackCode = await getFallbackCodeByValue(env.DB, code);

    if (!fallbackCode) {
      if (!checkThrottle(secretToken)) {
        return json(
          { error: "Too many failed redemption attempts. Please wait before trying again." },
          { status: 429 }
        );
      }
      return badRequest("Invalid or expired fallback code.");
    }

    // Check active: unconsumed and not expired
    const now = new Date().toISOString();

    if (fallbackCode.consumed_at !== null || fallbackCode.expires_at <= now) {
      if (!checkThrottle(secretToken)) {
        return json(
          { error: "Too many failed redemption attempts. Please wait before trying again." },
          { status: 429 }
        );
      }
      return badRequest("Invalid or expired fallback code.");
    }

    // Check duplicate scan for same day
    const scannedAt = new Date().toISOString();
    const eventDate = getUtcDayKey(scannedAt);

    const existingScan = await findStudentMentorScanRecordByEventDate(
      env.DB,
      student.person_id,
      fallbackCode.mentor_id,
      eventDate
    );

    if (existingScan) {
      return conflict("Duplicate mentor scan already recorded for this calendar day.");
    }

    // Create scan record and consume code atomically
    const scanId = crypto.randomUUID();

    let scan;

    try {
      scan = await createScanRecord(env.DB, {
        scanId,
        studentId: student.person_id,
        mentorId: fallbackCode.mentor_id,
        eventDate,
        scannedAt,
        entryMethod: "fallback_code"
      });
    } catch (error) {
      if (isDuplicateScanRecordError(error)) {
        return conflict("Duplicate mentor scan already recorded for this calendar day.");
      }

      return internalServerError("Could not create scan record.");
    }

    // Atomically consume the code
    await consumeFallbackCode(
      env.DB,
      fallbackCode.fallback_code_id,
      student.person_id,
      scanId
    );

    // Fetch mentor for response
    const mentor = await findPersonById(env.DB, "mentor", fallbackCode.mentor_id);

    return json(
      {
        success: true,
        scan: {
          scanId: scan.scan_id,
          mentorName: mentor?.display_name ?? "Mentor",
          scannedAt: scan.scanned_at
        }
      },
      { status: 201 }
    );
  }

  return notImplemented("student api route placeholder", { secretToken, apiPath });
}
