import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import worker from "../../src/worker/index";
import { createMockD1Database, readMockD1State } from "../support/mock-d1";

type FetchHandler = NonNullable<typeof worker.fetch>;
type WorkerRequest = Parameters<FetchHandler>[0];
type WorkerEnv = Parameters<FetchHandler>[1];
type WorkerContext = Parameters<FetchHandler>[2];

function createAssetFetcher(): Fetcher {
  return {
    fetch(): Promise<Response> {
      return Promise.resolve(new Response("<html><body>Student shell</body></html>"));
    },
    connect(): Socket {
      throw new Error("Socket connections are not used in this test.");
    }
  };
}

const configuredEventDate = "2026-01-15";

function createEnv(database = createMockD1Database(), eventDate = configuredEventDate): WorkerEnv {
  return {
    ADMIN_SECRET: "local-admin-secret-token",
    EVENT_DATE: eventDate,
    ASSETS: createAssetFetcher(),
    DB: database
  } as WorkerEnv;
}

describe("student API", () => {
  it("returns the student identity for a valid student secret token", async () => {
    const fetchHandler = worker.fetch as FetchHandler;
    const response = await fetchHandler(
      new Request("https://example.com/student/local-student-token-001/api/me") as WorkerRequest,
      createEnv(),
      {} as WorkerContext
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      student: {
        personId: "student-001",
        displayName: "Student Local 01",
        secretId: "student-secret-001"
      }
    });
  });

  it("rejects a student route whose secret token belongs to another role", async () => {
    const fetchHandler = worker.fetch as FetchHandler;
    const response = await fetchHandler(
      new Request("https://example.com/student/local-mentor-token-001/api/me") as WorkerRequest,
      createEnv(),
      {} as WorkerContext
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Not found" });
  });

  it("creates a scan record from a valid mentor QR payload", async () => {
    const database = createMockD1Database();
    const fetchHandler = worker.fetch as FetchHandler;
    const response = await fetchHandler(
      new Request("https://example.com/student/local-student-token-001/api/scan", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          qrPayload: "absenqr:v1:mentor:mentor-001"
        })
      }) as WorkerRequest,
      createEnv(database),
      {} as WorkerContext
    );

    expect(response.status).toBe(201);

    await expect(response.json()).resolves.toMatchObject({
      scan: {
        studentId: "student-001",
        mentorId: "mentor-001",
        eventDate: configuredEventDate
      },
      mentor: {
        personId: "mentor-001",
        displayName: "Mentor Local 01"
      }
    });

    expect(readMockD1State(database).scanRecords).toHaveLength(1);
    expect(readMockD1State(database).scanRecords[0]).toMatchObject({
      student_id: "student-001",
      mentor_id: "mentor-001",
      event_date: configuredEventDate
    });
  });

  it("maps a database uniqueness conflict to the duplicate scan response", async () => {
    const database = createMockD1Database({
      insertScanRecordErrorMessage:
        "UNIQUE constraint failed: scan_records.student_id, scan_records.mentor_id, scan_records.event_date"
    });
    const fetchHandler = worker.fetch as FetchHandler;
    const response = await fetchHandler(
      new Request("https://example.com/student/local-student-token-001/api/scan", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          qrPayload: "absenqr:v1:mentor:mentor-001"
        })
      }) as WorkerRequest,
      createEnv(database),
      {} as WorkerContext
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Duplicate mentor scan already recorded for this event day."
    });
    expect(readMockD1State(database).scanRecords).toHaveLength(0);
  });

  it("rejects an invalid mentor QR payload without writing a record", async () => {
    const database = createMockD1Database();
    const fetchHandler = worker.fetch as FetchHandler;
    const response = await fetchHandler(
      new Request("https://example.com/student/local-student-token-001/api/scan", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          qrPayload: "not-a-mentor-qr"
        })
      }) as WorkerRequest,
      createEnv(database),
      {} as WorkerContext
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid mentor QR payload."
    });
    expect(readMockD1State(database).scanRecords).toHaveLength(0);
  });

  it("rejects a duplicate mentor scan for the same event day", async () => {
    const database = createMockD1Database({
      scanRecords: [
        {
          scan_id: "scan-duplicate-existing",
          student_id: "student-001",
          mentor_id: "mentor-001",
          event_date: configuredEventDate,
          scanned_at: `${configuredEventDate}T08:00:00.000Z`,
          notes: "",
          updated_at: `${configuredEventDate}T08:00:00.000Z`
        }
      ]
    });
    const fetchHandler = worker.fetch as FetchHandler;
    const response = await fetchHandler(
      new Request("https://example.com/student/local-student-token-001/api/scan", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          qrPayload: "absenqr:v1:mentor:mentor-001"
        })
      }) as WorkerRequest,
      createEnv(database),
      {} as WorkerContext
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Duplicate mentor scan already recorded for this event day."
    });
    expect(readMockD1State(database).scanRecords).toHaveLength(1);
  });

  it("rejects a duplicate mentor scan when the existing record was scanned on a different runtime day", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));

    const database = createMockD1Database({
      scanRecords: [
        {
          scan_id: "scan-duplicate-existing-runtime-mismatch",
          student_id: "student-001",
          mentor_id: "mentor-001",
          event_date: "2026-01-14",
          scanned_at: "2026-01-13T08:00:00.000Z",
          notes: "Existing event-day duplicate",
          updated_at: "2026-01-13T08:00:00.000Z"
        }
      ]
    });
    const fetchHandler = worker.fetch as FetchHandler;
    const response = await fetchHandler(
      new Request("https://example.com/student/local-student-token-001/api/scan", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          qrPayload: "absenqr:v1:mentor:mentor-001"
        })
      }) as WorkerRequest,
      createEnv(database, "2026-01-14"),
      {} as WorkerContext
    );

    vi.useRealTimers();

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Duplicate mentor scan already recorded for this event day."
    });
    expect(readMockD1State(database).scanRecords).toHaveLength(1);
  });

  describe("history", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns only the current student's mentor history for the current runtime UTC day", async () => {
      const database = createMockD1Database({
        scanRecords: [
          {
            scan_id: "scan-history-1",
            student_id: "student-001",
            mentor_id: "mentor-001",
            event_date: configuredEventDate,
            scanned_at: `${configuredEventDate}T08:00:00.000Z`,
            notes: "First mentor",
            updated_at: `${configuredEventDate}T08:00:00.000Z`
          },
          {
            scan_id: "scan-history-2",
            student_id: "student-001",
            mentor_id: "mentor-002",
            event_date: configuredEventDate,
            scanned_at: `${configuredEventDate}T09:00:00.000Z`,
            notes: "Second mentor",
            updated_at: `${configuredEventDate}T09:00:00.000Z`
          },
          {
            scan_id: "scan-other-student",
            student_id: "student-002",
            mentor_id: "mentor-001",
            event_date: configuredEventDate,
            scanned_at: `${configuredEventDate}T10:00:00.000Z`,
            notes: "Other student",
            updated_at: `${configuredEventDate}T10:00:00.000Z`
          },
          {
            scan_id: "scan-other-day",
            student_id: "student-001",
            mentor_id: "mentor-001",
            event_date: "2099-01-01",
            scanned_at: "2099-01-01T11:00:00.000Z",
            notes: "Other day",
            updated_at: "2099-01-01T11:00:00.000Z"
          }
        ]
      });
      const fetchHandler = worker.fetch as FetchHandler;
      const response = await fetchHandler(
        new Request("https://example.com/student/local-student-token-001/api/history") as WorkerRequest,
        createEnv(database, "2026-01-14"),
        {} as WorkerContext
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        history: [
          {
            scanId: "scan-history-2",
            mentorId: "mentor-002",
            mentorName: "Mentor Local 02",
            scannedAt: `${configuredEventDate}T09:00:00.000Z`,
            notes: "Second mentor"
          },
          {
            scanId: "scan-history-1",
            mentorId: "mentor-001",
            mentorName: "Mentor Local 01",
            scannedAt: `${configuredEventDate}T08:00:00.000Z`,
            notes: "First mentor"
          }
        ]
      });
    });

    it("returns an empty history when the student only has non-today scans", async () => {
      const database = createMockD1Database({
        scanRecords: [
          {
            scan_id: "scan-old-1",
            student_id: "student-001",
            mentor_id: "mentor-001",
            event_date: "2026-01-14",
            scanned_at: "2026-01-14T08:00:00.000Z",
            notes: "Old mentor 1",
            updated_at: "2026-01-14T08:00:00.000Z"
          },
          {
            scan_id: "scan-old-2",
            student_id: "student-001",
            mentor_id: "mentor-002",
            event_date: "2026-01-13",
            scanned_at: "2026-01-13T09:00:00.000Z",
            notes: "Old mentor 2",
            updated_at: "2026-01-13T09:00:00.000Z"
          },
          {
            scan_id: "scan-other-student-today",
            student_id: "student-002",
            mentor_id: "mentor-001",
            event_date: configuredEventDate,
            scanned_at: `${configuredEventDate}T10:00:00.000Z`,
            notes: "Other student today",
            updated_at: `${configuredEventDate}T10:00:00.000Z`
          }
        ]
      });
      const fetchHandler = worker.fetch as FetchHandler;
      const response = await fetchHandler(
        new Request("https://example.com/student/local-student-token-001/api/history") as WorkerRequest,
        createEnv(database, "2026-01-14"),
        {} as WorkerContext
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        history: []
      });
    });
  });
});
