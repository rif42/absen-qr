import { findPersonById, findPersonBySecretToken } from "../db/people";
import { createScanRecord } from "../db/scan-records";
import { badRequest, json, methodNotAllowed, notFound, notImplemented } from "../services/http";
import { parseMentorQrPayload } from "../services/mentor-qr";
import { getRolePageAssetPath, rewriteRequestPath } from "../services/secret-links";
import type { Env } from "../types";

export function handleStudentPage(request: Request, env: Env): Promise<Response> {
  return env.ASSETS.fetch(rewriteRequestPath(request, getRolePageAssetPath("student")));
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
    const scan = await createScanRecord(env.DB, {
      scanId: crypto.randomUUID(),
      studentId: student.person_id,
      mentorId: mentor.person_id,
      eventDate: scannedAt.slice(0, 10),
      scannedAt
    });

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

    return notImplemented("GET /student/:secret/api/history", { secretToken });
  }

  return notImplemented("student api route placeholder", { secretToken, apiPath });
}
