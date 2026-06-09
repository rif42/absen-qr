import { findPersonById } from "../db/people";
import {
  createScanRecord,
  findScanRecordByPairAndDate,
  isDuplicateScanRecordError
} from "../db/scan-records";
import { getUtcDayKey } from "./event-day";
import { badRequest, conflict, internalServerError } from "./http";
import { parseQrPayload } from "./qr-payload";
import type { PersonRecord } from "../types";

export interface ScanSubmissionResult {
  scan: {
    scanId: string;
    fromId: string;
    toId: string;
    fromRole: string;
    toRole: string;
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

  // Reject self-scan
  if (scannerPerson.person_id === scannedPersonId) {
    return badRequest("Self-scan not allowed");
  }

  // Look up scanned person
  const scannedPerson = await findPersonById(db, scannedRole, scannedPersonId);

  if (!scannedPerson) {
    return badRequest("Invalid QR payload.");
  }

  const scannedAt = new Date().toISOString();
  const eventDate = getUtcDayKey(scannedAt);

  const fromId = scannerPerson.person_id;
  const toId = scannedPerson.person_id;

  // Check for duplicate
  const existingScan = await findScanRecordByPairAndDate(
    db,
    fromId,
    toId,
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
      fromId: scannerPerson.person_id,
      toId: scannedPerson.person_id,
      fromRole: scannerPerson.role,
      toRole: scannedRole,
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
      fromId: scan.from_id,
      toId: scan.to_id,
      fromRole: scan.from_role,
      toRole: scan.to_role,
      eventDate: scan.event_date,
      scannedAt: scan.scanned_at
    },
    scannedPerson: {
      personId: scannedPerson.person_id,
      displayName: scannedPerson.display_name
    }
  };
}
