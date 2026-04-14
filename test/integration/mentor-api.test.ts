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
      return Promise.resolve(new Response("<html><body>Mentor shell</body></html>"));
    },
    connect(): Socket {
      throw new Error("Socket connections are not used in this test.");
    }
  };
}

function createEnv(
  database = createMockD1Database(),
  overrides: Partial<Pick<WorkerEnv, "ADMIN_SECRET" | "EVENT_DATE">> = {}
): WorkerEnv {
  return {
    ADMIN_SECRET: "local-admin-secret-token",
    EVENT_DATE: "2026-01-15",
    ASSETS: createAssetFetcher(),
    DB: database,
    ...overrides
  } as WorkerEnv;
}

describe("mentor API", () => {
  const configuredEventDate = "2026-01-15";
  const runtimeUtcDate = "2026-01-15";
  const nonTodayEventDate = "2026-01-14";

  it("returns the mentor identity and QR payload for a valid mentor secret token", async () => {
    const fetchHandler = worker.fetch as FetchHandler;
    const response = await fetchHandler(
      new Request("https://example.com/mentor/local-mentor-token-001/api/me") as WorkerRequest,
      createEnv(),
      {} as WorkerContext
    );

    expect(response.status).toBe(200);
    const responseBody = (await response.json()) as Record<string, unknown>;

    expect(responseBody).toMatchObject({
      mentor: {
        personId: "mentor-001",
        displayName: "Mentor Local 01",
        secretId: "mentor-secret-001"
      },
      qrPayload: "absenqr:v1:mentor:mentor-001"
    });
    expect(responseBody.qrSvg).toContain("<svg");
    expect(responseBody.qrSvg).toContain("</svg>");
  });

  it("rejects a mentor route whose secret token belongs to another role", async () => {
    const fetchHandler = worker.fetch as FetchHandler;
    const response = await fetchHandler(
      new Request("https://example.com/mentor/local-student-token-001/api/me") as WorkerRequest,
      createEnv(),
      {} as WorkerContext
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Not found" });
  });

  describe("recent scans", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns mentor recent scans for the current runtime UTC day with student names newest first", async () => {
      const database = createMockD1Database({
        scanRecords: [
          {
            scan_id: "scan-mentor-1",
            student_id: "student-001",
            mentor_id: "mentor-001",
            event_date: nonTodayEventDate,
            scanned_at: `${runtimeUtcDate}T08:00:00.000Z`,
            notes: "First note",
            updated_at: `${runtimeUtcDate}T08:00:00.000Z`
          },
          {
            scan_id: "scan-mentor-2",
            student_id: "student-002",
            mentor_id: "mentor-001",
            event_date: nonTodayEventDate,
            scanned_at: `${runtimeUtcDate}T09:00:00.000Z`,
            notes: "Second note",
            updated_at: `${runtimeUtcDate}T09:00:00.000Z`
          },
          {
            scan_id: "scan-other-mentor",
            student_id: "student-003",
            mentor_id: "mentor-002",
            event_date: nonTodayEventDate,
            scanned_at: `${runtimeUtcDate}T10:00:00.000Z`,
            notes: "Other mentor",
            updated_at: `${runtimeUtcDate}T10:00:00.000Z`
          },
          {
            scan_id: "scan-other-day",
            student_id: "student-004",
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
        new Request("https://example.com/mentor/local-mentor-token-001/api/recent-scans") as WorkerRequest,
        createEnv(database, { EVENT_DATE: nonTodayEventDate }),
        {} as WorkerContext
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        recentScans: [
          {
            scanId: "scan-mentor-2",
            studentId: "student-002",
            studentName: "Student Local 02",
            scannedAt: `${runtimeUtcDate}T09:00:00.000Z`,
            notes: "Second note"
          },
          {
            scanId: "scan-mentor-1",
            studentId: "student-001",
            studentName: "Student Local 01",
            scannedAt: `${runtimeUtcDate}T08:00:00.000Z`,
            notes: "First note"
          }
        ]
      });
    });

    it("returns an empty recent scan list when the mentor only has non-today scans", async () => {
      const database = createMockD1Database({
        scanRecords: [
          {
            scan_id: "scan-old-mentor-1",
            student_id: "student-001",
            mentor_id: "mentor-001",
            event_date: nonTodayEventDate,
            scanned_at: `${nonTodayEventDate}T08:00:00.000Z`,
            notes: "Old note 1",
            updated_at: `${nonTodayEventDate}T08:00:00.000Z`
          },
          {
            scan_id: "scan-old-mentor-2",
            student_id: "student-002",
            mentor_id: "mentor-001",
            event_date: nonTodayEventDate,
            scanned_at: `${nonTodayEventDate}T09:00:00.000Z`,
            notes: "Old note 2",
            updated_at: `${nonTodayEventDate}T09:00:00.000Z`
          }
        ]
      });
      const fetchHandler = worker.fetch as FetchHandler;
      const response = await fetchHandler(
        new Request("https://example.com/mentor/local-mentor-token-001/api/recent-scans") as WorkerRequest,
        createEnv(database, { EVENT_DATE: nonTodayEventDate }),
        {} as WorkerContext
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        recentScans: []
      });
    });
  });

  it("saves mentor notes to a scan owned by that mentor", async () => {
    const database = createMockD1Database({
      scanRecords: [
        {
          scan_id: "scan-note-target",
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
      new Request("https://example.com/mentor/local-mentor-token-001/api/notes/scan-note-target", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          notes: "Student asked about next steps."
        })
      }) as WorkerRequest,
      createEnv(database),
      {} as WorkerContext
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      scan: {
        scanId: "scan-note-target",
        notes: "Student asked about next steps."
      }
    });

    expect(readMockD1State(database).scanRecords[0]).toMatchObject({
      scan_id: "scan-note-target",
      notes: "Student asked about next steps."
    });
  });

  it("rejects note updates for scans that belong to another mentor", async () => {
    const database = createMockD1Database({
      scanRecords: [
        {
          scan_id: "scan-other-mentor-note",
          student_id: "student-001",
          mentor_id: "mentor-002",
          event_date: configuredEventDate,
          scanned_at: `${configuredEventDate}T08:00:00.000Z`,
          notes: "",
          updated_at: `${configuredEventDate}T08:00:00.000Z`
        }
      ]
    });
    const fetchHandler = worker.fetch as FetchHandler;
    const response = await fetchHandler(
      new Request("https://example.com/mentor/local-mentor-token-001/api/notes/scan-other-mentor-note", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          notes: "Should not save"
        })
      }) as WorkerRequest,
      createEnv(database),
      {} as WorkerContext
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Not found" });
    expect(readMockD1State(database).scanRecords[0].notes).toBe("");
  });
});
