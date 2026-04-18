import { describe, expect, it, vi } from "vitest";

import worker from "../../src/worker/index";
import { createMockD1Database, readMockD1State } from "../support/mock-d1";
import {
  REAL_MENTORS,
  REAL_MENTORS_BY_NAME,
  REAL_STUDENTS,
  REAL_STUDENTS_BY_NAME
} from "../support/real-roster";

type FetchHandler = NonNullable<typeof worker.fetch>;
type WorkerRequest = Parameters<FetchHandler>[0];
type WorkerEnv = Parameters<FetchHandler>[1];
type WorkerContext = Parameters<FetchHandler>[2];

const [student1, student2, student3, student4] = REAL_STUDENTS;
const [mentor1, mentor2, mentor3, mentor4, mentor5] = REAL_MENTORS;

function studentOptions() {
  return REAL_STUDENTS_BY_NAME.map(({ person_id, display_name }) => ({
    personId: person_id,
    displayName: display_name
  }));
}

function mentorOptions() {
  return REAL_MENTORS_BY_NAME.map(({ person_id, display_name }) => ({
    personId: person_id,
    displayName: display_name
  }));
}

function csvField(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function exportLine(student: typeof student1, mentor: typeof mentor1, eventDate: string, notes: string): string {
  return [student.display_name, student.secret_id, mentor.display_name, eventDate, notes]
    .map(csvField)
    .join(",");
}

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
  await expect(response.json()).resolves.toMatchObject(expected);
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
          student_id: student1.person_id,
          mentor_id: mentor1.person_id,
          event_date: configuredEventDate,
          scanned_at: `${configuredEventDate}T08:00:00.000Z`,
          notes: "First record",
          updated_at: `${configuredEventDate}T08:05:00.000Z`
        },
        {
          scan_id: "scan-admin-new",
          student_id: student2.person_id,
          mentor_id: mentor2.person_id,
          event_date: configuredEventDate,
          scanned_at: `${configuredEventDate}T09:00:00.000Z`,
          notes: "Second record",
          updated_at: `${configuredEventDate}T09:05:00.000Z`
        },
        {
          scan_id: "scan-admin-other-day",
          student_id: student3.person_id,
          mentor_id: mentor3.person_id,
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
    await expect(response.json()).resolves.toMatchObject({
      dateFilter: {
        startDate: configuredEventDate,
        endDate: configuredEventDate
      },
      records: [
        {
          scanId: "scan-admin-new",
          studentId: student2.person_id,
          studentName: student2.display_name,
          studentSecretId: student2.secret_id,
          mentorId: mentor2.person_id,
          mentorName: mentor2.display_name,
          eventDate: configuredEventDate,
          scannedAt: `${configuredEventDate}T09:00:00.000Z`,
          notes: "Second record",
          updatedAt: `${configuredEventDate}T09:05:00.000Z`
        },
        {
          scanId: "scan-admin-old",
          studentId: student1.person_id,
          studentName: student1.display_name,
          studentSecretId: student1.secret_id,
          mentorId: mentor1.person_id,
          mentorName: mentor1.display_name,
          eventDate: configuredEventDate,
          scannedAt: `${configuredEventDate}T08:00:00.000Z`,
          notes: "First record",
          updatedAt: `${configuredEventDate}T08:05:00.000Z`
        }
      ],
      students: studentOptions(),
      mentors: mentorOptions()
    });
  });

  it("returns ranged admin records and export rows for the same start/end dates", async () => {
    const startDate = "2026-01-14";
    const endDate = configuredEventDate;
    const database = createMockD1Database({
      scanRecords: [
        {
          scan_id: "scan-range-late",
          student_id: student2.person_id,
          mentor_id: mentor2.person_id,
          event_date: endDate,
          scanned_at: `${endDate}T09:00:00.000Z`,
          notes: "End range record",
          updated_at: `${endDate}T09:05:00.000Z`
        },
        {
          scan_id: "scan-range-early",
          student_id: student1.person_id,
          mentor_id: mentor1.person_id,
          event_date: startDate,
          scanned_at: `${startDate}T08:00:00.000Z`,
          notes: "Start range record",
          updated_at: `${startDate}T08:05:00.000Z`
        },
        {
          scan_id: "scan-range-outside",
          student_id: student3.person_id,
          mentor_id: mentor3.person_id,
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
    await expect(recordsResponse.json()).resolves.toMatchObject({
      dateFilter: {
        startDate,
        endDate
      },
      records: [
        {
          scanId: "scan-range-late",
          studentId: student2.person_id,
          studentName: student2.display_name,
          studentSecretId: student2.secret_id,
          mentorId: mentor2.person_id,
          mentorName: mentor2.display_name,
          eventDate: endDate,
          scannedAt: `${endDate}T09:00:00.000Z`,
          notes: "End range record",
          updatedAt: `${endDate}T09:05:00.000Z`
        },
        {
          scanId: "scan-range-early",
          studentId: student1.person_id,
          studentName: student1.display_name,
          studentSecretId: student1.secret_id,
          mentorId: mentor1.person_id,
          mentorName: mentor1.display_name,
          eventDate: startDate,
          scannedAt: `${startDate}T08:00:00.000Z`,
          notes: "Start range record",
          updatedAt: `${startDate}T08:05:00.000Z`
        }
      ],
      students: studentOptions(),
      mentors: mentorOptions()
    });

    const exportResponse = await fetchAdminApi(`/export.csv?startDate=${startDate}&endDate=${endDate}`, undefined, env);

    expect(exportResponse.status).toBe(200);
    await expect(exportResponse.text()).resolves.toBe(
      [
        "student name,secret id,mentor scanned,date,notes",
        exportLine(student1, mentor1, startDate, "Start range record"),
        exportLine(student2, mentor2, endDate, "End range record")
      ].join("\n")
    );
  });

  it("returns ranged admin records when scan_records.entry_method is missing remotely", async () => {
    const startDate = "2026-01-14";
    const endDate = configuredEventDate;
    const database = createMockD1Database({
      missingScanRecordsEntryMethodColumn: true,
      scanRecords: [
        {
          scan_id: "scan-legacy-range",
          student_id: student1.person_id,
          mentor_id: mentor1.person_id,
          event_date: endDate,
          scanned_at: `${endDate}T08:00:00.000Z`,
          notes: "Legacy schema record",
          updated_at: `${endDate}T08:05:00.000Z`
        }
      ]
    });
    const env = createEnv(database);

    const response = await fetchAdminApi(`/records?startDate=${startDate}&endDate=${endDate}`, undefined, env);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      dateFilter: {
        startDate,
        endDate
      },
      records: [
        {
          scanId: "scan-legacy-range",
          studentId: student1.person_id,
          mentorId: mentor1.person_id,
          eventDate: endDate,
          notes: "Legacy schema record",
          entryMethod: "qr"
        }
      ],
      students: studentOptions(),
      mentors: mentorOptions()
    });
  });

  it("falls back to the current UTC day when the admin range is partial, malformed, or reversed", async () => {
    const database = createMockD1Database({
      scanRecords: [
        {
          scan_id: "scan-fallback-configured",
          student_id: student1.person_id,
          mentor_id: mentor1.person_id,
          event_date: configuredEventDate,
          scanned_at: `${configuredEventDate}T08:00:00.000Z`,
          notes: "Configured day record",
          updated_at: `${configuredEventDate}T08:05:00.000Z`
        },
        {
          scan_id: "scan-fallback-outside",
          student_id: student2.person_id,
          mentor_id: mentor2.person_id,
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
              studentId: student1.person_id,
              studentName: student1.display_name,
              studentSecretId: student1.secret_id,
              mentorId: mentor1.person_id,
              mentorName: mentor1.display_name,
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
          exportLine(student1, mentor1, configuredEventDate, "Configured day record")
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
    await expect(response.json()).resolves.toMatchObject({ error: "Forbidden" });
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
    await expect(response.json()).resolves.toMatchObject({
      error: "Method not allowed",
      allowed: ["GET"]
    });
  });

  it("exports CSV with the locked header, ordering, escaping, and event-date column", async () => {
    const database = createMockD1Database({
      scanRecords: [
        {
          scan_id: "scan-admin-c",
          student_id: student3.person_id,
          mentor_id: mentor3.person_id,
          event_date: configuredEventDate,
          scanned_at: "2026-01-16T00:00:00.000Z",
          notes: "Later row",
          updated_at: "2026-01-16T00:05:00.000Z"
        },
        {
          scan_id: "scan-admin-b",
          student_id: student1.person_id,
          mentor_id: mentor1.person_id,
          event_date: configuredEventDate,
          scanned_at: `${configuredEventDate}T08:00:00.000Z`,
          notes: "Plain notes",
          updated_at: `${configuredEventDate}T08:05:00.000Z`
        },
        {
          scan_id: "scan-admin-a",
          student_id: student2.person_id,
          mentor_id: mentor2.person_id,
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
        exportLine(student2, mentor2, configuredEventDate, 'Contains comma, quote "and"\nsecond line'),
        exportLine(student1, mentor1, configuredEventDate, "Plain notes"),
        exportLine(student3, mentor3, configuredEventDate, "Later row")
      ].join("\n")
    );
  });

  it("deletes a record and removes it from records plus CSV export", async () => {
    const database = createMockD1Database({
      scanRecords: [
        {
          scan_id: "scan-delete-success",
          student_id: student1.person_id,
          mentor_id: mentor1.person_id,
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
    await expect(response.json()).resolves.toMatchObject({
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
    await expect(response.json()).resolves.toMatchObject({ error: "Not found" });
  });

  it("returns forbidden for a bad admin secret on CSV export", async () => {
    const fetchHandler = worker.fetch as FetchHandler;
    const response = await fetchHandler(
      new Request("https://example.com/admin/not-the-admin-secret/api/export.csv") as WorkerRequest,
      createEnv(),
      {} as WorkerContext
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: "Forbidden" });
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
    await expect(response.json()).resolves.toMatchObject({
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
          student_id: student1.person_id,
          mentor_id: mentor1.person_id,
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
      studentId: student1.person_id,
      studentName: student1.display_name,
      studentSecretId: student1.secret_id,
      mentorId: mentor1.person_id,
      mentorName: mentor1.display_name,
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
          studentId: student1.person_id,
          studentName: student1.display_name,
          studentSecretId: student1.secret_id,
          mentorId: mentor1.person_id,
          mentorName: mentor1.display_name,
          eventDate: configuredEventDate,
          scannedAt: `${configuredEventDate}T08:00:00.000Z`,
          notes: "Corrected admin note",
          updatedAt
        },
        exportLine(student1, mentor1, configuredEventDate, "Corrected admin note")
      )
    );
  });

  it("reassigns only the student for a valid PATCH request and reflects the change in records plus CSV", async () => {
    const updatedAt = `${configuredEventDate}T11:31:00.000Z`;
    const database = createMockD1Database({
      scanRecords: [
        {
          scan_id: "scan-patch-student",
          student_id: student1.person_id,
          mentor_id: mentor1.person_id,
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
            studentId: student3.person_id
          })
        },
        env
      )
    );

    await expectLatestAdminRecord(response, {
      scanId: "scan-patch-student",
      studentId: student3.person_id,
      studentName: student3.display_name,
      studentSecretId: student3.secret_id,
      mentorId: mentor1.person_id,
      mentorName: mentor1.display_name,
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
          studentId: student3.person_id,
          studentName: student3.display_name,
          studentSecretId: student3.secret_id,
          mentorId: mentor1.person_id,
          mentorName: mentor1.display_name,
          eventDate: configuredEventDate,
          scannedAt: `${configuredEventDate}T08:10:00.000Z`,
          notes: "Keep notes",
          updatedAt
        },
        exportLine(student3, mentor1, configuredEventDate, "Keep notes")
      )
    );
  });

  it("reassigns only the mentor for a valid PATCH request and reflects the change in records plus CSV", async () => {
    const updatedAt = `${configuredEventDate}T11:32:00.000Z`;
    const database = createMockD1Database({
      scanRecords: [
        {
          scan_id: "scan-patch-mentor",
          student_id: student1.person_id,
          mentor_id: mentor1.person_id,
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
            mentorId: mentor4.person_id
          })
        },
        env
      )
    );

    await expectLatestAdminRecord(response, {
      scanId: "scan-patch-mentor",
      studentId: student1.person_id,
      studentName: student1.display_name,
      studentSecretId: student1.secret_id,
      mentorId: mentor4.person_id,
      mentorName: mentor4.display_name,
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
          studentId: student1.person_id,
          studentName: student1.display_name,
          studentSecretId: student1.secret_id,
          mentorId: mentor4.person_id,
          mentorName: mentor4.display_name,
          eventDate: configuredEventDate,
          scannedAt: `${configuredEventDate}T08:20:00.000Z`,
          notes: "Keep this note",
          updatedAt
        },
        exportLine(student1, mentor4, configuredEventDate, "Keep this note")
      )
    );
  });

  it("updates notes, student, and mentor together for a valid PATCH request", async () => {
    const updatedAt = `${configuredEventDate}T11:33:00.000Z`;
    const database = createMockD1Database({
      scanRecords: [
        {
          scan_id: "scan-patch-combined",
          student_id: student1.person_id,
          mentor_id: mentor1.person_id,
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
            studentId: student4.person_id,
            mentorId: mentor5.person_id
          })
        },
        env
      )
    );

    await expectLatestAdminRecord(response, {
      scanId: "scan-patch-combined",
      studentId: student4.person_id,
      studentName: student4.display_name,
      studentSecretId: student4.secret_id,
      mentorId: mentor5.person_id,
      mentorName: mentor5.display_name,
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
          studentId: student4.person_id,
          studentName: student4.display_name,
          studentSecretId: student4.secret_id,
          mentorId: mentor5.person_id,
          mentorName: mentor5.display_name,
          eventDate: configuredEventDate,
          scannedAt: `${configuredEventDate}T08:30:00.000Z`,
          notes: "Final admin correction",
          updatedAt
        },
        exportLine(student4, mentor5, configuredEventDate, "Final admin correction")
      )
    );
  });

  it("allows empty-string notes to clear stored notes", async () => {
    const updatedAt = `${configuredEventDate}T11:34:00.000Z`;
    const database = createMockD1Database({
      scanRecords: [
        {
          scan_id: "scan-patch-clear-notes",
          student_id: student2.person_id,
          mentor_id: mentor2.person_id,
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
      studentId: student2.person_id,
      studentName: student2.display_name,
      studentSecretId: student2.secret_id,
      mentorId: mentor2.person_id,
      mentorName: mentor2.display_name,
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
          studentId: student2.person_id,
          studentName: student2.display_name,
          studentSecretId: student2.secret_id,
          mentorId: mentor2.person_id,
          mentorName: mentor2.display_name,
          eventDate: configuredEventDate,
          scannedAt: `${configuredEventDate}T08:40:00.000Z`,
          notes: "",
          updatedAt
        },
        exportLine(student2, mentor2, configuredEventDate, "")
      )
    );
  });

  it("rejects unknown PATCH body keys with 400", async () => {
    const database = createMockD1Database({
      scanRecords: [
        {
          scan_id: "scan-patch-bad-key",
          student_id: student1.person_id,
          mentor_id: mentor1.person_id,
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
    await expect(response.json()).resolves.toMatchObject({
      error: "Invalid admin record patch payload."
    });
    expect(readMockD1State(database).scanRecords[0]).toMatchObject({
      student_id: student1.person_id,
      mentor_id: mentor1.person_id,
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
    await expect(response.json()).resolves.toMatchObject({
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
    await expect(response.json()).resolves.toMatchObject({
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
    await expect(response.json()).resolves.toMatchObject({
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
    await expect(response.json()).resolves.toMatchObject({ error: "Not found" });
  });

  it("returns not found when the reassigned student does not exist as a student", async () => {
    const database = createMockD1Database({
      scanRecords: [
        {
          scan_id: "scan-patch-missing-student",
          student_id: student1.person_id,
          mentor_id: mentor1.person_id,
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
          studentId: mentor1.person_id
        })
      },
      createEnv(database)
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: "Not found" });
  });

  it("returns not found when the reassigned mentor does not exist as a mentor", async () => {
    const database = createMockD1Database({
      scanRecords: [
        {
          scan_id: "scan-patch-missing-mentor",
          student_id: student1.person_id,
          mentor_id: mentor1.person_id,
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
          mentorId: student1.person_id
        })
      },
      createEnv(database)
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: "Not found" });
  });

  it("maps uniqueness conflicts during reassignment to the locked duplicate message", async () => {
    const database = createMockD1Database({
      scanRecords: [
        {
          scan_id: "scan-patch-conflict-source",
          student_id: student1.person_id,
          mentor_id: mentor1.person_id,
          event_date: configuredEventDate,
          scanned_at: `${configuredEventDate}T09:00:00.000Z`,
          notes: "Source row",
          updated_at: `${configuredEventDate}T09:05:00.000Z`
        },
        {
          scan_id: "scan-patch-conflict-existing",
          student_id: student2.person_id,
          mentor_id: mentor2.person_id,
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
          studentId: student2.person_id,
          mentorId: mentor2.person_id
        })
      },
      env
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "Duplicate mentor scan already recorded for this calendar day."
    });
    expect(readMockD1State(database).scanRecords).toMatchObject([
      {
        scan_id: "scan-patch-conflict-source",
        student_id: student1.person_id,
        mentor_id: mentor1.person_id,
        event_date: configuredEventDate,
        scanned_at: `${configuredEventDate}T09:00:00.000Z`,
        notes: "Source row",
        updated_at: `${configuredEventDate}T09:05:00.000Z`
      },
      {
        scan_id: "scan-patch-conflict-existing",
        student_id: student2.person_id,
        mentor_id: mentor2.person_id,
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
          student_id: student1.person_id,
          mentor_id: mentor2.person_id,
          event_date: configuredEventDate,
          scanned_at: `${configuredEventDate}T09:00:00.000Z`,
          notes: "Source row",
          updated_at: `${configuredEventDate}T09:05:00.000Z`
        },
        {
          scan_id: "scan-reassign-target",
          student_id: student2.person_id,
          mentor_id: mentor2.person_id,
          event_date: configuredEventDate,
          scanned_at: `${configuredEventDate}T09:10:00.000Z`,
          notes: "Target row",
          updated_at: `${configuredEventDate}T09:15:00.000Z`
        }
      ]
    });
    const env = createEnv(database);

    // PATCH source's studentId to match target's → (student2, mentor2) collision
    const response = await fetchAdminApi(
      "/records/scan-reassign-source",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          studentId: student2.person_id
        })
      },
      env
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "Duplicate mentor scan already recorded for this calendar day."
    });
    // Verify no records were mutated
    expect(readMockD1State(database).scanRecords).toMatchObject([
      {
        scan_id: "scan-reassign-source",
        student_id: student1.person_id,
        mentor_id: mentor2.person_id,
        event_date: configuredEventDate,
        scanned_at: `${configuredEventDate}T09:00:00.000Z`,
        notes: "Source row",
        updated_at: `${configuredEventDate}T09:05:00.000Z`
      },
      {
        scan_id: "scan-reassign-target",
        student_id: student2.person_id,
        mentor_id: mentor2.person_id,
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
          student_id: student1.person_id,
          mentor_id: mentor1.person_id,
          event_date: frozenUtcDay,
          scanned_at: `${frozenUtcDay}T10:00:00.000Z`,
          notes: "On frozen UTC day",
          updated_at: `${frozenUtcDay}T10:05:00.000Z`
        },
        {
          scan_id: "scan-configured-day-record",
          student_id: student2.person_id,
          mentor_id: mentor2.person_id,
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
            studentId: student1.person_id,
            studentName: student1.display_name,
            studentSecretId: student1.secret_id,
            mentorId: mentor1.person_id,
            mentorName: mentor1.display_name,
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
          student_id: student3.person_id,
          mentor_id: mentor3.person_id,
          event_date: frozenUtcDay,
          scanned_at: `${frozenUtcDay}T11:00:00.000Z`,
          notes: "Export UTC day",
          updated_at: `${frozenUtcDay}T11:05:00.000Z`
        },
        {
          scan_id: "scan-export-configured-day",
          student_id: student4.person_id,
          mentor_id: mentor4.person_id,
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
          exportLine(student3, mentor3, frozenUtcDay, "Export UTC day")
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
          student_id: student1.person_id,
          mentor_id: mentor1.person_id,
          event_date: configuredEventDate,
          scanned_at: `${configuredEventDate}T08:00:00.000Z`,
          notes: "In explicit range",
          updated_at: `${configuredEventDate}T08:05:00.000Z`
        },
        {
          scan_id: "scan-explicit-on-frozen-day",
          student_id: student2.person_id,
          mentor_id: mentor2.person_id,
          event_date: frozenUtcDay,
          scanned_at: `${frozenUtcDay}T10:00:00.000Z`,
          notes: "On frozen day but outside explicit range",
          updated_at: `${frozenUtcDay}T10:05:00.000Z`
        },
        {
          scan_id: "scan-explicit-before-range",
          student_id: student3.person_id,
          mentor_id: mentor3.person_id,
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
            studentId: student1.person_id,
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
          exportLine(student1, mentor1, configuredEventDate, "In explicit range")
        ].join("\n")
      );
    });
  });

  describe("entryMethod in records and CSV", () => {
    it("returns entryMethod in records JSON for each record", async () => {
      const database = createMockD1Database({
        scanRecords: [
          {
            scan_id: "scan-qr",
            student_id: student1.person_id,
            mentor_id: mentor1.person_id,
            event_date: configuredEventDate,
            scanned_at: `${configuredEventDate}T08:00:00.000Z`,
            entry_method: "qr",
            notes: "QR scan",
            updated_at: `${configuredEventDate}T08:05:00.000Z`
          },
          {
            scan_id: "scan-fallback",
            student_id: student2.person_id,
            mentor_id: mentor2.person_id,
            event_date: configuredEventDate,
            scanned_at: `${configuredEventDate}T09:00:00.000Z`,
            entry_method: "fallback_code",
            notes: "Fallback scan",
            updated_at: `${configuredEventDate}T09:05:00.000Z`
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
      await expect(response.json()).resolves.toMatchObject({
        records: [
          {
            scanId: "scan-fallback",
            entryMethod: "fallback_code"
          },
          {
            scanId: "scan-qr",
            entryMethod: "qr"
          }
        ]
      });
    });

    it("exports CSV with the locked header and row shape without entryMethod", async () => {
      const database = createMockD1Database({
        scanRecords: [
          {
            scan_id: "scan-export-method",
            student_id: student1.person_id,
            mentor_id: mentor1.person_id,
            event_date: configuredEventDate,
            scanned_at: `${configuredEventDate}T08:00:00.000Z`,
            entry_method: "fallback_code",
            notes: "Fallback note",
            updated_at: `${configuredEventDate}T08:05:00.000Z`
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
      const csvText = await response.text();
      const lines = csvText.split("\n");
      // Header must be exactly the locked contract
      expect(lines[0]).toBe("student name,secret id,mentor scanned,date,notes");
      // Row must match expected format without entryMethod
      expect(lines[1]).toBe(exportLine(student1, mentor1, configuredEventDate, "Fallback note"));
    });

    it("admin edit/delete/reassign still work for fallback-created records", async () => {
      const database = createMockD1Database({
        scanRecords: [
          {
            scan_id: "scan-fallback-edit",
            student_id: student1.person_id,
            mentor_id: mentor1.person_id,
            event_date: configuredEventDate,
            scanned_at: `${configuredEventDate}T08:00:00.000Z`,
            entry_method: "fallback_code",
            notes: "Original fallback note",
            updated_at: `${configuredEventDate}T08:05:00.000Z`
          }
        ]
      });
      const env = createEnv(database);
      const fallbackUpdatedAt = `${configuredEventDate}T11:00:00.000Z`;

      // Edit notes on fallback record with frozen time matching the record's date
      await withFrozenTime(fallbackUpdatedAt, async () => {
        // First patch - update the record
        const patchResponse = await fetchAdminApi(
          "/records/scan-fallback-edit",
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ notes: "Edited fallback note" })
          },
          env
        );

        expect(patchResponse.status).toBe(200);
        await expect(patchResponse.json()).resolves.toMatchObject({
          scanId: "scan-fallback-edit",
          notes: "Edited fallback note",
          entryMethod: "fallback_code"
        });

        // Verify record still appears in records - must use date filter
        const recordsResponse = await fetchAdminApi(
          `/records?startDate=${configuredEventDate}&endDate=${configuredEventDate}`,
          undefined,
          env
        );
        expect(recordsResponse.status).toBe(200);
        await expect(recordsResponse.json()).resolves.toMatchObject({
          records: [
            {
              scanId: "scan-fallback-edit",
              notes: "Edited fallback note",
              entryMethod: "fallback_code"
            }
          ]
        });
      });
    });
  });
});
