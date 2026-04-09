import { findPersonById, findPersonBySecretToken } from "../db/people";
import { createScanRecord, isDuplicateScanRecordError, listStudentHistory } from "../db/scan-records";
import { getConfiguredEventDate } from "../services/event-day";
import { badRequest, conflict, internalServerError, json, methodNotAllowed, notFound, notImplemented } from "../services/http";
import { parseMentorQrPayload } from "../services/mentor-qr";
import { fetchAssetWithRedirectFallback, getRolePageAssetPath } from "../services/secret-links";
import type { Env } from "../types";

export function handleStudentPage(request: Request, env: Env): Promise<Response> {
  return fetchAssetWithRedirectFallback(request, env.ASSETS, getRolePageAssetPath("student"));
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

    let currentEventDate: string;

    try {
      currentEventDate = getConfiguredEventDate(env);
    } catch {
      return internalServerError("Invalid EVENT_DATE configuration.");
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

    const existingHistory = await listStudentHistory(env.DB, student.person_id, currentEventDate);

    if (existingHistory.some((scanRecord) => scanRecord.mentor_id === mentor.person_id)) {
      return conflict("Duplicate mentor scan already recorded for this event day.");
    }

    const scannedAt = new Date().toISOString();
    let scan;

    try {
      scan = await createScanRecord(env.DB, {
        scanId: crypto.randomUUID(),
        studentId: student.person_id,
        mentorId: mentor.person_id,
        eventDate: currentEventDate,
        scannedAt
      });
    } catch (error) {
      if (isDuplicateScanRecordError(error)) {
        return conflict("Duplicate mentor scan already recorded for this event day.");
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

    let currentEventDate: string;

    try {
      currentEventDate = getConfiguredEventDate(env);
    } catch {
      return internalServerError("Invalid EVENT_DATE configuration.");
    }

    const student = await findPersonBySecretToken(env.DB, "student", secretToken);

    if (!student) {
      return notFound();
    }

    const history = await listStudentHistory(env.DB, student.person_id, currentEventDate);
    const historyEntries = await Promise.all(
      history.map(async (scanRecord) => {
        const mentor = await findPersonById(env.DB, "mentor", scanRecord.mentor_id);

        return {
          scanId: scanRecord.scan_id,
          mentorId: scanRecord.mentor_id,
          mentorName: mentor?.display_name ?? "Mentor",
          scannedAt: scanRecord.scanned_at,
          notes: scanRecord.notes
        };
      })
    );

    return json({ history: historyEntries });
  }

  return notImplemented("student api route placeholder", { secretToken, apiPath });
}
