import { describe, expect, it } from "vitest";

import { createMockD1Database, readMockD1State } from "../support/mock-d1";
import {
  REAL_MENTORS,
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
        student_id: student3.person_id,
        mentor_id: mentor3.person_id,
        event_date: rangeStartDate,
        scanned_at: `${rangeStartDate}T08:00:00.000Z`,
        notes: "Early note",
        updated_at: `${rangeStartDate}T08:05:00.000Z`
      },
      {
        scan_id: "scan-admin-alpha",
        student_id: student1.person_id,
        mentor_id: mentor1.person_id,
        event_date: rangeEndDate,
        scanned_at: `${rangeEndDate}T09:00:00.000Z`,
        notes: "Alpha note",
        updated_at: `${rangeEndDate}T09:05:00.000Z`
      },
      {
        scan_id: "scan-admin-zeta",
        student_id: student2.person_id,
        mentor_id: mentor2.person_id,
        event_date: rangeEndDate,
        scanned_at: `${rangeEndDate}T09:00:00.000Z`,
        notes: "Zeta note",
        updated_at: `${rangeEndDate}T09:10:00.000Z`
      },
      {
        scan_id: "scan-admin-conflict-source",
        student_id: student2.person_id,
        mentor_id: mentor1.person_id,
        event_date: rangeEndDate,
        scanned_at: `${rangeEndDate}T08:30:00.000Z`,
        notes: "Conflict candidate",
        updated_at: `${rangeEndDate}T08:30:00.000Z`
      },
      {
        scan_id: "scan-admin-delete-target",
        student_id: student1.person_id,
        mentor_id: mentor2.person_id,
        event_date: rangeEndDate,
        scanned_at: `${rangeEndDate}T07:00:00.000Z`,
        notes: "Delete me",
        updated_at: `${rangeEndDate}T07:00:00.000Z`
      },
      {
        scan_id: "scan-admin-other-day",
        student_id: student1.person_id,
        mentor_id: mentor1.person_id,
        event_date: "2099-01-01",
        scanned_at: "2099-01-01T10:00:00.000Z",
        notes: "Ignore me",
        updated_at: "2099-01-01T10:00:00.000Z"
      }
    ]
  });
}

describe("mock D1 admin query shapes", () => {
  it("lists people by role alphabetically for admin lookup options", async () => {
    const db = createAdminMockDatabase();

    const students = await db
      .prepare(
        `
          SELECT person_id, display_name, role, secret_id, secret_path_token
          FROM people
          WHERE role = ?1
          ORDER BY display_name ASC
        `
      )
      .bind("student")
      .all<{
        person_id: string;
        display_name: string;
      }>();

    expect(students.results.map((student) => student.display_name)).toEqual(
      REAL_STUDENTS_BY_NAME.map((student) => student.display_name)
    );
  });

  it("returns joined admin record rows newest first for the event day", async () => {
    const db = createAdminMockDatabase();

    const records = await db
      .prepare(
        `
          SELECT
            scan_records.scan_id,
            scan_records.student_id,
            student.display_name AS student_name,
            student.secret_id AS student_secret_id,
            scan_records.mentor_id,
            mentor.display_name AS mentor_name,
            scan_records.event_date,
            scan_records.scanned_at,
            scan_records.notes,
            scan_records.updated_at
          FROM scan_records
          JOIN people AS student
            ON student.person_id = scan_records.student_id
           AND student.role = 'student'
          JOIN people AS mentor
            ON mentor.person_id = scan_records.mentor_id
           AND mentor.role = 'mentor'
          WHERE scan_records.event_date >= ?1
            AND scan_records.event_date <= ?2
          ORDER BY scan_records.scanned_at DESC, scan_records.scan_id DESC
        `
      )
      .bind(rangeStartDate, rangeEndDate)
      .all<{
        scan_id: string;
        student_id: string;
        student_name: string;
        student_secret_id: string;
        mentor_id: string;
        mentor_name: string;
        event_date: string;
        scanned_at: string;
        notes: string;
        updated_at: string;
      }>();

    expect(records.results).toMatchObject([
      {
        scan_id: "scan-admin-zeta",
        student_id: student2.person_id,
        student_name: student2.display_name,
        student_secret_id: student2.secret_id,
        mentor_id: mentor2.person_id,
        mentor_name: mentor2.display_name,
        event_date: rangeEndDate,
        scanned_at: `${rangeEndDate}T09:00:00.000Z`,
        notes: "Zeta note",
        updated_at: `${rangeEndDate}T09:10:00.000Z`
      },
      {
        scan_id: "scan-admin-alpha",
        student_id: student1.person_id,
        student_name: student1.display_name,
        student_secret_id: student1.secret_id,
        mentor_id: mentor1.person_id,
        mentor_name: mentor1.display_name,
        event_date: rangeEndDate,
        scanned_at: `${rangeEndDate}T09:00:00.000Z`,
        notes: "Alpha note",
        updated_at: `${rangeEndDate}T09:05:00.000Z`
      },
      {
        scan_id: "scan-admin-conflict-source",
        student_id: student2.person_id,
        student_name: student2.display_name,
        student_secret_id: student2.secret_id,
        mentor_id: mentor1.person_id,
        mentor_name: mentor1.display_name,
        event_date: rangeEndDate,
        scanned_at: `${rangeEndDate}T08:30:00.000Z`,
        notes: "Conflict candidate",
        updated_at: `${rangeEndDate}T08:30:00.000Z`
      },
      {
        scan_id: "scan-admin-delete-target",
        student_id: student1.person_id,
        student_name: student1.display_name,
        student_secret_id: student1.secret_id,
        mentor_id: mentor2.person_id,
        mentor_name: mentor2.display_name,
        event_date: rangeEndDate,
        scanned_at: `${rangeEndDate}T07:00:00.000Z`,
        notes: "Delete me",
        updated_at: `${rangeEndDate}T07:00:00.000Z`
      },
      {
        scan_id: "scan-admin-early",
        student_id: student3.person_id,
        student_name: student3.display_name,
        student_secret_id: student3.secret_id,
        mentor_id: mentor3.person_id,
        mentor_name: mentor3.display_name,
        event_date: rangeStartDate,
        scanned_at: `${rangeStartDate}T08:00:00.000Z`,
        notes: "Early note",
        updated_at: `${rangeStartDate}T08:05:00.000Z`
      }
    ]);
  });

  it("returns export rows in chronological order for the event day", async () => {
    const db = createAdminMockDatabase();

    const rows = await db
      .prepare(
        `
          SELECT
            student.display_name AS student_name,
            student.secret_id AS student_secret_id,
            mentor.display_name AS mentor_name,
            scan_records.event_date,
            scan_records.notes
          FROM scan_records
          JOIN people AS student
            ON student.person_id = scan_records.student_id
           AND student.role = 'student'
          JOIN people AS mentor
            ON mentor.person_id = scan_records.mentor_id
           AND mentor.role = 'mentor'
          WHERE scan_records.event_date >= ?1
            AND scan_records.event_date <= ?2
          ORDER BY scan_records.scanned_at ASC, scan_records.scan_id ASC
        `
      )
      .bind(rangeStartDate, rangeEndDate)
      .all<{
        student_name: string;
        student_secret_id: string;
        mentor_name: string;
        event_date: string;
        notes: string;
      }>();

    expect(rows.results.map((row) => row.student_name)).toEqual([
      student3.display_name,
      student1.display_name,
      student2.display_name,
      student1.display_name,
      student2.display_name
    ]);
    expect(rows.results.map((row) => row.mentor_name)).toEqual([
      mentor3.display_name,
      mentor2.display_name,
      mentor1.display_name,
      mentor1.display_name,
      mentor2.display_name
    ]);
  });

  it("returns a joined admin row by scan id for patch preparation", async () => {
    const db = createAdminMockDatabase();

    const record = await db
      .prepare(
        `
          SELECT
            scan_records.scan_id,
            scan_records.student_id,
            student.display_name AS student_name,
            student.secret_id AS student_secret_id,
            scan_records.mentor_id,
            mentor.display_name AS mentor_name,
            scan_records.event_date,
            scan_records.scanned_at,
            scan_records.notes,
            scan_records.updated_at
          FROM scan_records
          JOIN people AS student
            ON student.person_id = scan_records.student_id
           AND student.role = 'student'
          JOIN people AS mentor
            ON mentor.person_id = scan_records.mentor_id
           AND mentor.role = 'mentor'
          WHERE scan_records.scan_id = ?1
          LIMIT 1
        `
      )
      .bind("scan-admin-alpha")
      .first<{
        scan_id: string;
        student_id: string;
        student_name: string;
        student_secret_id: string;
        mentor_id: string;
        mentor_name: string;
        notes: string;
      }>();

    expect(record).toMatchObject({
      scan_id: "scan-admin-alpha",
      student_id: student1.person_id,
      student_name: student1.display_name,
      student_secret_id: student1.secret_id,
      mentor_id: mentor1.person_id,
      mentor_name: mentor1.display_name,
      notes: "Alpha note"
    });
  });

  it("applies last-write-wins admin updates to the existing record", async () => {
    const db = createAdminMockDatabase();

    await db
      .prepare(
        `
          UPDATE scan_records
          SET notes = ?1, student_id = ?2, mentor_id = ?3, updated_at = ?4
          WHERE scan_id = ?5
        `
      )
      .bind(
        "Updated by admin",
        student3.person_id,
        mentor3.person_id,
        `${configuredEventDate}T11:00:00.000Z`,
        "scan-admin-conflict-source"
      )
      .run();

    expect(readMockD1State(db).scanRecords).toMatchObject(
      expect.arrayContaining([
        expect.objectContaining({
          scan_id: "scan-admin-conflict-source",
          student_id: student3.person_id,
          mentor_id: mentor3.person_id,
          notes: "Updated by admin",
          updated_at: `${configuredEventDate}T11:00:00.000Z`
        })
      ])
    );
  });

  it("simulates uniqueness conflicts for admin reassignment updates", async () => {
    const db = createAdminMockDatabase();

    await expect(
      db
        .prepare(
          `
            UPDATE scan_records
            SET student_id = ?1, mentor_id = ?2, updated_at = ?3
            WHERE scan_id = ?4
          `
        )
        .bind(
          student1.person_id,
          mentor1.person_id,
          `${configuredEventDate}T12:00:00.000Z`,
          "scan-admin-conflict-source"
        )
        .run()
    ).rejects.toThrow(
      "UNIQUE constraint failed: scan_records.student_id, scan_records.mentor_id, scan_records.event_date"
    );

    expect(readMockD1State(db).scanRecords).toMatchObject(
      expect.arrayContaining([
        expect.objectContaining({
          scan_id: "scan-admin-conflict-source",
          student_id: student2.person_id,
          mentor_id: mentor1.person_id,
          updated_at: `${configuredEventDate}T08:30:00.000Z`
        })
      ])
    );
  });

  it("hard deletes scan records for admin cleanup flows", async () => {
    const db = createAdminMockDatabase();

    await db
      .prepare(
        `
          DELETE FROM scan_records
          WHERE scan_id = ?1
        `
      )
      .bind("scan-admin-delete-target")
      .run();

    expect(readMockD1State(db).scanRecords.map((record) => record.scan_id)).not.toContain("scan-admin-delete-target");
    expect(readMockD1State(db).scanRecords).toHaveLength(5);
  });
});
