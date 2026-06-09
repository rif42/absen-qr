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
            sr.scan_id,
            sr.from_id,
            from_person.display_name AS from_name,
            sr.to_id,
            to_person.display_name AS to_name,
            sr.event_date,
            sr.scanned_at,
            sr.notes,
            sr.updated_at
          FROM scan_records AS sr
          JOIN people AS from_person
            ON from_person.person_id = sr.from_id
          JOIN people AS to_person
            ON to_person.person_id = sr.to_id
          WHERE sr.event_date >= ?1
            AND sr.event_date <= ?2
          ORDER BY sr.scanned_at DESC, sr.scan_id DESC
        `
      )
      .bind(rangeStartDate, rangeEndDate)
      .all<{
        scan_id: string;
        from_id: string;
        from_name: string;
        to_id: string;
        to_name: string;
        event_date: string;
        scanned_at: string;
        notes: string;
        updated_at: string;
      }>();

    expect(records.results).toMatchObject([
      {
        scan_id: "scan-admin-zeta",
        from_id: student2.person_id,
        from_name: student2.display_name,
        to_id: mentor2.person_id,
        to_name: mentor2.display_name,
        event_date: rangeEndDate,
        scanned_at: `${rangeEndDate}T09:00:00.000Z`,
        notes: "Zeta note",
        updated_at: `${rangeEndDate}T09:10:00.000Z`
      },
      {
        scan_id: "scan-admin-alpha",
        from_id: student1.person_id,
        from_name: student1.display_name,
        to_id: mentor1.person_id,
        to_name: mentor1.display_name,
        event_date: rangeEndDate,
        scanned_at: `${rangeEndDate}T09:00:00.000Z`,
        notes: "Alpha note",
        updated_at: `${rangeEndDate}T09:05:00.000Z`
      },
      {
        scan_id: "scan-admin-conflict-source",
        from_id: student2.person_id,
        from_name: student2.display_name,
        to_id: mentor1.person_id,
        to_name: mentor1.display_name,
        event_date: rangeEndDate,
        scanned_at: `${rangeEndDate}T08:30:00.000Z`,
        notes: "Conflict candidate",
        updated_at: `${rangeEndDate}T08:30:00.000Z`
      },
      {
        scan_id: "scan-admin-delete-target",
        from_id: student1.person_id,
        from_name: student1.display_name,
        to_id: mentor2.person_id,
        to_name: mentor2.display_name,
        event_date: rangeEndDate,
        scanned_at: `${rangeEndDate}T07:00:00.000Z`,
        notes: "Delete me",
        updated_at: `${rangeEndDate}T07:00:00.000Z`
      },
      {
        scan_id: "scan-admin-early",
        from_id: student3.person_id,
        from_name: student3.display_name,
        to_id: mentor3.person_id,
        to_name: mentor3.display_name,
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
            from_person.display_name AS from_name,
            from_person.role AS from_role,
            to_person.display_name AS to_name,
            to_person.role AS to_role,
            sr.event_date,
            sr.notes,
            sr.entry_method
          FROM scan_records AS sr
          JOIN people AS from_person
            ON from_person.person_id = sr.from_id
          JOIN people AS to_person
            ON to_person.person_id = sr.to_id
          WHERE sr.event_date >= ?1
            AND sr.event_date <= ?2
          ORDER BY sr.scanned_at ASC, sr.scan_id ASC
        `
      )
      .bind(rangeStartDate, rangeEndDate)
      .all<{
        from_name: string;
        from_role: string;
        to_name: string;
        to_role: string;
        event_date: string;
        notes: string;
        entry_method: string;
      }>();

    expect(rows.results.map((row) => row.from_name)).toEqual([
      student3.display_name,
      student1.display_name,
      student2.display_name,
      student1.display_name,
      student2.display_name
    ]);
    expect(rows.results.map((row) => row.to_name)).toEqual([
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
            sr.scan_id,
            sr.from_id,
            from_person.display_name AS from_name,
            sr.to_id,
            to_person.display_name AS to_name,
            sr.event_date,
            sr.scanned_at,
            sr.notes,
            sr.updated_at
          FROM scan_records AS sr
          JOIN people AS from_person
            ON from_person.person_id = sr.from_id
          JOIN people AS to_person
            ON to_person.person_id = sr.to_id
          WHERE sr.scan_id = ?1
          LIMIT 1
        `
      )
      .bind("scan-admin-alpha")
      .first<{
        scan_id: string;
        from_id: string;
        from_name: string;
        to_id: string;
        to_name: string;
        notes: string;
      }>();

    expect(record).toMatchObject({
      scan_id: "scan-admin-alpha",
      from_id: student1.person_id,
      from_name: student1.display_name,
      to_id: mentor1.person_id,
      to_name: mentor1.display_name,
      notes: "Alpha note"
    });
  });

  it("applies last-write-wins admin updates to the existing record", async () => {
    const db = createAdminMockDatabase();

    await db
      .prepare(
        `
          UPDATE scan_records
          SET notes = ?1, from_id = ?2, to_id = ?3, updated_at = ?4
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
          from_id: student3.person_id,
          to_id: mentor3.person_id,
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
            SET from_id = ?1, to_id = ?2, updated_at = ?3
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
      "UNIQUE constraint failed: scan_records.from_id, scan_records.to_id, scan_records.event_date"
    );

    expect(readMockD1State(db).scanRecords).toMatchObject(
      expect.arrayContaining([
        expect.objectContaining({
          scan_id: "scan-admin-conflict-source",
          from_id: student2.person_id,
          to_id: mentor1.person_id,
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
