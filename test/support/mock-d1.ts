import type { PersonRecord, ScanRecord } from "../../src/worker/types";

type MockState = {
  people: PersonRecord[];
  scanRecords: ScanRecord[];
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
          if (normalizedSql.includes("from people") && normalizedSql.includes("secret_path_token")) {
            const [role, secretToken] = params as [PersonRecord["role"], string];
            const person = state.people.find(
              (candidate) => candidate.role === role && candidate.secret_path_token === secretToken
            );

            return (person ?? null) as T | null;
          }

          throw new Error(`Unsupported first() SQL in mock D1: ${sql}`);
        },
        async all<T>(): Promise<QueryResult<T>> {
          return createQueryResult([]);
        },
        async run(): Promise<{ success: true; meta: Record<string, unknown> }> {
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
  const state: MockState = {
    people: seed?.people ?? DEFAULT_PEOPLE,
    scanRecords: seed?.scanRecords ?? []
  };

  return {
    prepare(sql: string) {
      return createStatement(state, sql) as unknown as D1PreparedStatement;
    }
  } as D1Database;
}
