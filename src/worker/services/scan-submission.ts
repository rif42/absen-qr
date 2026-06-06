import { findPersonById } from "../db/people";
import {
  createScanRecord,
  findStudentMentorScanRecordByEventDate,
  isDuplicateScanRecordError
} from "../db/scan-records";
import { getUtcDayKey } from "./event-day";
import { badRequest, conflict, internalServerError } from "./http";
import { parseQrPayload } from "./qr-payload";
import type { PersonRecord } from "../types";

export interface ScanSubmissionResult {
  scan: {
    scanId: string;
    studentId: string;
    mentorId: string;
    eventDate: string;
    scannedAt: string;
  };
  scannedPerson: {
    personId: string;
    displayName: string;
  };
}

export async function submitScan(
  db: D1Database,
  scannerPerson: PersonRecord,
  qrPayload: string
): Promise<ScanSubmissionResult | Response> {
  const parsed = parseQrPayload(qrPayload);

  if (!parsed) {
    return badRequest("Invalid QR payload.");
  }

  const { role: scannedRole, personId: scannedPersonId } = parsed;

  // Reject same role
  if (scannerPerson.role === scannedRole) {
    return badRequest("You can only scan the opposite role.");
  }

  // Reject self-scan
  if (scannerPerson.person_id === scannedPersonId) {
    return badRequest("You cannot scan yourself.");
  }

  // Look up scanned person
  const scannedPerson = await findPersonById(db, scannedRole, scannedPersonId);

  if (!scannedPerson) {
    return badRequest("Invalid QR payload.");
  }

  // Determine student and mentor IDs
  const studentId = scannerPerson.role === "student" ? scannerPerson.person_id : scannedPerson.person_id;
  const mentorId = scannerPerson.role === "mentor" ? scannerPerson.person_id : scannedPerson.person_id;

  const scannedAt = new Date().toISOString();
  const eventDate = getUtcDayKey(scannedAt);

  // Check for duplicate
  const existingScan = await findStudentMentorScanRecordByEventDate(
    db,
    studentId,
    mentorId,
    eventDate
  );

  if (existingScan) {
    return conflict("Already scanned today.");
  }

  // Create scan record
  let scan;

  try {
    scan = await createScanRecord(db, {
      scanId: crypto.randomUUID(),
      studentId,
      mentorId,
      eventDate,
      scannedAt
    });
  } catch (error) {
    if (isDuplicateScanRecordError(error)) {
      return conflict("Already scanned today.");
    }
    return internalServerError("Could not create scan record.");
  }

  return {
    scan: {
      scanId: scan.scan_id,
      studentId: scan.student_id,
      mentorId: scan.mentor_id,
      eventDate: scan.event_date,
      scannedAt: scan.scanned_at
    },
    scannedPerson: {
      personId: scannedPerson.person_id,
      displayName: scannedPerson.display_name
    }
  };
}
