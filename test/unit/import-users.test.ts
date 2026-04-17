import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { REAL_ROSTER } from "../support/real-roster";

type ParsedUserRow = {
  rowNumber: number;
  csvName: string;
  csvRole: string;
  display_name: string;
  role: "student" | "mentor";
  normalized_name: string;
  normalized_key: string;
};

type SelectedRosterRow = {
  role: "student" | "mentor";
  person_id: string;
  secret_id: string;
  secret_path_token: string;
};

type ImportUsersModule = {
  parseUserCsv(csvText: string): ParsedUserRow[];
  buildCanonicalRoster(rows: ParsedUserRow[], baseUrl: string): {
    selectedRows: Array<SelectedRosterRow & Record<string, unknown>>;
    skippedRows: Array<Record<string, unknown>>;
  };
  runImportUsers(options: {
    csv: string;
    baseUrl: string;
    dryRun?: boolean;
    output: string;
    writeCsv: boolean;
    backupRemote?: boolean;
    applyRemote: boolean;
  }, dependencies?: {
    cwd?: string;
    now?: () => string;
    runCommand?: (args: string[]) => Promise<{
      stdout?: string;
      stderr?: string;
      parsedJson?: unknown;
    }>;
  }): Promise<{ artifact: { summary: Record<string, number> } }>;
};

async function loadImportUsersModule(): Promise<ImportUsersModule> {
  const modulePath = "../../scripts/import-users.mjs";
  return (await import(/* @vite-ignore */ modulePath)) as ImportUsersModule;
}

const tempDirectories: string[] = [];

async function createTempDirectory() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "absen-qr-import-users-"));
  tempDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

function escapeCsvField(value: string) {
  if (!/[",\n\r]/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '""')}"`;
}

function buildRosterCsv() {
  return [
    "Name,Role",
    ...REAL_ROSTER.map((person) => [escapeCsvField(person.display_name), person.role].join(","))
  ].join("\n");
}

type RemotePeopleRow = {
  person_id: string;
  display_name: string;
  role: "student" | "mentor";
  secret_id: string;
  secret_path_token: string;
};

function makeJsonResult(results: unknown[]) {
  return [
    {
      results,
      success: true,
      meta: {}
    }
  ];
}

describe("import-users", () => {
  it("adds deterministic suffixes for same-role slug collisions", async () => {
    const { buildCanonicalRoster, parseUserCsv } = await loadImportUsersModule();
    const rows = parseUserCsv([
      "Name,Role",
      '"Anne-Marie",Student',
      '"Anne Marie",Student',
      '"Anne   Marie",Student',
      '"Anne Marie",Mentor'
    ].join("\n"));

    const roster = buildCanonicalRoster(rows, "https://absen-qr.rif42.workers.dev");

    expect(roster.selectedRows.map((row: {
      role: string;
      person_id: string;
      secret_id: string;
      secret_path_token: string;
    }) => ({
      role: row.role,
      person_id: row.person_id,
      secret_id: row.secret_id,
      secret_path_token: row.secret_path_token
    }))).toEqual([
      {
        role: "student",
        person_id: "student-anne-marie",
        secret_id: "student-secret-anne-marie",
        secret_path_token: "student-anne-marie"
      },
      {
        role: "student",
        person_id: "student-anne-marie-2",
        secret_id: "student-secret-anne-marie-2",
        secret_path_token: "student-anne-marie-2"
      },
      {
        role: "mentor",
        person_id: "mentor-anne-marie",
        secret_id: "mentor-secret-anne-marie",
        secret_path_token: "mentor-anne-marie"
      }
    ]);

    expect(roster.skippedRows).toEqual([
      expect.objectContaining({
        rowNumber: 4,
        reason: "duplicate",
        duplicate_of_row: 3
      })
    ]);
  });

  it("writes byte-identical dry-run artifacts across repeated runs", async () => {
    const { runImportUsers } = await loadImportUsersModule();
    const tempDirectory = await createTempDirectory();
    const csvPath = path.join(tempDirectory, "users.csv");
    const firstOutputPath = path.join(tempDirectory, "first.json");
    const secondOutputPath = path.join(tempDirectory, "second.json");

    await writeFile(
      csvPath,
      [
        "Name,Role",
        '"Mentor One",Mentor',
        '"Student One",Student',
        '"Student One",Student',
        '"Mentor Two",Mentor',
        '"Student Two",Student'
      ].join("\n"),
      "utf8"
    );

    await runImportUsers({
      csv: csvPath,
      baseUrl: "https://absen-qr.rif42.workers.dev",
      dryRun: true,
      output: firstOutputPath,
      writeCsv: false,
      applyRemote: false
    });

    await runImportUsers({
      csv: csvPath,
      baseUrl: "https://absen-qr.rif42.workers.dev",
      dryRun: true,
      output: secondOutputPath,
      writeCsv: false,
      applyRemote: false
    });

    const [firstArtifact, secondArtifact] = await Promise.all([
      readFile(firstOutputPath, "utf8"),
      readFile(secondOutputPath, "utf8")
    ]);

    expect(firstArtifact).toBe(secondArtifact);
    expect(JSON.parse(firstArtifact)).toMatchObject({
      summary: {
        selected_students: 2,
        selected_mentors: 2,
        skipped_duplicates: 1
      }
    });
  });

  it("rewrites the source csv deterministically with generated metadata", async () => {
    const { runImportUsers } = await loadImportUsersModule();
    const tempDirectory = await createTempDirectory();
    const csvPath = path.join(tempDirectory, "userlist.csv");
    const outputPath = path.join(tempDirectory, "artifact.json");

    await writeFile(
      csvPath,
      [
        "Name,Role",
        '"Anne, Marie",Student',
        '"Anne, Marie",Student',
        '"Mentor One",Mentor'
      ].join("\n"),
      "utf8"
    );

    await runImportUsers({
      csv: csvPath,
      baseUrl: "https://absen-qr.rif42.workers.dev",
      dryRun: true,
      output: outputPath,
      writeCsv: true,
      applyRemote: false
    });

    const rewrittenCsv = await readFile(csvPath, "utf8");

    expect(rewrittenCsv).toBe([
      "Name,Role,Selected,Status,Person ID,Secret ID,Secret Token,Secret Link,Selection Order",
      '"Anne, Marie",Student,YES,selected,student-anne-marie,student-secret-anne-marie,student-anne-marie,https://absen-qr.rif42.workers.dev/student/student-anne-marie,1',
      '"Anne, Marie",Student,NO,duplicate,,,,,',
      "Mentor One,Mentor,YES,selected,mentor-mentor-one,mentor-secret-mentor-one,mentor-mentor-one,https://absen-qr.rif42.workers.dev/mentor/mentor-mentor-one,2"
    ].join("\n"));
  });

  it("rejects invalid roles and malformed csv rows during parsing", async () => {
    const { parseUserCsv } = await loadImportUsersModule();

    expect(() =>
      parseUserCsv([
        "Name,Role",
        '"Valid Name",Student',
        '"Invalid Role",Admin'
      ].join("\n"))
    ).toThrow('Row 3: Unsupported role "Admin".');

    expect(() =>
      parseUserCsv([
        "Name,Role",
        '"Broken quote,Student'
      ].join("\n"))
    ).toThrow();
  });

  it("backs up remote tables before reset-and-apply and records machine-readable evidence", async () => {
    const { runImportUsers } = await loadImportUsersModule();
    const tempDirectory = await createTempDirectory();
    const csvPath = path.join(tempDirectory, "userlist.csv");
    const outputPath = path.join(tempDirectory, "apply-evidence.json");
    const commands: string[][] = [];
    let applySql = "";
    const remoteScanRecords = [
      {
        scan_id: "scan-001",
        student_id: REAL_ROSTER.find((person) => person.role === "student")?.person_id,
        mentor_id: REAL_ROSTER.find((person) => person.role === "mentor")?.person_id,
        event_date: "2026-04-17",
        scanned_at: "2026-04-17T01:23:45.000Z",
        notes: "Existing note",
        updated_at: "2026-04-17T01:23:45.000Z"
      },
      {
        scan_id: "scan-002",
        student_id: REAL_ROSTER.filter((person) => person.role === "student")[1]?.person_id,
        mentor_id: REAL_ROSTER.filter((person) => person.role === "mentor")[1]?.person_id,
        event_date: "2026-04-17",
        scanned_at: "2026-04-17T02:34:56.000Z",
        notes: "Second note",
        updated_at: "2026-04-17T02:34:56.000Z"
      }
    ];

    await writeFile(csvPath, buildRosterCsv(), "utf8");

    const staleRemotePeople: RemotePeopleRow[] = [
      {
        ...REAL_ROSTER[0],
        secret_id: `${REAL_ROSTER[0].secret_id}-stale`,
        secret_path_token: `${REAL_ROSTER[0].secret_path_token}-stale`
      }
    ];

    await runImportUsers(
      {
        csv: csvPath,
        baseUrl: "https://absen-qr.rif42.workers.dev",
        output: outputPath,
        writeCsv: false,
        backupRemote: true,
        applyRemote: true
      },
      {
        cwd: process.cwd(),
        now: () => "2026-04-17T12:34:56.000Z",
        async runCommand(args) {
          commands.push(args);

          const sql = args.at(-1) ?? "";

          if (args[0] === "d1" && args[1] === "execute") {
            if (sql.includes("FROM sqlite_master")) {
              return { parsedJson: makeJsonResult([
                { name: "people", type: "table" },
                { name: "scan_records", type: "table" }
              ]) };
            }

            if (sql.includes("SELECT person_id, display_name, role, secret_id, secret_path_token FROM people ORDER BY person_id;")) {
              return { parsedJson: makeJsonResult(staleRemotePeople) };
            }

            if (sql.includes("SELECT COUNT(*) AS people_count FROM people;")) {
              return { parsedJson: makeJsonResult([{ people_count: staleRemotePeople.length }]) };
            }

            if (sql.includes("SELECT COUNT(*) AS scan_records_count FROM scan_records;")) {
              return { parsedJson: makeJsonResult([{ scan_records_count: 2 }]) };
            }

            if (sql.includes("SELECT scan_id, student_id, mentor_id, event_date, scanned_at, notes, updated_at FROM scan_records ORDER BY event_date, scanned_at, scan_id;")) {
              return { parsedJson: makeJsonResult(remoteScanRecords) };
            }

            if (args.includes("--file")) {
              const sqlPath = args[args.indexOf("--file") + 1];
              applySql = await readFile(sqlPath, "utf8");
              return { parsedJson: makeJsonResult([]) };
            }

            if (sql.includes("SELECT role, COUNT(*) AS count FROM people GROUP BY role ORDER BY role;")) {
              return { parsedJson: makeJsonResult([
                { role: "mentor", count: 10 },
                { role: "student", count: 10 }
              ]) };
            }

            if (sql.includes("SELECT COUNT(*) AS count FROM scan_records;")) {
              return { parsedJson: makeJsonResult([{ count: 0 }]) };
            }

            throw new Error(`Unexpected d1 execute args: ${JSON.stringify(args)}`);
          }

          throw new Error(`Unexpected command: ${JSON.stringify(args)}`);
        }
      }
    );

    expect(commands.map((args) => args.join(" "))).toEqual([
      expect.stringContaining("d1 execute absen-qr --remote --config wrangler.jsonc --json --command SELECT name, type FROM sqlite_master"),
      expect.stringContaining("d1 execute absen-qr --remote --config wrangler.jsonc --json --command SELECT person_id, display_name, role, secret_id, secret_path_token FROM people ORDER BY person_id;"),
      expect.stringContaining("d1 execute absen-qr --remote --config wrangler.jsonc --json --command SELECT COUNT(*) AS people_count FROM people;"),
      expect.stringContaining("d1 execute absen-qr --remote --config wrangler.jsonc --json --command SELECT COUNT(*) AS scan_records_count FROM scan_records;"),
      expect.stringContaining("d1 execute absen-qr --remote --config wrangler.jsonc --json --command SELECT scan_id, student_id, mentor_id, event_date, scanned_at, notes, updated_at FROM scan_records ORDER BY event_date, scanned_at, scan_id;"),
      expect.stringContaining("d1 execute absen-qr --remote --config wrangler.jsonc --json --file"),
      expect.stringContaining("d1 execute absen-qr --remote --config wrangler.jsonc --json --command SELECT role, COUNT(*) AS count FROM people GROUP BY role ORDER BY role;"),
      expect.stringContaining("d1 execute absen-qr --remote --config wrangler.jsonc --json --command SELECT COUNT(*) AS count FROM scan_records;")
    ]);
    expect(applySql).toContain("DELETE FROM scan_records;");
    expect(applySql).toContain("DELETE FROM people;");
    expect(applySql.indexOf("DELETE FROM scan_records;")).toBeLessThan(applySql.indexOf("DELETE FROM people;"));
    expect(applySql).toContain("INSERT INTO people (person_id, display_name, role, secret_id, secret_path_token) VALUES");
    expect(applySql).toContain(`('${REAL_ROSTER[0].person_id}', '${REAL_ROSTER[0].display_name.replace(/'/g, "''")}', 'student'`);

    const evidence = JSON.parse(await readFile(outputPath, "utf8"));

    expect(evidence).toMatchObject({
      mode: "apply-remote",
      d1: {
        database_name: "absen-qr",
        binding: "DB"
      },
      remote_apply: {
        changed: true,
        backups: {
          people: expect.stringContaining("people-pre-apply.json"),
          scan_records: expect.stringContaining("scan-records-pre-apply.json")
        },
        pre_apply_counts: {
          people: 1,
          scan_records: 2
        },
        net_changes: {
          deleted_people: 1,
          deleted_scan_records: 2,
          inserted_people: 20,
          token_changes: 1
        },
        post_apply_counts_by_role: {
          mentor: 10,
          student: 10
        },
        post_apply_scan_records_count: 0
      }
    });

    const peopleBackup = JSON.parse(await readFile(evidence.remote_apply.backups.people, "utf8"));
    const scanRecordsBackup = JSON.parse(await readFile(evidence.remote_apply.backups.scan_records, "utf8"));

    expect(peopleBackup.rows).toEqual(staleRemotePeople);
    expect(scanRecordsBackup.rows).toEqual(remoteScanRecords);
  });

  it("reports zero net changes when remote people already match the canonical roster", async () => {
    const { runImportUsers } = await loadImportUsersModule();
    const tempDirectory = await createTempDirectory();
    const csvPath = path.join(tempDirectory, "userlist.csv");
    const outputPath = path.join(tempDirectory, "apply-evidence.json");
    const commands: string[][] = [];

    await writeFile(csvPath, buildRosterCsv(), "utf8");

    await runImportUsers(
      {
        csv: csvPath,
        baseUrl: "https://absen-qr.rif42.workers.dev",
        output: outputPath,
        writeCsv: false,
        backupRemote: true,
        applyRemote: true
      },
      {
        cwd: process.cwd(),
        now: () => "2026-04-17T13:00:00.000Z",
        async runCommand(args) {
          commands.push(args);

          const sql = args.at(-1) ?? "";

          if (args[0] === "d1" && args[1] === "execute") {
            if (sql.includes("FROM sqlite_master")) {
              return { parsedJson: makeJsonResult([
                { name: "people", type: "table" },
                { name: "scan_records", type: "table" }
              ]) };
            }

            if (sql.includes("SELECT person_id, display_name, role, secret_id, secret_path_token FROM people ORDER BY person_id;")) {
              return { parsedJson: makeJsonResult(REAL_ROSTER) };
            }

            if (sql.includes("SELECT COUNT(*) AS people_count FROM people;")) {
              return { parsedJson: makeJsonResult([{ people_count: REAL_ROSTER.length }]) };
            }

            if (sql.includes("SELECT COUNT(*) AS scan_records_count FROM scan_records;")) {
              return { parsedJson: makeJsonResult([{ scan_records_count: 0 }]) };
            }

            throw new Error(`Unexpected command: ${JSON.stringify(args)}`);
          }

          throw new Error(`Unexpected command: ${JSON.stringify(args)}`);
        }
      }
    );

    expect(commands.some((args) => args[1] === "export")).toBe(false);
    expect(commands.some((args) => args.includes("--file"))).toBe(false);

    const evidence = JSON.parse(await readFile(outputPath, "utf8"));

    expect(evidence.remote_apply).toMatchObject({
      changed: false,
      net_changes: {
        deleted_people: 0,
        deleted_scan_records: 0,
        inserted_people: 0,
        token_changes: 0
      },
      rerun_summary: {
        already_canonical: true,
        skipped_apply: true
      }
    });
  });

  it("stops before destructive apply when a remote backup command fails", async () => {
    const { runImportUsers } = await loadImportUsersModule();
    const tempDirectory = await createTempDirectory();
    const csvPath = path.join(tempDirectory, "userlist.csv");
    const outputPath = path.join(tempDirectory, "apply-evidence.json");
    const commands: string[][] = [];

    await writeFile(csvPath, buildRosterCsv(), "utf8");

    await expect(
      runImportUsers(
        {
          csv: csvPath,
          baseUrl: "https://absen-qr.rif42.workers.dev",
          output: outputPath,
          writeCsv: false,
          backupRemote: true,
          applyRemote: true
        },
        {
          cwd: process.cwd(),
          now: () => "2026-04-17T13:30:00.000Z",
          async runCommand(args) {
            commands.push(args);

            const sql = args.at(-1) ?? "";

            if (args[0] === "d1" && args[1] === "execute") {
              if (sql.includes("FROM sqlite_master")) {
                return { parsedJson: makeJsonResult([
                  { name: "people", type: "table" },
                  { name: "scan_records", type: "table" }
                ]) };
              }

              if (sql.includes("SELECT person_id, display_name, role, secret_id, secret_path_token FROM people ORDER BY person_id;")) {
                return { parsedJson: makeJsonResult([{ ...REAL_ROSTER[0] }]) };
              }

              if (sql.includes("SELECT COUNT(*) AS people_count FROM people;")) {
                return { parsedJson: makeJsonResult([{ people_count: 1 }]) };
              }

              if (sql.includes("SELECT COUNT(*) AS scan_records_count FROM scan_records;")) {
                return { parsedJson: makeJsonResult([{ scan_records_count: 0 }]) };
              }

              if (sql.includes("SELECT scan_id, student_id, mentor_id, event_date, scanned_at, notes, updated_at FROM scan_records ORDER BY event_date, scanned_at, scan_id;")) {
                throw new Error("Remote backup failed");
              }
            }

            throw new Error(`Unexpected command: ${JSON.stringify(args)}`);
          }
        }
      )
    ).rejects.toThrow("Remote backup failed");

    expect(commands.some((args) => args.includes("--file"))).toBe(false);
  });
});
