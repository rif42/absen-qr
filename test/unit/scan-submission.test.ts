import { describe, expect, it } from "vitest";

import { submitScan } from "../../src/worker/services/scan-submission";
import { createMockD1Database, readMockD1State } from "../support/mock-d1";
import { REAL_STUDENTS, REAL_MENTORS } from "../support/real-roster";

const [student1, student2] = REAL_STUDENTS;
const [mentor1, mentor2] = REAL_MENTORS;

describe("submitScan", () => {
  it("allows a student to scan a mentor", async () => {
    const db = createMockD1Database();

    const result = await submitScan(
      db,
      student1,
      `absenqr:v1:mentor:${mentor1.person_id}`
    );

    expect(result).not.toBeInstanceOf(Response);

    const successResult = result as Exclude<typeof result, Response>;
    expect(successResult.scan.fromId).toBe(student1.person_id);
    expect(successResult.scan.toId).toBe(mentor1.person_id);
    expect(successResult.scan.fromRole).toBe("student");
    expect(successResult.scan.toRole).toBe("mentor");
    expect(successResult.scannedPerson.personId).toBe(mentor1.person_id);
    expect(successResult.scannedPerson.displayName).toBe(mentor1.display_name);

    const state = readMockD1State(db);
    expect(state.scanRecords).toHaveLength(1);
    expect(state.scanRecords[0].from_id).toBe(student1.person_id);
    expect(state.scanRecords[0].to_id).toBe(mentor1.person_id);
    expect(state.scanRecords[0].from_role).toBe("student");
    expect(state.scanRecords[0].to_role).toBe("mentor");
  });

  it("allows a mentor to scan a student", async () => {
    const db = createMockD1Database();

    const result = await submitScan(
      db,
      mentor1,
      `absenqr:v1:student:${student1.person_id}`
    );

    expect(result).not.toBeInstanceOf(Response);

    const successResult = result as Exclude<typeof result, Response>;
    expect(successResult.scan.fromId).toBe(mentor1.person_id);
    expect(successResult.scan.toId).toBe(student1.person_id);
    expect(successResult.scan.fromRole).toBe("mentor");
    expect(successResult.scan.toRole).toBe("student");
    expect(successResult.scannedPerson.personId).toBe(student1.person_id);
    expect(successResult.scannedPerson.displayName).toBe(student1.display_name);

    const state = readMockD1State(db);
    expect(state.scanRecords).toHaveLength(1);
    expect(state.scanRecords[0].from_id).toBe(mentor1.person_id);
    expect(state.scanRecords[0].to_id).toBe(student1.person_id);
    expect(state.scanRecords[0].from_role).toBe("mentor");
    expect(state.scanRecords[0].to_role).toBe("student");
  });

  it("allows same-role scan (student scanning student)", async () => {
    const db = createMockD1Database();

    const result = await submitScan(
      db,
      student1,
      `absenqr:v1:student:${student2.person_id}`
    );

    expect(result).not.toBeInstanceOf(Response);

    const successResult = result as Exclude<typeof result, Response>;
    expect(successResult.scan.fromId).toBe(student1.person_id);
    expect(successResult.scan.toId).toBe(student2.person_id);
    expect(successResult.scan.fromRole).toBe("student");
    expect(successResult.scan.toRole).toBe("student");

    const state = readMockD1State(db);
    expect(state.scanRecords).toHaveLength(1);
  });

  it("allows same-role scan (mentor scanning mentor)", async () => {
    const db = createMockD1Database();

    const result = await submitScan(
      db,
      mentor1,
      `absenqr:v1:mentor:${mentor2.person_id}`
    );

    expect(result).not.toBeInstanceOf(Response);

    const successResult = result as Exclude<typeof result, Response>;
    expect(successResult.scan.fromId).toBe(mentor1.person_id);
    expect(successResult.scan.toId).toBe(mentor2.person_id);
    expect(successResult.scan.fromRole).toBe("mentor");
    expect(successResult.scan.toRole).toBe("mentor");

    const state = readMockD1State(db);
    expect(state.scanRecords).toHaveLength(1);
  });

  it("rejects self-scan", async () => {
    const db = createMockD1Database();

    const result = await submitScan(
      db,
      student1,
      `absenqr:v1:mentor:${student1.person_id}`
    );

    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Self-scan not allowed" });

    const state = readMockD1State(db);
    expect(state.scanRecords).toHaveLength(0);
  });

  it("rejects invalid QR payload", async () => {
    const db = createMockD1Database();

    const result = await submitScan(db, student1, "not-a-valid-payload");

    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid QR payload." });

    const state = readMockD1State(db);
    expect(state.scanRecords).toHaveLength(0);
  });

  it("rejects when scanned person is not found", async () => {
    const db = createMockD1Database();

    const result = await submitScan(
      db,
      student1,
      "absenqr:v1:mentor:nonexistent-mentor-id"
    );

    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid QR payload." });

    const state = readMockD1State(db);
    expect(state.scanRecords).toHaveLength(0);
  });

  it("rejects duplicate scan on the same day", async () => {
    const scannedAt = new Date().toISOString();
    const eventDate = scannedAt.slice(0, 10);

    const db = createMockD1Database({
      scanRecords: [
        {
          scan_id: "existing-scan-id",
          from_id: student1.person_id,
          to_id: mentor1.person_id,
          from_role: "student",
          to_role: "mentor",
          event_date: eventDate,
          scanned_at: scannedAt,
          entry_method: "qr",
          notes: "",
          updated_at: scannedAt
        }
      ]
    });

    const result = await submitScan(
      db,
      student1,
      `absenqr:v1:mentor:${mentor1.person_id}`
    );

    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Already scanned today." });

    const state = readMockD1State(db);
    expect(state.scanRecords).toHaveLength(1);
  });

  it("rejects duplicate scan when unique constraint fails during insert", async () => {
    const db = createMockD1Database({
      insertScanRecordErrorMessage:
        "UNIQUE constraint failed: scan_records.from_id, scan_records.to_id, scan_records.event_date"
    });

    const result = await submitScan(
      db,
      student1,
      `absenqr:v1:mentor:${mentor1.person_id}`
    );

    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Already scanned today." });
  });

  it("returns 500 when an unexpected error occurs during insert", async () => {
    const db = createMockD1Database({
      insertScanRecordErrorMessage: "Some unexpected database error"
    });

    const result = await submitScan(
      db,
      student1,
      `absenqr:v1:mentor:${mentor1.person_id}`
    );

    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Could not create scan record." });
  });
});
