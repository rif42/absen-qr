import type { PersonRecord, ScanRecord } from "../../src/worker/types";

type MockState = {
  people: PersonRecord[];
  scanRecords: ScanRecord[];
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
    person_id: "mentor-001",
    display_name: "Mentor Local 01",
    role: "mentor",
    secret_id: "mentor-secret-001",
    secret_path_token: "local-mentor-token-001"
  }
];

function cloneState(seed?: Partial<MockState>): MockState {
  return {
    people: (seed?.people ?? DEFAULT_PEOPLE).map((person) => ({ ...person })),
    scanRecords: (seed?.scanRecords ?? []).map((scanRecord) => ({ ...scanRecord }))
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

          throw new Error(`Unsupported first() SQL in mock D1: ${sql}`);
        },
        async all<T>(): Promise<QueryResult<T>> {
          return createQueryResult([]);
        },
        async run(): Promise<{ success: true; meta: Record<string, unknown> }> {
          if (normalizedSql.startsWith("insert into scan_records")) {
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
