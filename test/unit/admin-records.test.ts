import { describe, expect, it } from "vitest";

import {
  findAdminRecordById,
  getAdminRecordsPayload,
  listAdminExportRows
} from "../../src/worker/db/admin-records";
import { createMockD1Database } from "../support/mock-d1";

const configuredEventDate = "2026-01-15";

function createAdminMockDatabase(): D1Database {
  return createMockD1Database({
    scanRecords: [
      {
        scan_id: "scan-admin-alpha",
        student_id: "student-001",
        mentor_id: "mentor-001",
        event_date: configuredEventDate,
        scanned_at: `${configuredEventDate}T09:00:00.000Z`,
        notes: "Alpha note",
        updated_at: `${configuredEventDate}T09:05:00.000Z`
      },
      {
        scan_id: "scan-admin-zeta",
        student_id: "student-002",
        mentor_id: "mentor-002",
        event_date: configuredEventDate,
        scanned_at: `${configuredEventDate}T09:00:00.000Z`,
        notes: "Zeta note",
        updated_at: `${configuredEventDate}T09:10:00.000Z`
      },
      {
        scan_id: "scan-admin-other-day",
        student_id: "student-003",
        mentor_id: "mentor-003",
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
    const payload = await getAdminRecordsPayload(createAdminMockDatabase(), configuredEventDate);

    expect(payload).toEqual({
      eventDate: configuredEventDate,
      records: [
        {
          scanId: "scan-admin-zeta",
          studentId: "student-002",
          studentName: "Student Local 02",
          studentSecretId: "student-secret-002",
          mentorId: "mentor-002",
          mentorName: "Mentor Local 02",
          eventDate: configuredEventDate,
          scannedAt: `${configuredEventDate}T09:00:00.000Z`,
          notes: "Zeta note",
          updatedAt: `${configuredEventDate}T09:10:00.000Z`
        },
        {
          scanId: "scan-admin-alpha",
          studentId: "student-001",
          studentName: "Student Local 01",
          studentSecretId: "student-secret-001",
          mentorId: "mentor-001",
          mentorName: "Mentor Local 01",
          eventDate: configuredEventDate,
          scannedAt: `${configuredEventDate}T09:00:00.000Z`,
          notes: "Alpha note",
          updatedAt: `${configuredEventDate}T09:05:00.000Z`
        }
      ],
      students: [
        { personId: "student-001", displayName: "Student Local 01" },
        { personId: "student-002", displayName: "Student Local 02" },
        { personId: "student-003", displayName: "Student Local 03" },
        { personId: "student-004", displayName: "Student Local 04" },
        { personId: "student-005", displayName: "Student Local 05" }
      ],
      mentors: [
        { personId: "mentor-001", displayName: "Mentor Local 01" },
        { personId: "mentor-002", displayName: "Mentor Local 02" },
        { personId: "mentor-003", displayName: "Mentor Local 03" },
        { personId: "mentor-004", displayName: "Mentor Local 04" },
        { personId: "mentor-005", displayName: "Mentor Local 05" }
      ]
    });

    expect(JSON.stringify(payload)).not.toContain("secret_path_token");
    expect(payload.students[0]).not.toHaveProperty("secretPathToken");
    expect(payload.mentors[0]).not.toHaveProperty("secretPathToken");
  });

  it("finds one admin record by scan id using the locked table shape", async () => {
    const record = await findAdminRecordById(createAdminMockDatabase(), "scan-admin-alpha");

    expect(record).toEqual({
      scanId: "scan-admin-alpha",
      studentId: "student-001",
      studentName: "Student Local 01",
      studentSecretId: "student-secret-001",
      mentorId: "mentor-001",
      mentorName: "Mentor Local 01",
      eventDate: configuredEventDate,
      scannedAt: `${configuredEventDate}T09:00:00.000Z`,
      notes: "Alpha note",
      updatedAt: `${configuredEventDate}T09:05:00.000Z`
    });

    await expect(findAdminRecordById(createAdminMockDatabase(), "missing-scan")).resolves.toBeNull();
  });

  it("returns export rows in chronological order with the fixed field set", async () => {
    const rows = await listAdminExportRows(createAdminMockDatabase(), configuredEventDate);

    expect(rows).toEqual([
      {
        studentName: "Student Local 01",
        studentSecretId: "student-secret-001",
        mentorName: "Mentor Local 01",
        eventDate: configuredEventDate,
        notes: "Alpha note"
      },
      {
        studentName: "Student Local 02",
        studentSecretId: "student-secret-002",
        mentorName: "Mentor Local 02",
        eventDate: configuredEventDate,
        notes: "Zeta note"
      }
    ]);
  });
});
