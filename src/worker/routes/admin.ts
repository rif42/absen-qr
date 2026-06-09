import { deleteAdminRecord, findAdminRecordById, getAdminRecordsPayload, listAdminExportRows, updateAdminRecord } from "../db/admin-records";
import { findPersonById } from "../db/people";
import { isDuplicateScanRecordError } from "../db/scan-records";
import { getCurrentUtcDate } from "../services/event-day";
import { fetchAssetWithRedirectFallback, getRolePageAssetPath } from "../services/secret-links";
import { badRequest, conflict, forbidden, internalServerError, json, methodNotAllowed, notFound, notImplemented } from "../services/http";
import { isEventDate, isValidNotes } from "../validation/scan-records";
import type { Env } from "../types";

type AdminRecordPatchPayload = {
  notes?: string;
  fromId?: string;
  toId?: string;
  fromRole?: "student" | "mentor";
  toRole?: "student" | "mentor";
};

const DUPLICATE_SCAN_ERROR_MESSAGE = "Duplicate mentor scan already recorded for this calendar day.";

function isAuthorizedAdminSecret(secretToken: string, env: Env): boolean {
  return secretToken === env.ADMIN_SECRET;
}

function resolveAdminDateRange(request: Request, configuredEventDate: string): { startDate: string; endDate: string } {
  const fallbackRange = {
    startDate: configuredEventDate,
    endDate: configuredEventDate
  };
  const searchParams = new URL(request.url).searchParams;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (startDate === null || endDate === null) {
    return fallbackRange;
  }

  if (!isEventDate(startDate) || !isEventDate(endDate) || startDate > endDate) {
    return fallbackRange;
  }

  return {
    startDate,
    endDate
  };
}

function escapeCsvValue(value: string): string {
  if (!/[",\n\r]/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '""')}"`;
}

function serializeAdminExportCsv(rows: Awaited<ReturnType<typeof listAdminExportRows>>): string {
  const header = "scanner_name,scanner_role,scanned_name,scanned_role,date,notes,entry_method";
  const lines = rows.map((row) =>
    [
      escapeCsvValue(row.scannerName),
      escapeCsvValue(row.scannerRole),
      escapeCsvValue(row.scannedName),
      escapeCsvValue(row.scannedRole),
      escapeCsvValue(row.eventDate),
      escapeCsvValue(row.notes),
      escapeCsvValue(row.entryMethod)
    ].join(",")
  );

  return [header, ...lines].join("\n");
}

function isPatchPayloadRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseAdminRecordPatchPayload(body: unknown): AdminRecordPatchPayload | Response {
  if (!isPatchPayloadRecord(body)) {
    return badRequest("Invalid admin record patch payload.");
  }

  const allowedKeys = new Set(["notes", "fromId", "toId", "fromRole", "toRole"]);
  const bodyKeys = Object.keys(body);

  if (bodyKeys.some((key) => !allowedKeys.has(key))) {
    return badRequest("Invalid admin record patch payload.");
  }

  if (bodyKeys.length === 0) {
    return badRequest("PATCH body must include at least one of notes, fromId, toId, fromRole, or toRole.");
  }

  const payload: AdminRecordPatchPayload = {};

  if ("notes" in body) {
    if (typeof body.notes !== "string" || !isValidNotes(body.notes)) {
      return badRequest("Invalid admin record patch payload.");
    }

    payload.notes = body.notes;
  }

  if ("fromId" in body) {
    if (typeof body.fromId !== "string") {
      return badRequest("Invalid admin record patch payload.");
    }

    payload.fromId = body.fromId;
  }

  if ("toId" in body) {
    if (typeof body.toId !== "string") {
      return badRequest("Invalid admin record patch payload.");
    }

    payload.toId = body.toId;
  }

  if ("fromRole" in body) {
    if (typeof body.fromRole !== "string" || (body.fromRole !== "student" && body.fromRole !== "mentor")) {
      return badRequest("Invalid admin record patch payload.");
    }

    payload.fromRole = body.fromRole;
  }

  if ("toRole" in body) {
    if (typeof body.toRole !== "string" || (body.toRole !== "student" && body.toRole !== "mentor")) {
      return badRequest("Invalid admin record patch payload.");
    }

    payload.toRole = body.toRole;
  }

  return payload;
}

export function handleAdminPage(request: Request, env: Env, secretToken: string): Promise<Response> | Response {
  if (!isAuthorizedAdminSecret(secretToken, env)) {
    return forbidden();
  }

  return fetchAssetWithRedirectFallback(request, env.ASSETS, getRolePageAssetPath("admin"));
}

export async function handleAdminApi(request: Request, env: Env, secretToken: string): Promise<Response> {
  if (!isAuthorizedAdminSecret(secretToken, env)) {
    return forbidden();
  }

  const pathname = new URL(request.url).pathname;
  const apiPath = pathname.replace(`/admin/${secretToken}/api`, "") || "/";

  if (apiPath === "/records") {
    if (request.method !== "GET") {
      return methodNotAllowed(["GET"]);
    }

    let currentUtcDate: string;

    try {
      currentUtcDate = getCurrentUtcDate();
    } catch {
      return internalServerError("Invalid current date configuration.");
    }

    const { startDate, endDate } = resolveAdminDateRange(request, currentUtcDate);
    const recordsPayload = await getAdminRecordsPayload(env.DB, startDate, endDate);

    return json({
      records: recordsPayload.records,
      students: recordsPayload.students,
      mentors: recordsPayload.mentors,
      dateFilter: {
        startDate,
        endDate
      }
    });
  }

  if (apiPath === "/export.csv") {
    if (request.method !== "GET") {
      return methodNotAllowed(["GET"]);
    }

    let currentUtcDate: string;

    try {
      currentUtcDate = getCurrentUtcDate();
    } catch {
      return internalServerError("Invalid current date configuration.");
    }

    const { startDate, endDate } = resolveAdminDateRange(request, currentUtcDate);

    const rows = await listAdminExportRows(env.DB, startDate, endDate);
    const headers = new Headers();
    headers.set("content-type", "text/csv; charset=utf-8");
    headers.set("content-disposition", `attachment; filename="attendance-${currentUtcDate}.csv"`);

    return new Response(serializeAdminExportCsv(rows), {
      status: 200,
      headers
    });
  }

  if (apiPath.startsWith("/records/")) {
    if (request.method === "PATCH") {
      const scanId = apiPath.slice("/records/".length);

      if (!scanId) {
        return notFound();
      }

      let requestBody: unknown;

      try {
        requestBody = await request.json();
      } catch {
        return badRequest("Invalid admin record patch body.");
      }

      const parsedPayload = parseAdminRecordPatchPayload(requestBody);

      if (parsedPayload instanceof Response) {
        return parsedPayload;
      }

      const existingRecord = await findAdminRecordById(env.DB, scanId);

      if (!existingRecord) {
        return notFound();
      }

      if (parsedPayload.fromId !== undefined) {
        if (parsedPayload.fromRole === undefined) {
          return badRequest("fromRole is required when fromId is provided.");
        }

        const fromPerson = await findPersonById(env.DB, parsedPayload.fromRole, parsedPayload.fromId);

        if (!fromPerson) {
          return notFound();
        }
      }

      if (parsedPayload.toId !== undefined) {
        if (parsedPayload.toRole === undefined) {
          return badRequest("toRole is required when toId is provided.");
        }

        const toPerson = await findPersonById(env.DB, parsedPayload.toRole, parsedPayload.toId);

        if (!toPerson) {
          return notFound();
        }
      }

      try {
        const updatedRecord = await updateAdminRecord(env.DB, {
          scanId,
          notes: parsedPayload.notes,
          fromId: parsedPayload.fromId,
          toId: parsedPayload.toId,
          fromRole: parsedPayload.fromRole,
          toRole: parsedPayload.toRole,
          updatedAt: new Date().toISOString()
        });

        if (!updatedRecord) {
          return notFound();
        }

        return json(updatedRecord);
      } catch (error) {
        if (isDuplicateScanRecordError(error)) {
          return conflict(DUPLICATE_SCAN_ERROR_MESSAGE);
        }

        throw error;
      }
    }

    if (request.method === "DELETE") {
      const scanId = apiPath.slice("/records/".length);

      if (!scanId) {
        return notFound();
      }

      if (!(await deleteAdminRecord(env.DB, scanId))) {
        return notFound();
      }

      return json({
        deleted: true,
        scanId
      });
    }

    return methodNotAllowed(["PATCH", "DELETE"]);
  }

  return notImplemented("admin api route placeholder", { apiPath });
}
