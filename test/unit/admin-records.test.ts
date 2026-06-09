import { describe, expect, it } from "vitest";

import {
  findAdminRecordById,
  getAdminRecordsPayload,
  listAdminExportRows
} from "../../src/worker/db/admin-records";
import { createMockD1Database } from "../support/mock-d1";
import {
  REAL_MENTORS,
  REAL_MENTORS_BY_NAME,
  REAL_STUDENTS,
  REAL_STUDENTS_BY_NAME
} from "../support/real-roster";

const configuredEventDate = "2026-01-15";
const rangeStartDate = "2026-01-14";
const rangeEndDate = "2026-01-15";
const [student1, student2, student3] = REAL_STUDENTS;
const [mentor1, mentor2, mentor3] = REAL_MENTORS;

function createAdminMockDatabase(): D1Database {
  return createMockD1Database({
    scanRecords: [
      {
        scan_id: "scan-admin-early",
        from_id: student3.person_id,
        to_id: mentor3.person_id,
        from_role: "student",
        to_role: "mentor",
        event_date: rangeStartDate,
        scanned_at: `${rangeStartDate}T08:00:00.000Z`,
        notes: "Early note",
        updated_at: `${rangeStartDate}T08:05:00.000Z`
      },
      {
        scan_id: "scan-admin-alpha",
        from_id: student1.person_id,
        to_id: mentor1.person_id,
        from_role: "student",
        to_role: "mentor",
        event_date: rangeEndDate,
        scanned_at: `${rangeEndDate}T09:00:00.000Z`,
        notes: "Alpha note",
        updated_at: `${rangeEndDate}T09:05:00.000Z`
      },
      {
        scan_id: "scan-admin-zeta",
        from_id: student2.person_id,
        to_id: mentor2.person_id,
        from_role: "student",
        to_role: "mentor",
        event_date: rangeEndDate,
        scanned_at: `${rangeEndDate}T09:00:00.000Z`,
        notes: "Zeta note",
        updated_at: `${rangeEndDate}T09:10:00.000Z`
      },
      {
        scan_id: "scan-admin-other-day",
        from_id: student3.person_id,
        to_id: mentor3.person_id,
        from_role: "student",
        to_role: "mentor",
        event_date: "2099-01-01",
        scanned_at: "2099-01-01T10:00:00.000Z",
        notes: "Ignore me",
        updated_at: "2099-01-01T10:00:00.000Z"
      }
    ]
  });
}

describe("admin records data layer", () => {
  it("returns the locked admin payload contract without secret tokens", async () => {
    const payload = await getAdminRecordsPayload(createAdminMockDatabase(), rangeStartDate, rangeEndDate);

    expect(payload).toMatchObject({
      startDate: rangeStartDate,
      endDate: rangeEndDate,
      records: [
        {
          scanId: "scan-admin-zeta",
          fromId: student2.person_id,
          fromName: student2.display_name,
          fromRole: "student",
          toId: mentor2.person_id,
          toName: mentor2.display_name,
          toRole: "mentor",
          eventDate: rangeEndDate,
          scannedAt: `${rangeEndDate}T09:00:00.000Z`,
          notes: "Zeta note",
          updatedAt: `${rangeEndDate}T09:10:00.000Z`
        },
        {
          scanId: "scan-admin-alpha",
          fromId: student1.person_id,
          fromName: student1.display_name,
          fromRole: "student",
          toId: mentor1.person_id,
          toName: mentor1.display_name,
          toRole: "mentor",
          eventDate: rangeEndDate,
          scannedAt: `${rangeEndDate}T09:00:00.000Z`,
          notes: "Alpha note",
          updatedAt: `${rangeEndDate}T09:05:00.000Z`
        },
        {
          scanId: "scan-admin-early",
          fromId: student3.person_id,
          fromName: student3.display_name,
          fromRole: "student",
          toId: mentor3.person_id,
          toName: mentor3.display_name,
          toRole: "mentor",
          eventDate: rangeStartDate,
          scannedAt: `${rangeStartDate}T08:00:00.000Z`,
          notes: "Early note",
          updatedAt: `${rangeStartDate}T08:05:00.000Z`
        }
      ],
      students: REAL_STUDENTS_BY_NAME.map(({ person_id, display_name }) => ({
        personId: person_id,
        displayName: display_name
      })),
      mentors: REAL_MENTORS_BY_NAME.map(({ person_id, display_name }) => ({
        personId: person_id,
        displayName: display_name
      }))
    });

    expect(JSON.stringify(payload)).not.toContain("secret_path_token");
    expect(payload.students[0]).not.toHaveProperty("secretPathToken");
    expect(payload.mentors[0]).not.toHaveProperty("secretPathToken");
  });

  it("finds one admin record by scan id using the locked table shape", async () => {
    const record = await findAdminRecordById(createAdminMockDatabase(), "scan-admin-alpha");

    expect(record).toMatchObject({
      scanId: "scan-admin-alpha",
      fromId: student1.person_id,
      fromName: student1.display_name,
      fromRole: "student",
      toId: mentor1.person_id,
      toName: mentor1.display_name,
      toRole: "mentor",
      eventDate: configuredEventDate,
      scannedAt: `${configuredEventDate}T09:00:00.000Z`,
      notes: "Alpha note",
      updatedAt: `${configuredEventDate}T09:05:00.000Z`
    });

    await expect(findAdminRecordById(createAdminMockDatabase(), "missing-scan")).resolves.toBeNull();
  });

  it("returns export rows in chronological order with the fixed field set", async () => {
    const rows = await listAdminExportRows(createAdminMockDatabase(), rangeStartDate, rangeEndDate);

    expect(rows).toMatchObject([
      {
        scannerName: student3.display_name,
        scannerRole: "student",
        scannedName: mentor3.display_name,
        scannedRole: "mentor",
        eventDate: rangeStartDate,
        notes: "Early note"
      },
      {
        scannerName: student1.display_name,
        scannerRole: "student",
        scannedName: mentor1.display_name,
        scannedRole: "mentor",
        eventDate: rangeEndDate,
        notes: "Alpha note"
      },
      {
        scannerName: student2.display_name,
        scannerRole: "student",
        scannedName: mentor2.display_name,
        scannedRole: "mentor",
        eventDate: rangeEndDate,
        notes: "Zeta note"
      }
    ]);
  });
});
