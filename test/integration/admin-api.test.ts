import { describe, expect, it, vi } from "vitest";

import worker from "../../src/worker/index";
import { createMockD1Database, readMockD1State } from "../support/mock-d1";

type FetchHandler = NonNullable<typeof worker.fetch>;
type WorkerRequest = Parameters<FetchHandler>[0];
type WorkerEnv = Parameters<FetchHandler>[1];
type WorkerContext = Parameters<FetchHandler>[2];

function createAssetFetcher(): Fetcher {
  return {
    fetch(): Promise<Response> {
      return Promise.resolve(new Response("<html><body>Admin shell</body></html>"));
    },
    connect(): Socket {
      throw new Error("Socket connections are not used in this test.");
    }
  };
}

function createEnv(database = createMockD1Database()): WorkerEnv {
  return {
    ADMIN_SECRET: "local-admin-secret-token",
    EVENT_DATE: "2026-01-15",
    ASSETS: createAssetFetcher(),
    DB: database
  } as WorkerEnv;
}

async function fetchAdminApi(
  path: string,
  init?: RequestInit,
  env: WorkerEnv = createEnv()
): Promise<Response> {
  const fetchHandler = worker.fetch as FetchHandler;

  return fetchHandler(
    new Request(`https://example.com/admin/local-admin-secret-token/api${path}`, init) as WorkerRequest,
    env,
    {} as WorkerContext
  );
}

async function withFrozenTime<T>(isoTimestamp: string, run: () => T | Promise<T>): Promise<T> {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(isoTimestamp));

  try {
    return await run();
  } finally {
    vi.useRealTimers();
  }
}

async function expectLatestAdminRecord(response: Response, expected: {
  scanId: string;
  studentId: string;
  studentName: string;
  studentSecretId: string;
  mentorId: string;
  mentorName: string;
  eventDate: string;
  scannedAt: string;
  notes: string;
  updatedAt: string;
}): Promise<void> {
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual(expected);
}

async function expectRecordsAndExportToReflectLatestValues(
  env: WorkerEnv,
  expectedRecord: {
    scanId: string;
    studentId: string;
    studentName: string;
    studentSecretId: string;
    mentorId: string;
    mentorName: string;
    eventDate: string;
    scannedAt: string;
    notes: string;
    updatedAt: string;
  },
  expectedCsvLine: string
): Promise<void> {
  const recordsResponse = await fetchAdminApi("/records", undefined, env);
  expect(recordsResponse.status).toBe(200);
  await expect(recordsResponse.json()).resolves.toMatchObject({
    dateFilter: {
      startDate: expectedRecord.eventDate,
      endDate: expectedRecord.eventDate
    },
    records: [expectedRecord]
  });

  const exportResponse = await fetchAdminApi("/export.csv", undefined, env);
  expect(exportResponse.status).toBe(200);
  await expect(exportResponse.text()).resolves.toContain(expectedCsvLine);
}

async function expectRecordsAndExportToBeEmpty(env: WorkerEnv, eventDate: string): Promise<void> {
  const recordsResponse = await fetchAdminApi("/records", undefined, env);
  expect(recordsResponse.status).toBe(200);
  await expect(recordsResponse.json()).resolves.toMatchObject({
    dateFilter: {
      startDate: eventDate,
      endDate: eventDate
    },
    records: []
  });

  const exportResponse = await fetchAdminApi("/export.csv", undefined, env);
  expect(exportResponse.status).toBe(200);
  await expect(exportResponse.text()).resolves.toBe("student name,secret id,mentor scanned,date,notes");
}

describe("admin API", () => {
  const configuredEventDate = "2026-01-15";

  it("returns the locked admin records payload for a valid admin secret token", async () => {
    const database = createMockD1Database({
      scanRecords: [
        {
          scan_id: "scan-admin-old",
          student_id: "student-001",
          mentor_id: "mentor-001",
          event_date: configuredEventDate,
          scanned_at: `${configuredEventDate}T08:00:00.000Z`,
          notes: "First record",
          updated_at: `${configuredEventDate}T08:05:00.000Z`
        },
        {
          scan_id: "scan-admin-new",
          student_id: "student-002",
          mentor_id: "mentor-002",
          event_date: configuredEventDate,
          scanned_at: `${configuredEventDate}T09:00:00.000Z`,
          notes: "Second record",
          updated_at: `${configuredEventDate}T09:05:00.000Z`
        },
        {
          scan_id: "scan-admin-other-day",
          student_id: "student-003",
          mentor_id: "mentor-003",
          event_date: "2099-01-01",
          scanned_at: "2099-01-01T10:00:00.000Z",
          notes: "Ignore me",
          updated_at: "2099-01-01T10:05:00.000Z"
        }
      ]
    });
    const fetchHandler = worker.fetch as FetchHandler;
    const response = await withFrozenTime(`${configuredEventDate}T12:00:00.000Z`, () =>
      fetchHandler(
        new Request("https://example.com/admin/local-admin-secret-token/api/records") as WorkerRequest,
        createEnv(database),
        {} as WorkerContext
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      dateFilter: {
        startDate: configuredEventDate,
        endDate: configuredEventDate
      },
      records: [
        {
          scanId: "scan-admin-new",
          studentId: "student-002",
          studentName: "Student Local 02",
          studentSecretId: "student-secret-002",
          mentorId: "mentor-002",
          mentorName: "Mentor Local 02",
          eventDate: configuredEventDate,
          scannedAt: `${configuredEventDate}T09:00:00.000Z`,
          notes: "Second record",
          updatedAt: `${configuredEventDate}T09:05:00.000Z`
        },
        {
          scanId: "scan-admin-old",
          studentId: "student-001",
          studentName: "Student Local 01",
          studentSecretId: "student-secret-001",
          mentorId: "mentor-001",
          mentorName: "Mentor Local 01",
          eventDate: configuredEventDate,
          scannedAt: `${configuredEventDate}T08:00:00.000Z`,
          notes: "First record",
          updatedAt: `${configuredEventDate}T08:05:00.000Z`
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
  });

  it("returns ranged admin records and export rows for the same start/end dates", async () => {
    const startDate = "2026-01-14";
    const endDate = configuredEventDate;
    const database = createMockD1Database({
      scanRecords: [
        {
          scan_id: "scan-range-late",
          student_id: "student-002",
          mentor_id: "mentor-002",
          event_date: endDate,
          scanned_at: `${endDate}T09:00:00.000Z`,
          notes: "End range record",
          updated_at: `${endDate}T09:05:00.000Z`
        },
        {
          scan_id: "scan-range-early",
          student_id: "student-001",
          mentor_id: "mentor-001",
          event_date: startDate,
          scanned_at: `${startDate}T08:00:00.000Z`,
          notes: "Start range record",
          updated_at: `${startDate}T08:05:00.000Z`
        },
        {
          scan_id: "scan-range-outside",
          student_id: "student-003",
          mentor_id: "mentor-003",
          event_date: "2026-01-13",
          scanned_at: "2026-01-13T10:00:00.000Z",
          notes: "Outside range",
          updated_at: "2026-01-13T10:05:00.000Z"
        }
      ]
    });
    const env = createEnv(database);

    const recordsResponse = await fetchAdminApi(`/records?startDate=${startDate}&endDate=${endDate}`, undefined, env);

    expect(recordsResponse.status).toBe(200);
    await expect(recordsResponse.json()).resolves.toEqual({
      dateFilter: {
        startDate,
        endDate
      },
      records: [
        {
          scanId: "scan-range-late",
          studentId: "student-002",
          studentName: "Student Local 02",
          studentSecretId: "student-secret-002",
          mentorId: "mentor-002",
          mentorName: "Mentor Local 02",
          eventDate: endDate,
          scannedAt: `${endDate}T09:00:00.000Z`,
          notes: "End range record",
          updatedAt: `${endDate}T09:05:00.000Z`
        },
        {
          scanId: "scan-range-early",
          studentId: "student-001",
          studentName: "Student Local 01",
          studentSecretId: "student-secret-001",
          mentorId: "mentor-001",
          mentorName: "Mentor Local 01",
          eventDate: startDate,
          scannedAt: `${startDate}T08:00:00.000Z`,
          notes: "Start range record",
          updatedAt: `${startDate}T08:05:00.000Z`
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

    const exportResponse = await fetchAdminApi(`/export.csv?startDate=${startDate}&endDate=${endDate}`, undefined, env);

    expect(exportResponse.status).toBe(200);
    await expect(exportResponse.text()).resolves.toBe(
      [
        "student name,secret id,mentor scanned,date,notes",
        "Student Local 01,student-secret-001,Mentor Local 01,2026-01-14,Start range record",
        "Student Local 02,student-secret-002,Mentor Local 02,2026-01-15,End range record"
      ].join("\n")
    );
  });

  it("falls back to the current UTC day when the admin range is partial, malformed, or reversed", async () => {
    const database = createMockD1Database({
      scanRecords: [
        {
          scan_id: "scan-fallback-configured",
          student_id: "student-001",
          mentor_id: "mentor-001",
          event_date: configuredEventDate,
          scanned_at: `${configuredEventDate}T08:00:00.000Z`,
          notes: "Configured day record",
          updated_at: `${configuredEventDate}T08:05:00.000Z`
        },
        {
          scan_id: "scan-fallback-outside",
          student_id: "student-002",
          mentor_id: "mentor-002",
          event_date: "2026-01-14",
          scanned_at: "2026-01-14T09:00:00.000Z",
          notes: "Outside fallback day",
          updated_at: "2026-01-14T09:05:00.000Z"
        }
      ]
    });
    const env = createEnv(database);

    await withFrozenTime(`${configuredEventDate}T12:00:00.000Z`, async () => {
      for (const path of [
        "/records?startDate=2026-01-14",
        "/records?startDate=bad-date&endDate=2026-01-15",
        "/records?startDate=2026-01-16&endDate=2026-01-15"
      ]) {
        const response = await fetchAdminApi(path, undefined, env);

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
          dateFilter: {
            startDate: configuredEventDate,
            endDate: configuredEventDate
          },
          records: [
            {
              scanId: "scan-fallback-configured",
              studentId: "student-001",
              studentName: "Student Local 01",
              studentSecretId: "student-secret-001",
              mentorId: "mentor-001",
              mentorName: "Mentor Local 01",
              eventDate: configuredEventDate,
              scannedAt: `${configuredEventDate}T08:00:00.000Z`,
              notes: "Configured day record",
              updatedAt: `${configuredEventDate}T08:05:00.000Z`
            }
          ]
        });
      }

      const exportResponse = await fetchAdminApi("/export.csv?startDate=2026-01-16&endDate=2026-01-15", undefined, env);

      expect(exportResponse.status).toBe(200);
      await expect(exportResponse.text()).resolves.toBe(
        [
          "student name,secret id,mentor scanned,date,notes",
          "Student Local 01,student-secret-001,Mentor Local 01,2026-01-15,Configured day record"
        ].join("\n")
      );
    });
  });

  it("rejects a bad admin secret with forbidden", async () => {
    const fetchHandler = worker.fetch as FetchHandler;
    const response = await fetchHandler(
      new Request("https://example.com/admin/not-the-admin-secret/api/records") as WorkerRequest,
      createEnv(),
      {} as WorkerContext
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" });
  });

  it("returns method not allowed with the locked allowed list for non-GET admin records requests", async () => {
    const fetchHandler = worker.fetch as FetchHandler;
    const response = await fetchHandler(
      new Request("https://example.com/admin/local-admin-secret-token/api/records", {
        method: "POST"
      }) as WorkerRequest,
      createEnv(),
      {} as WorkerContext
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET");
    await expect(response.json()).resolves.toEqual({
      error: "Method not allowed",
      allowed: ["GET"]
    });
  });

  it("exports CSV with the locked header, ordering, escaping, and event-date column", async () => {
    const database = createMockD1Database({
      scanRecords: [
        {
          scan_id: "scan-admin-c",
          student_id: "student-003",
          mentor_id: "mentor-003",
          event_date: configuredEventDate,
          scanned_at: "2026-01-16T00:00:00.000Z",
          notes: "Later row",
          updated_at: "2026-01-16T00:05:00.000Z"
        },
        {
          scan_id: "scan-admin-b",
          student_id: "student-001",
          mentor_id: "mentor-001",
          event_date: configuredEventDate,
          scanned_at: `${configuredEventDate}T08:00:00.000Z`,
          notes: "Plain notes",
          updated_at: `${configuredEventDate}T08:05:00.000Z`
        },
        {
          scan_id: "scan-admin-a",
          student_id: "student-002",
          mentor_id: "mentor-002",
          event_date: configuredEventDate,
          scanned_at: `${configuredEventDate}T08:00:00.000Z`,
          notes: 'Contains comma, quote "and"\nsecond line',
          updated_at: `${configuredEventDate}T08:10:00.000Z`
        }
      ]
    });
    const fetchHandler = worker.fetch as FetchHandler;
    const response = await withFrozenTime(`${configuredEventDate}T12:00:00.000Z`, () =>
      fetchHandler(
        new Request("https://example.com/admin/local-admin-secret-token/api/export.csv") as WorkerRequest,
        createEnv(database),
        {} as WorkerContext
      )
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="attendance-2026-01-15.csv"'
    );
    await expect(response.text()).resolves.toBe(
      [
        "student name,secret id,mentor scanned,date,notes",
        'Student Local 02,student-secret-002,Mentor Local 02,2026-01-15,"Contains comma, quote ""and""',
        'second line"',
        'Student Local 01,student-secret-001,Mentor Local 01,2026-01-15,Plain notes',
        'Student Local 03,student-secret-003,Mentor Local 03,2026-01-15,Later row'
      ].join("\n")
    );
  });

  it("deletes a record and removes it from records plus CSV export", async () => {
    const database = createMockD1Database({
      scanRecords: [
        {
          scan_id: "scan-delete-success",
          student_id: "student-001",
          mentor_id: "mentor-001",
          event_date: configuredEventDate,
          scanned_at: `${configuredEventDate}T08:00:00.000Z`,
          notes: "Delete me",
          updated_at: `${configuredEventDate}T08:05:00.000Z`
        }
      ]
    });
    const env = createEnv(database);

    const response = await withFrozenTime(`${configuredEventDate}T12:00:00.000Z`, () =>
      fetchAdminApi(
        "/records/scan-delete-success",
        {
          method: "DELETE"
        },
        env
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      deleted: true,
      scanId: "scan-delete-success"
    });

    await withFrozenTime(`${configuredEventDate}T12:00:00.000Z`, () =>
      expectRecordsAndExportToBeEmpty(env, configuredEventDate)
    );
  });

  it("returns not found when deleting a missing admin record", async () => {
    const response = await fetchAdminApi("/records/missing-delete", {
      method: "DELETE"
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Not found" });
  });

  it("returns forbidden for a bad admin secret on CSV export", async () => {
    const fetchHandler = worker.fetch as FetchHandler;
    const response = await fetchHandler(
      new Request("https://example.com/admin/not-the-admin-secret/api/export.csv") as WorkerRequest,
      createEnv(),
      {} as WorkerContext
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" });
  });

  it("returns method not allowed with GET for non-GET admin CSV export requests", async () => {
    const fetchHandler = worker.fetch as FetchHandler;
    const response = await fetchHandler(
      new Request("https://example.com/admin/local-admin-secret-token/api/export.csv", {
        method: "POST"
      }) as WorkerRequest,
      createEnv(),
      {} as WorkerContext
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET");
    await expect(response.json()).resolves.toEqual({
      error: "Method not allowed",
      allowed: ["GET"]
    });
  });

  it("updates only notes for a valid PATCH request and reflects the change in records plus CSV", async () => {
    const updatedAt = `${configuredEventDate}T11:30:00.000Z`;
    const database = createMockD1Database({
      scanRecords: [
        {
          scan_id: "scan-patch-notes",
          student_id: "student-001",
          mentor_id: "mentor-001",
          event_date: configuredEventDate,
          scanned_at: `${configuredEventDate}T08:00:00.000Z`,
          notes: "Original notes",
          updated_at: `${configuredEventDate}T08:05:00.000Z`
        }
      ]
    });
    const env = createEnv(database);

    const response = await withFrozenTime(updatedAt, () =>
      fetchAdminApi(
        "/records/scan-patch-notes",
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            notes: "Corrected admin note"
          })
        },
        env
      )
    );

    await expectLatestAdminRecord(response, {
      scanId: "scan-patch-notes",
      studentId: "student-001",
      studentName: "Student Local 01",
      studentSecretId: "student-secret-001",
      mentorId: "mentor-001",
      mentorName: "Mentor Local 01",
      eventDate: configuredEventDate,
      scannedAt: `${configuredEventDate}T08:00:00.000Z`,
      notes: "Corrected admin note",
      updatedAt
    });

    await withFrozenTime(updatedAt, () =>
      expectRecordsAndExportToReflectLatestValues(
        env,
        {
          scanId: "scan-patch-notes",
          studentId: "student-001",
          studentName: "Student Local 01",
          studentSecretId: "student-secret-001",
          mentorId: "mentor-001",
          mentorName: "Mentor Local 01",
          eventDate: configuredEventDate,
          scannedAt: `${configuredEventDate}T08:00:00.000Z`,
          notes: "Corrected admin note",
          updatedAt
        },
        "Student Local 01,student-secret-001,Mentor Local 01,2026-01-15,Corrected admin note"
      )
    );
  });

  it("reassigns only the student for a valid PATCH request and reflects the change in records plus CSV", async () => {
    const updatedAt = `${configuredEventDate}T11:31:00.000Z`;
    const database = createMockD1Database({
      scanRecords: [
        {
          scan_id: "scan-patch-student",
          student_id: "student-001",
          mentor_id: "mentor-001",
          event_date: configuredEventDate,
          scanned_at: `${configuredEventDate}T08:10:00.000Z`,
          notes: "Keep notes",
          updated_at: `${configuredEventDate}T08:15:00.000Z`
        }
      ]
    });
    const env = createEnv(database);

    const response = await withFrozenTime(updatedAt, () =>
      fetchAdminApi(
        "/records/scan-patch-student",
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            studentId: "student-003"
          })
        },
        env
      )
    );

    await expectLatestAdminRecord(response, {
      scanId: "scan-patch-student",
      studentId: "student-003",
      studentName: "Student Local 03",
      studentSecretId: "student-secret-003",
      mentorId: "mentor-001",
      mentorName: "Mentor Local 01",
      eventDate: configuredEventDate,
      scannedAt: `${configuredEventDate}T08:10:00.000Z`,
      notes: "Keep notes",
      updatedAt
    });

    await withFrozenTime(updatedAt, () =>
      expectRecordsAndExportToReflectLatestValues(
        env,
        {
          scanId: "scan-patch-student",
          studentId: "student-003",
          studentName: "Student Local 03",
          studentSecretId: "student-secret-003",
          mentorId: "mentor-001",
          mentorName: "Mentor Local 01",
          eventDate: configuredEventDate,
          scannedAt: `${configuredEventDate}T08:10:00.000Z`,
          notes: "Keep notes",
          updatedAt
        },
        "Student Local 03,student-secret-003,Mentor Local 01,2026-01-15,Keep notes"
      )
    );
  });

  it("reassigns only the mentor for a valid PATCH request and reflects the change in records plus CSV", async () => {
    const updatedAt = `${configuredEventDate}T11:32:00.000Z`;
    const database = createMockD1Database({
      scanRecords: [
        {
          scan_id: "scan-patch-mentor",
          student_id: "student-001",
          mentor_id: "mentor-001",
          event_date: configuredEventDate,
          scanned_at: `${configuredEventDate}T08:20:00.000Z`,
          notes: "Keep this note",
          updated_at: `${configuredEventDate}T08:25:00.000Z`
        }
      ]
    });
    const env = createEnv(database);

    const response = await withFrozenTime(updatedAt, () =>
      fetchAdminApi(
        "/records/scan-patch-mentor",
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            mentorId: "mentor-004"
          })
        },
        env
      )
    );

    await expectLatestAdminRecord(response, {
      scanId: "scan-patch-mentor",
      studentId: "student-001",
      studentName: "Student Local 01",
      studentSecretId: "student-secret-001",
      mentorId: "mentor-004",
      mentorName: "Mentor Local 04",
      eventDate: configuredEventDate,
      scannedAt: `${configuredEventDate}T08:20:00.000Z`,
      notes: "Keep this note",
      updatedAt
    });

    await withFrozenTime(updatedAt, () =>
      expectRecordsAndExportToReflectLatestValues(
        env,
        {
          scanId: "scan-patch-mentor",
          studentId: "student-001",
          studentName: "Student Local 01",
          studentSecretId: "student-secret-001",
          mentorId: "mentor-004",
          mentorName: "Mentor Local 04",
          eventDate: configuredEventDate,
          scannedAt: `${configuredEventDate}T08:20:00.000Z`,
          notes: "Keep this note",
          updatedAt
        },
        "Student Local 01,student-secret-001,Mentor Local 04,2026-01-15,Keep this note"
      )
    );
  });

  it("updates notes, student, and mentor together for a valid PATCH request", async () => {
    const updatedAt = `${configuredEventDate}T11:33:00.000Z`;
    const database = createMockD1Database({
      scanRecords: [
        {
          scan_id: "scan-patch-combined",
          student_id: "student-001",
          mentor_id: "mentor-001",
          event_date: configuredEventDate,
          scanned_at: `${configuredEventDate}T08:30:00.000Z`,
          notes: "Old note",
          updated_at: `${configuredEventDate}T08:35:00.000Z`
        }
      ]
    });
    const env = createEnv(database);

    const response = await withFrozenTime(updatedAt, () =>
      fetchAdminApi(
        "/records/scan-patch-combined",
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            notes: "Final admin correction",
            studentId: "student-004",
            mentorId: "mentor-005"
          })
        },
        env
      )
    );

    await expectLatestAdminRecord(response, {
      scanId: "scan-patch-combined",
      studentId: "student-004",
      studentName: "Student Local 04",
      studentSecretId: "student-secret-004",
      mentorId: "mentor-005",
      mentorName: "Mentor Local 05",
      eventDate: configuredEventDate,
      scannedAt: `${configuredEventDate}T08:30:00.000Z`,
      notes: "Final admin correction",
      updatedAt
    });

    await withFrozenTime(updatedAt, () =>
      expectRecordsAndExportToReflectLatestValues(
        env,
        {
          scanId: "scan-patch-combined",
          studentId: "student-004",
          studentName: "Student Local 04",
          studentSecretId: "student-secret-004",
          mentorId: "mentor-005",
          mentorName: "Mentor Local 05",
          eventDate: configuredEventDate,
          scannedAt: `${configuredEventDate}T08:30:00.000Z`,
          notes: "Final admin correction",
          updatedAt
        },
        "Student Local 04,student-secret-004,Mentor Local 05,2026-01-15,Final admin correction"
      )
    );
  });

  it("allows empty-string notes to clear stored notes", async () => {
    const updatedAt = `${configuredEventDate}T11:34:00.000Z`;
    const database = createMockD1Database({
      scanRecords: [
        {
          scan_id: "scan-patch-clear-notes",
          student_id: "student-002",
          mentor_id: "mentor-002",
          event_date: configuredEventDate,
          scanned_at: `${configuredEventDate}T08:40:00.000Z`,
          notes: "Needs clearing",
          updated_at: `${configuredEventDate}T08:45:00.000Z`
        }
      ]
    });
    const env = createEnv(database);

    const response = await withFrozenTime(updatedAt, () =>
      fetchAdminApi(
        "/records/scan-patch-clear-notes",
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            notes: ""
          })
        },
        env
      )
    );

    await expectLatestAdminRecord(response, {
      scanId: "scan-patch-clear-notes",
      studentId: "student-002",
      studentName: "Student Local 02",
      studentSecretId: "student-secret-002",
      mentorId: "mentor-002",
      mentorName: "Mentor Local 02",
      eventDate: configuredEventDate,
      scannedAt: `${configuredEventDate}T08:40:00.000Z`,
      notes: "",
      updatedAt
    });

    await withFrozenTime(updatedAt, () =>
      expectRecordsAndExportToReflectLatestValues(
        env,
        {
          scanId: "scan-patch-clear-notes",
          studentId: "student-002",
          studentName: "Student Local 02",
          studentSecretId: "student-secret-002",
          mentorId: "mentor-002",
          mentorName: "Mentor Local 02",
          eventDate: configuredEventDate,
          scannedAt: `${configuredEventDate}T08:40:00.000Z`,
          notes: "",
          updatedAt
        },
        "Student Local 02,student-secret-002,Mentor Local 02,2026-01-15,"
      )
    );
  });

  it("rejects unknown PATCH body keys with 400", async () => {
    const database = createMockD1Database({
      scanRecords: [
        {
          scan_id: "scan-patch-bad-key",
          student_id: "student-001",
          mentor_id: "mentor-001",
          event_date: configuredEventDate,
          scanned_at: `${configuredEventDate}T08:50:00.000Z`,
          notes: "Original",
          updated_at: `${configuredEventDate}T08:55:00.000Z`
        }
      ]
    });
    const env = createEnv(database);

    const response = await fetchAdminApi(
      "/records/scan-patch-bad-key",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          notes: "Attempted update",
          unexpected: true
        })
      },
      env
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid admin record patch payload."
    });
    expect(readMockD1State(database).scanRecords[0]).toMatchObject({
      student_id: "student-001",
      mentor_id: "mentor-001",
      notes: "Original"
    });
  });

  it("rejects PATCH payloads that omit all allowed keys with 400", async () => {
    const response = await fetchAdminApi("/records/scan-patch-no-keys", {
      method: "PATCH",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({})
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "PATCH body must include at least one of notes, studentId, or mentorId."
    });
  });

  it("rejects invalid JSON PATCH bodies with 400", async () => {
    const response = await fetchAdminApi("/records/scan-patch-json", {
      method: "PATCH",
      headers: {
        "content-type": "application/json"
      },
      body: "{"
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid admin record patch body."
    });
  });

  it("rejects non-object PATCH JSON bodies with 400", async () => {
    const response = await fetchAdminApi("/records/scan-patch-shape", {
      method: "PATCH",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(["notes"])
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid admin record patch payload."
    });
  });

  it("returns not found when the PATCH target scan does not exist", async () => {
    const response = await fetchAdminApi("/records/missing-scan", {
      method: "PATCH",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        notes: "No record here"
      })
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Not found" });
  });

  it("returns not found when the reassigned student does not exist as a student", async () => {
    const database = createMockD1Database({
      scanRecords: [
        {
          scan_id: "scan-patch-missing-student",
          student_id: "student-001",
          mentor_id: "mentor-001",
          event_date: configuredEventDate,
          scanned_at: `${configuredEventDate}T09:20:00.000Z`,
          notes: "Original",
          updated_at: `${configuredEventDate}T09:25:00.000Z`
        }
      ]
    });

    const response = await fetchAdminApi(
      "/records/scan-patch-missing-student",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          studentId: "mentor-001"
        })
      },
      createEnv(database)
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Not found" });
  });

  it("returns not found when the reassigned mentor does not exist as a mentor", async () => {
    const database = createMockD1Database({
      scanRecords: [
        {
          scan_id: "scan-patch-missing-mentor",
          student_id: "student-001",
          mentor_id: "mentor-001",
          event_date: configuredEventDate,
          scanned_at: `${configuredEventDate}T09:30:00.000Z`,
          notes: "Original",
          updated_at: `${configuredEventDate}T09:35:00.000Z`
        }
      ]
    });

    const response = await fetchAdminApi(
      "/records/scan-patch-missing-mentor",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          mentorId: "student-001"
        })
      },
      createEnv(database)
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Not found" });
  });

  it("maps uniqueness conflicts during reassignment to the locked duplicate message", async () => {
    const database = createMockD1Database({
      scanRecords: [
        {
          scan_id: "scan-patch-conflict-source",
          student_id: "student-001",
          mentor_id: "mentor-001",
          event_date: configuredEventDate,
          scanned_at: `${configuredEventDate}T09:00:00.000Z`,
          notes: "Source row",
          updated_at: `${configuredEventDate}T09:05:00.000Z`
        },
        {
          scan_id: "scan-patch-conflict-existing",
          student_id: "student-002",
          mentor_id: "mentor-002",
          event_date: configuredEventDate,
          scanned_at: `${configuredEventDate}T09:10:00.000Z`,
          notes: "Existing row",
          updated_at: `${configuredEventDate}T09:15:00.000Z`
        }
      ]
    });
    const env = createEnv(database);

    const response = await fetchAdminApi(
      "/records/scan-patch-conflict-source",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          studentId: "student-002",
          mentorId: "mentor-002"
        })
      },
      env
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Duplicate mentor scan already recorded for this calendar day."
    });
    expect(readMockD1State(database).scanRecords).toEqual([
      {
        scan_id: "scan-patch-conflict-source",
        student_id: "student-001",
        mentor_id: "mentor-001",
        event_date: configuredEventDate,
        scanned_at: `${configuredEventDate}T09:00:00.000Z`,
        notes: "Source row",
        updated_at: `${configuredEventDate}T09:05:00.000Z`
      },
      {
        scan_id: "scan-patch-conflict-existing",
        student_id: "student-002",
        mentor_id: "mentor-002",
        event_date: configuredEventDate,
        scanned_at: `${configuredEventDate}T09:10:00.000Z`,
        notes: "Existing row",
        updated_at: `${configuredEventDate}T09:15:00.000Z`
      }
    ]);
  });

  it("rejects reassignment that would create a duplicate student-mentor-day key", async () => {
    const database = createMockD1Database({
      scanRecords: [
        {
          scan_id: "scan-reassign-source",
          student_id: "student-001",
          mentor_id: "mentor-002",
          event_date: configuredEventDate,
          scanned_at: `${configuredEventDate}T09:00:00.000Z`,
          notes: "Source row",
          updated_at: `${configuredEventDate}T09:05:00.000Z`
        },
        {
          scan_id: "scan-reassign-target",
          student_id: "student-002",
          mentor_id: "mentor-002",
          event_date: configuredEventDate,
          scanned_at: `${configuredEventDate}T09:10:00.000Z`,
          notes: "Target row",
          updated_at: `${configuredEventDate}T09:15:00.000Z`
        }
      ]
    });
    const env = createEnv(database);

    // PATCH source's studentId to match target's → (student-002, mentor-002) collision
    const response = await fetchAdminApi(
      "/records/scan-reassign-source",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          studentId: "student-002"
        })
      },
      env
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Duplicate mentor scan already recorded for this calendar day."
    });
    // Verify no records were mutated
    expect(readMockD1State(database).scanRecords).toEqual([
      {
        scan_id: "scan-reassign-source",
        student_id: "student-001",
        mentor_id: "mentor-002",
        event_date: configuredEventDate,
        scanned_at: `${configuredEventDate}T09:00:00.000Z`,
        notes: "Source row",
        updated_at: `${configuredEventDate}T09:05:00.000Z`
      },
      {
        scan_id: "scan-reassign-target",
        student_id: "student-002",
        mentor_id: "mentor-002",
        event_date: configuredEventDate,
        scanned_at: `${configuredEventDate}T09:10:00.000Z`,
        notes: "Target row",
        updated_at: `${configuredEventDate}T09:15:00.000Z`
      }
    ]);
  });

  it("defaults to the runtime UTC day for /records when no query params are given, not the configured EVENT_DATE", async () => {
    const frozenUtcDay = "2026-01-20";
    const database = createMockD1Database({
      scanRecords: [
        {
          scan_id: "scan-utc-day-record",
          student_id: "student-001",
          mentor_id: "mentor-001",
          event_date: frozenUtcDay,
          scanned_at: `${frozenUtcDay}T10:00:00.000Z`,
          notes: "On frozen UTC day",
          updated_at: `${frozenUtcDay}T10:05:00.000Z`
        },
        {
          scan_id: "scan-configured-day-record",
          student_id: "student-002",
          mentor_id: "mentor-002",
          event_date: configuredEventDate,
          scanned_at: `${configuredEventDate}T08:00:00.000Z`,
          notes: "On configured EVENT_DATE",
          updated_at: `${configuredEventDate}T08:05:00.000Z`
        }
      ]
    });
    const env = createEnv(database);

    await withFrozenTime(`${frozenUtcDay}T12:00:00.000Z`, async () => {
      const response = await fetchAdminApi("/records", undefined, env);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        dateFilter: {
          startDate: frozenUtcDay,
          endDate: frozenUtcDay
        },
        records: [
          {
            scanId: "scan-utc-day-record",
            studentId: "student-001",
            studentName: "Student Local 01",
            studentSecretId: "student-secret-001",
            mentorId: "mentor-001",
            mentorName: "Mentor Local 01",
            eventDate: frozenUtcDay,
            scannedAt: `${frozenUtcDay}T10:00:00.000Z`,
            notes: "On frozen UTC day",
            updatedAt: `${frozenUtcDay}T10:05:00.000Z`
          }
        ]
      });
    });
  });

  it("defaults to the runtime UTC day for /export.csv when no query params are given, not the configured EVENT_DATE", async () => {
    const frozenUtcDay = "2026-01-20";
    const database = createMockD1Database({
      scanRecords: [
        {
          scan_id: "scan-export-utc-day",
          student_id: "student-003",
          mentor_id: "mentor-003",
          event_date: frozenUtcDay,
          scanned_at: `${frozenUtcDay}T11:00:00.000Z`,
          notes: "Export UTC day",
          updated_at: `${frozenUtcDay}T11:05:00.000Z`
        },
        {
          scan_id: "scan-export-configured-day",
          student_id: "student-004",
          mentor_id: "mentor-004",
          event_date: configuredEventDate,
          scanned_at: `${configuredEventDate}T14:00:00.000Z`,
          notes: "Export configured day",
          updated_at: `${configuredEventDate}T14:05:00.000Z`
        }
      ]
    });
    const env = createEnv(database);

    await withFrozenTime(`${frozenUtcDay}T12:00:00.000Z`, async () => {
      const response = await fetchAdminApi("/export.csv", undefined, env);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-disposition")).toBe(
        `attachment; filename="attendance-${frozenUtcDay}.csv"`
      );
      await expect(response.text()).resolves.toBe(
        [
          "student name,secret id,mentor scanned,date,notes",
          "Student Local 03,student-secret-003,Mentor Local 03,2026-01-20,Export UTC day"
        ].join("\n")
      );
    });
  });

  it("uses explicit startDate/endDate params that differ from both the frozen UTC day and EVENT_DATE", async () => {
    const frozenUtcDay = "2026-01-20";
    const explicitStart = "2026-01-14";
    const explicitEnd = "2026-01-16";
    const database = createMockD1Database({
      scanRecords: [
        {
          scan_id: "scan-explicit-in-range",
          student_id: "student-001",
          mentor_id: "mentor-001",
          event_date: configuredEventDate,
          scanned_at: `${configuredEventDate}T08:00:00.000Z`,
          notes: "In explicit range",
          updated_at: `${configuredEventDate}T08:05:00.000Z`
        },
        {
          scan_id: "scan-explicit-on-frozen-day",
          student_id: "student-002",
          mentor_id: "mentor-002",
          event_date: frozenUtcDay,
          scanned_at: `${frozenUtcDay}T10:00:00.000Z`,
          notes: "On frozen day but outside explicit range",
          updated_at: `${frozenUtcDay}T10:05:00.000Z`
        },
        {
          scan_id: "scan-explicit-before-range",
          student_id: "student-003",
          mentor_id: "mentor-003",
          event_date: "2026-01-13",
          scanned_at: "2026-01-13T10:00:00.000Z",
          notes: "Before range",
          updated_at: "2026-01-13T10:05:00.000Z"
        }
      ]
    });
    const env = createEnv(database);

    await withFrozenTime(`${frozenUtcDay}T12:00:00.000Z`, async () => {
      const recordsResponse = await fetchAdminApi(
        `/records?startDate=${explicitStart}&endDate=${explicitEnd}`,
        undefined,
        env
      );

      expect(recordsResponse.status).toBe(200);
      await expect(recordsResponse.json()).resolves.toMatchObject({
        dateFilter: {
          startDate: explicitStart,
          endDate: explicitEnd
        },
        records: [
          {
            scanId: "scan-explicit-in-range",
            studentId: "student-001",
            eventDate: configuredEventDate,
            notes: "In explicit range"
          }
        ]
      });

      const exportResponse = await fetchAdminApi(
        `/export.csv?startDate=${explicitStart}&endDate=${explicitEnd}`,
        undefined,
        env
      );

      expect(exportResponse.status).toBe(200);
      await expect(exportResponse.text()).resolves.toBe(
        [
          "student name,secret id,mentor scanned,date,notes",
          "Student Local 01,student-secret-001,Mentor Local 01,2026-01-15,In explicit range"
        ].join("\n")
      );
    });
  });
});
