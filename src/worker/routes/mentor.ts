import { findPersonById, findPersonBySecretToken } from "../db/people";
import { findMentorScanRecordById, listMentorRecentScans, updateScanRecordNotes } from "../db/scan-records";
import { getCurrentUtcDate } from "../services/event-day";
import { badRequest, json, methodNotAllowed, notFound, notImplemented } from "../services/http";
import { renderMentorQrSvg } from "../services/mentor-qr-svg";
import { fetchAssetWithRedirectFallback, getRolePageAssetPath } from "../services/secret-links";
import { isValidNotes } from "../validation/scan-records";
import type { Env } from "../types";

export function handleMentorPage(request: Request, env: Env): Promise<Response> {
  return fetchAssetWithRedirectFallback(request, env.ASSETS, getRolePageAssetPath("mentor"));
}

export async function handleMentorApi(request: Request, env: Env, secretToken: string): Promise<Response> {
  const pathname = new URL(request.url).pathname;
  const apiPath = pathname.replace(`/mentor/${secretToken}/api`, "") || "/";

  if (apiPath === "/me") {
    if (request.method !== "GET") {
      return methodNotAllowed(["GET"]);
    }

      const mentor = await findPersonBySecretToken(env.DB, "mentor", secretToken);

      if (!mentor) {
        return notFound();
      }

      const qrPayload = `absenqr:v1:mentor:${mentor.person_id}`;

      return json({
        mentor: {
          personId: mentor.person_id,
          displayName: mentor.display_name,
          secretId: mentor.secret_id
        },
        qrPayload,
        qrSvg: renderMentorQrSvg(qrPayload)
      });
  }

  if (apiPath === "/recent-scans") {
    if (request.method !== "GET") {
      return methodNotAllowed(["GET"]);
    }

    const currentUtcDate = getCurrentUtcDate();

    const mentor = await findPersonBySecretToken(env.DB, "mentor", secretToken);

    if (!mentor) {
      return notFound();
    }

    const recentScans = await listMentorRecentScans(env.DB, mentor.person_id, currentUtcDate);
    const recentScanEntries = await Promise.all(
      recentScans.map(async (scanRecord) => {
        const student = await findPersonById(env.DB, "student", scanRecord.student_id);

        return {
          scanId: scanRecord.scan_id,
          studentId: scanRecord.student_id,
          studentName: student?.display_name ?? "Student",
          scannedAt: scanRecord.scanned_at,
          entryMethod: scanRecord.entry_method,
          notes: scanRecord.notes
        };
      })
    );

    return json({ recentScans: recentScanEntries });
  }

  if (apiPath.startsWith("/notes/")) {
    if (request.method !== "POST") {
      return methodNotAllowed(["POST"]);
    }

    const mentor = await findPersonBySecretToken(env.DB, "mentor", secretToken);

    if (!mentor) {
      return notFound();
    }

    const scanId = apiPath.slice("/notes/".length);

    if (!scanId) {
      return notFound();
    }

    let requestBody: unknown;

    try {
      requestBody = await request.json();
    } catch (error) {
      return badRequest(error instanceof Error ? error.message : "Invalid note request body.");
    }

    const notes =
      typeof requestBody === "object" && requestBody !== null && "notes" in requestBody ? requestBody.notes : null;

    if (typeof notes !== "string" || !isValidNotes(notes)) {
      return badRequest("Invalid mentor notes.");
    }

    const existingRecord = await findMentorScanRecordById(env.DB, mentor.person_id, scanId);

    if (!existingRecord) {
      return notFound();
    }

    const updatedRecord = await updateScanRecordNotes(
      env.DB,
      mentor.person_id,
      scanId,
      notes,
      new Date().toISOString()
    );

    if (!updatedRecord) {
      return notFound();
    }

    return json({
      scan: {
        scanId: updatedRecord.scan_id,
        notes: updatedRecord.notes
      }
    });
  }

  return notImplemented("mentor api route placeholder", { secretToken, apiPath });
}
