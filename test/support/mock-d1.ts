import type { PersonRecord, ScanRecord } from "../../src/worker/types";

type MockState = {
  people: PersonRecord[];
  scanRecords: ScanRecord[];
  insertScanRecordErrorMessage: string | null;
};

type MockD1Database = D1Database & {
  __mockState: MockState;
};

type QueryResult<T> = {
  results: T[];
  success: true;
  meta: Record<string, unknown>;
};

type StatementExecutor = {
  first<T>(): Promise<T | null>;
  all<T>(): Promise<QueryResult<T>>;
  run(): Promise<{ success: true; meta: Record<string, unknown> }>;
};

const DEFAULT_PEOPLE: PersonRecord[] = [
  {
    person_id: "student-001",
    display_name: "Student Local 01",
    role: "student",
    secret_id: "student-secret-001",
    secret_path_token: "local-student-token-001"
  },
  {
    person_id: "student-002",
    display_name: "Student Local 02",
    role: "student",
    secret_id: "student-secret-002",
    secret_path_token: "local-student-token-002"
  },
  {
    person_id: "student-003",
    display_name: "Student Local 03",
    role: "student",
    secret_id: "student-secret-003",
    secret_path_token: "local-student-token-003"
  },
  {
    person_id: "student-004",
    display_name: "Student Local 04",
    role: "student",
    secret_id: "student-secret-004",
    secret_path_token: "local-student-token-004"
  },
  {
    person_id: "student-005",
    display_name: "Student Local 05",
    role: "student",
    secret_id: "student-secret-005",
    secret_path_token: "local-student-token-005"
  },
  {
    person_id: "mentor-001",
    display_name: "Mentor Local 01",
    role: "mentor",
    secret_id: "mentor-secret-001",
    secret_path_token: "local-mentor-token-001"
  },
  {
    person_id: "mentor-002",
    display_name: "Mentor Local 02",
    role: "mentor",
    secret_id: "mentor-secret-002",
    secret_path_token: "local-mentor-token-002"
  },
  {
    person_id: "mentor-003",
    display_name: "Mentor Local 03",
    role: "mentor",
    secret_id: "mentor-secret-003",
    secret_path_token: "local-mentor-token-003"
  },
  {
    person_id: "mentor-004",
    display_name: "Mentor Local 04",
    role: "mentor",
    secret_id: "mentor-secret-004",
    secret_path_token: "local-mentor-token-004"
  },
  {
    person_id: "mentor-005",
    display_name: "Mentor Local 05",
    role: "mentor",
    secret_id: "mentor-secret-005",
    secret_path_token: "local-mentor-token-005"
  }
];

function cloneState(seed?: Partial<MockState>): MockState {
  return {
    people: (seed?.people ?? DEFAULT_PEOPLE).map((person) => ({ ...person })),
    scanRecords: (seed?.scanRecords ?? []).map((scanRecord) => ({ ...scanRecord })),
    insertScanRecordErrorMessage: seed?.insertScanRecordErrorMessage ?? null
  };
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, " ").trim().toLowerCase();
}

function createQueryResult<T>(results: T[]): QueryResult<T> {
  return {
    results,
    success: true,
    meta: {}
  };
}

function getPersonById(state: MockState, role: PersonRecord["role"], personId: string): PersonRecord | null {
  return state.people.find((person) => person.role === role && person.person_id === personId) ?? null;
}

function buildAdminJoinedRow(state: MockState, scanRecord: ScanRecord) {
  const student = getPersonById(state, "student", scanRecord.student_id);
  const mentor = getPersonById(state, "mentor", scanRecord.mentor_id);

  if (!student || !mentor) {
    return null;
  }

  return {
    ...scanRecord,
    student_name: student.display_name,
    student_secret_id: student.secret_id,
    mentor_name: mentor.display_name
  };
}

function compareScanRecords(left: ScanRecord, right: ScanRecord, direction: "asc" | "desc"): number {
  const scannedAtComparison = left.scanned_at.localeCompare(right.scanned_at);
  const scanIdComparison = left.scan_id.localeCompare(right.scan_id);

  if (direction === "asc") {
    return scannedAtComparison !== 0 ? scannedAtComparison : scanIdComparison;
  }

  return scannedAtComparison !== 0 ? -scannedAtComparison : -scanIdComparison;
}

function getPlaceholderValue(params: unknown[], placeholderIndex: number): unknown {
  return params[placeholderIndex - 1];
}

function extractPlaceholderIndex(sqlFragment: string, pattern: RegExp): number | null {
  const match = sqlFragment.match(pattern);
  return match ? Number(match[1]) : null;
}

function applyAdminScanRecordUpdate(state: MockState, normalizedSql: string, params: unknown[]): void {
  const scanIdPlaceholderIndex = extractPlaceholderIndex(normalizedSql, /where scan_id = \?(\d+)/);

  if (!scanIdPlaceholderIndex) {
    return;
  }

  const scanId = getPlaceholderValue(params, scanIdPlaceholderIndex);

  if (typeof scanId !== "string") {
    return;
  }

  const scanRecord = state.scanRecords.find((candidate) => candidate.scan_id === scanId);

  if (!scanRecord) {
    return;
  }

  const setClause = normalizedSql.slice(
    normalizedSql.indexOf("set ") + 4,
    normalizedSql.indexOf(" where ")
  );
  const assignments = setClause.split(", ");

  const nextValues: ScanRecord = { ...scanRecord };

  for (const assignment of assignments) {
    const [column, placeholder] = assignment.split(" = ");
    const placeholderIndex = Number(placeholder.replace("?", ""));
    const value = getPlaceholderValue(params, placeholderIndex);

    if (column === "notes" && typeof value === "string") {
      nextValues.notes = value;
    }

    if (column === "student_id" && typeof value === "string") {
      nextValues.student_id = value;
    }

    if (column === "mentor_id" && typeof value === "string") {
      nextValues.mentor_id = value;
    }

    if (column === "updated_at" && typeof value === "string") {
      nextValues.updated_at = value;
    }
  }

  const conflictingRecord = state.scanRecords.find(
    (candidate) =>
      candidate.scan_id !== scanRecord.scan_id &&
      candidate.student_id === nextValues.student_id &&
      candidate.mentor_id === nextValues.mentor_id &&
      candidate.event_date === nextValues.event_date
  );

  if (conflictingRecord) {
    throw new Error(
      "UNIQUE constraint failed: scan_records.student_id, scan_records.mentor_id, scan_records.event_date"
    );
  }

  scanRecord.student_id = nextValues.student_id;
  scanRecord.mentor_id = nextValues.mentor_id;
  scanRecord.notes = nextValues.notes;
  scanRecord.updated_at = nextValues.updated_at;
}

function createStatement(state: MockState, sql: string): { bind: (...params: unknown[]) => StatementExecutor } {
  const normalizedSql = normalizeSql(sql);

  return {
    bind(...params: unknown[]): StatementExecutor {
      return {
        async first<T>(): Promise<T | null> {
          if (normalizedSql.includes("from people") && normalizedSql.includes("where role = ?1 and secret_path_token = ?2")) {
            const [role, secretToken] = params as [PersonRecord["role"], string];
            const person = state.people.find(
              (candidate) => candidate.role === role && candidate.secret_path_token === secretToken
            );

            return (person ?? null) as T | null;
          }

          if (normalizedSql.includes("from people") && normalizedSql.includes("where role = ?1 and person_id = ?2")) {
            const [role, personId] = params as [PersonRecord["role"], string];
            const person = state.people.find(
              (candidate) => candidate.role === role && candidate.person_id === personId
            );

            return (person ?? null) as T | null;
          }

          if (normalizedSql.includes("from scan_records") && normalizedSql.includes("where mentor_id = ?1 and scan_id = ?2")) {
            const [mentorId, scanId] = params as [string, string];
            const scanRecord = state.scanRecords.find(
              (candidate) => candidate.mentor_id === mentorId && candidate.scan_id === scanId
            );

            return (scanRecord ?? null) as T | null;
          }

          if (normalizedSql.includes("from scan_records") && normalizedSql.includes("where scan_records.scan_id = ?1")) {
            const [scanId] = params as [string];
            const scanRecord = state.scanRecords.find((candidate) => candidate.scan_id === scanId);

            if (!scanRecord) {
              return null;
            }

            if (normalizedSql.includes("join people as student") && normalizedSql.includes("join people as mentor")) {
              return buildAdminJoinedRow(state, scanRecord) as T | null;
            }

            return scanRecord as T;
          }

          if (normalizedSql.includes("from scan_records") && normalizedSql.includes("where scan_id = ?1")) {
            const [scanId] = params as [string];
            const scanRecord = state.scanRecords.find((candidate) => candidate.scan_id === scanId);

            return (scanRecord ?? null) as T | null;
          }

          throw new Error(`Unsupported first() SQL in mock D1: ${sql}`);
        },
        async all<T>(): Promise<QueryResult<T>> {
          if (
            normalizedSql.includes("from people") &&
            normalizedSql.includes("where role = ?1") &&
            normalizedSql.includes("order by display_name asc")
          ) {
            const [role] = params as [PersonRecord["role"]];
            const results = state.people
              .filter((person) => person.role === role)
              .sort((left, right) => left.display_name.localeCompare(right.display_name));

            return createQueryResult(results as T[]);
          }

          if (
            normalizedSql.includes("from scan_records") &&
            normalizedSql.includes("where student_id = ?1 and event_date = ?2")
          ) {
            const [studentId, eventDate] = params as [string, string];
            const results = state.scanRecords
              .filter((scanRecord) => scanRecord.student_id === studentId && scanRecord.event_date === eventDate)
              .sort((left, right) => right.scanned_at.localeCompare(left.scanned_at));

            return createQueryResult(results as T[]);
          }

          if (
            normalizedSql.includes("from scan_records") &&
            normalizedSql.includes("where mentor_id = ?1 and event_date = ?2")
          ) {
            const [mentorId, eventDate] = params as [string, string];
            const results = state.scanRecords
              .filter((scanRecord) => scanRecord.mentor_id === mentorId && scanRecord.event_date === eventDate)
              .sort((left, right) => right.scanned_at.localeCompare(left.scanned_at));

            return createQueryResult(results as T[]);
          }

          if (
            normalizedSql.includes("from scan_records") &&
            normalizedSql.includes("event_date = ?1") &&
            !normalizedSql.includes("where student_id = ?1 and event_date = ?2") &&
            !normalizedSql.includes("where mentor_id = ?1 and event_date = ?2")
          ) {
            const [eventDate] = params as [string];
            const records = state.scanRecords
              .filter((scanRecord) => scanRecord.event_date === eventDate)
              .sort((left, right) => {
                if (normalizedSql.includes("order by scan_records.scanned_at asc, scan_records.scan_id asc")) {
                  return compareScanRecords(left, right, "asc");
                }

                return compareScanRecords(left, right, "desc");
              });

            if (normalizedSql.includes("join people as student") && normalizedSql.includes("join people as mentor")) {
              return createQueryResult(records.map((record) => buildAdminJoinedRow(state, record)).filter(Boolean) as T[]);
            }

            return createQueryResult(records as T[]);
          }

          return createQueryResult([]);
        },
        async run(): Promise<{ success: true; meta: Record<string, unknown> }> {
          if (normalizedSql.startsWith("insert into scan_records")) {
            if (state.insertScanRecordErrorMessage) {
              const message = state.insertScanRecordErrorMessage;
              state.insertScanRecordErrorMessage = null;
              throw new Error(message);
            }

            const [scanId, studentId, mentorId, eventDate, scannedAt, notes, updatedAt] = params as [
              string,
              string,
              string,
              string,
              string,
              string,
              string
            ];

            state.scanRecords.push({
              scan_id: scanId,
              student_id: studentId,
              mentor_id: mentorId,
              event_date: eventDate,
              scanned_at: scannedAt,
              notes,
              updated_at: updatedAt
            });
          }

          if (normalizedSql.startsWith("update scan_records set notes = ?1, updated_at = ?2 where mentor_id = ?3 and scan_id = ?4")) {
            const [notes, updatedAt, mentorId, scanId] = params as [string, string, string, string];
            const scanRecord = state.scanRecords.find(
              (candidate) => candidate.mentor_id === mentorId && candidate.scan_id === scanId
            );

            if (scanRecord) {
              scanRecord.notes = notes;
              scanRecord.updated_at = updatedAt;
            }
          }

          if (normalizedSql.startsWith("update scan_records set") && normalizedSql.includes("where scan_id =")) {
            applyAdminScanRecordUpdate(state, normalizedSql, params);
          }

          if (normalizedSql.startsWith("delete from scan_records") && normalizedSql.includes("where scan_id = ?1")) {
            const [scanId] = params as [string];
            state.scanRecords = state.scanRecords.filter((record) => record.scan_id !== scanId);
          }

          return {
            success: true,
            meta: {}
          };
        }
      };
    }
  };
}

export function createMockD1Database(seed?: Partial<MockState>): D1Database {
  const state = cloneState(seed);

  return {
    __mockState: state,
    prepare(sql: string) {
      return createStatement(state, sql) as unknown as D1PreparedStatement;
    }
  } as MockD1Database;
}

export function readMockD1State(db: D1Database): MockState {
  return (db as MockD1Database).__mockState;
}
