import type { PersonRecord, ScanRecord } from "../../src/worker/types";

import { REAL_ROSTER } from "./real-roster";

type MentorFallbackCodeRecord = {
  fallback_code_id: string;
  mentor_id: string;
  code_value: string;
  created_at: string;
  expires_at: string;
  consumed_at: string | null;
  consumed_by_student_id: string | null;
  consumed_scan_id: string | null;
};

type MockState = {
  people: PersonRecord[];
  scanRecords: ScanRecord[];
  fallback_codes: MentorFallbackCodeRecord[];
  mentor_fallback_codes: MentorFallbackCodeRecord[];
  insertScanRecordErrorMessage: string | null;
  missingScanRecordsEntryMethodColumn: boolean;
};

type MockScanRecordSeed = Omit<ScanRecord, "entry_method"> & Partial<Pick<ScanRecord, "entry_method">>;

type MockFallbackCodeSeed = Pick<
  MentorFallbackCodeRecord,
  "fallback_code_id" | "mentor_id" | "code_value" | "created_at" | "expires_at"
> &
  Partial<Pick<MentorFallbackCodeRecord, "consumed_at" | "consumed_by_student_id" | "consumed_scan_id">>;

type CreateFallbackCodeInput = {
  fallbackCodeId?: string;
  mentorId: string;
  code?: string;
  codeValue?: string;
  createdAt: string;
  expiresAt: string;
  consumedAt?: string | null;
  consumedByStudentId?: string | null;
  consumedScanId?: string | null;
};

type MockStateSeed = {
  people?: PersonRecord[];
  scanRecords?: MockScanRecordSeed[];
  fallback_codes?: MockFallbackCodeSeed[];
  mentor_fallback_codes?: MockFallbackCodeSeed[];
  insertScanRecordErrorMessage?: string | null;
  missingScanRecordsEntryMethodColumn?: boolean;
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

const DEFAULT_PEOPLE: PersonRecord[] = REAL_ROSTER;

function cloneScanRecord(scanRecord: MockScanRecordSeed): ScanRecord {
  return {
    ...scanRecord,
    entry_method: scanRecord.entry_method ?? "qr"
  };
}

function cloneFallbackCode(fallbackCode: MockFallbackCodeSeed): MentorFallbackCodeRecord {
  return {
    ...fallbackCode,
    consumed_at: fallbackCode.consumed_at ?? null,
    consumed_by_student_id: fallbackCode.consumed_by_student_id ?? null,
    consumed_scan_id: fallbackCode.consumed_scan_id ?? null
  };
}

function cloneState(seed?: Partial<MockStateSeed>): MockState {
  const fallbackCodes = (seed?.fallback_codes ?? seed?.mentor_fallback_codes ?? []).map(cloneFallbackCode);

  return {
    people: (seed?.people ?? DEFAULT_PEOPLE).map((person) => ({ ...person })),
    scanRecords: (seed?.scanRecords ?? []).map(cloneScanRecord),
    fallback_codes: fallbackCodes,
    mentor_fallback_codes: fallbackCodes,
    insertScanRecordErrorMessage: seed?.insertScanRecordErrorMessage ?? null,
    missingScanRecordsEntryMethodColumn: seed?.missingScanRecordsEntryMethodColumn ?? false
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

function getFallbackCodeById(state: MockState, fallbackCodeId: string): MentorFallbackCodeRecord | null {
  return state.fallback_codes.find((candidate) => candidate.fallback_code_id === fallbackCodeId) ?? null;
}

function getFallbackCodeByValue(state: MockState, codeValue: string): MentorFallbackCodeRecord | null {
  return state.fallback_codes.find((candidate) => candidate.code_value === codeValue) ?? null;
}

function cloneFallbackCodeState(state: MockState, fallbackCode: MockFallbackCodeSeed): MentorFallbackCodeRecord {
  const row = cloneFallbackCode(fallbackCode);
  state.fallback_codes.push(row);
  return row;
}

function extractSetAssignments(normalizedSql: string): string[] {
  const setClause = normalizedSql.slice(normalizedSql.indexOf("set ") + 4, normalizedSql.indexOf(" where "));
  return setClause.split(", ");
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

  const assignments = extractSetAssignments(normalizedSql);

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

    if (column === "entry_method" && (value === "qr" || value === "fallback_code")) {
      nextValues.entry_method = value;
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
  scanRecord.entry_method = nextValues.entry_method;
}

function applyFallbackCodeUpdate(state: MockState, normalizedSql: string, params: unknown[]): void {
  const fallbackCodeIdPlaceholderIndex = extractPlaceholderIndex(normalizedSql, /where fallback_code_id = \?(\d+)/);
  const codeValuePlaceholderIndex = extractPlaceholderIndex(normalizedSql, /where code_value = \?(\d+)/);

  const fallbackCodeId = fallbackCodeIdPlaceholderIndex ? getPlaceholderValue(params, fallbackCodeIdPlaceholderIndex) : null;
  const codeValue = codeValuePlaceholderIndex ? getPlaceholderValue(params, codeValuePlaceholderIndex) : null;

  const row =
    (typeof fallbackCodeId === "string" ? getFallbackCodeById(state, fallbackCodeId) : null) ??
    (typeof codeValue === "string" ? getFallbackCodeByValue(state, codeValue) : null);

  if (!row) {
    return;
  }

  const assignments = extractSetAssignments(normalizedSql);
  const nextValues: MentorFallbackCodeRecord = { ...row };

  for (const assignment of assignments) {
    const [column, placeholder] = assignment.split(" = ");

    if (!placeholder?.startsWith("?")) {
      continue;
    }

    const placeholderIndex = Number(placeholder.slice(1));
    const value = getPlaceholderValue(params, placeholderIndex);

    if (column === "mentor_id" && typeof value === "string") {
      nextValues.mentor_id = value;
    }

    if (column === "code_value" && typeof value === "string") {
      nextValues.code_value = value;
    }

    if (column === "created_at" && typeof value === "string") {
      nextValues.created_at = value;
    }

    if (column === "expires_at" && typeof value === "string") {
      nextValues.expires_at = value;
    }

    if (column === "consumed_at") {
      nextValues.consumed_at = typeof value === "string" ? value : null;
    }

    if (column === "consumed_by_student_id") {
      nextValues.consumed_by_student_id = typeof value === "string" ? value : null;
    }

    if (column === "consumed_scan_id") {
      nextValues.consumed_scan_id = typeof value === "string" ? value : null;
    }
  }

  row.mentor_id = nextValues.mentor_id;
  row.code_value = nextValues.code_value;
  row.created_at = nextValues.created_at;
  row.expires_at = nextValues.expires_at;
  row.consumed_at = nextValues.consumed_at;
  row.consumed_by_student_id = nextValues.consumed_by_student_id;
  row.consumed_scan_id = nextValues.consumed_scan_id;
}

export const mockD1Helpers = {
  createFallbackCode(state: MockState, fallbackCode: CreateFallbackCodeInput): MentorFallbackCodeRecord {
    const row: MockFallbackCodeSeed = {
      fallback_code_id: fallbackCode.fallbackCodeId ?? crypto.randomUUID(),
      mentor_id: fallbackCode.mentorId,
      code_value: fallbackCode.codeValue ?? fallbackCode.code ?? crypto.randomUUID(),
      created_at: fallbackCode.createdAt,
      expires_at: fallbackCode.expiresAt,
      consumed_at: fallbackCode.consumedAt ?? null,
      consumed_by_student_id: fallbackCode.consumedByStudentId ?? null,
      consumed_scan_id: fallbackCode.consumedScanId ?? null
    };

    return cloneFallbackCodeState(state, row);
  },
  getFallbackCode(state: MockState, codeValue: string): MentorFallbackCodeRecord | null {
    return getFallbackCodeByValue(state, codeValue);
  },
  consumeFallbackCode(
    state: MockState,
    codeValue: string,
    studentId: string,
    scanId: string
  ): MentorFallbackCodeRecord | null {
    const row = getFallbackCodeByValue(state, codeValue);

    if (!row) {
      return null;
    }

    row.consumed_at = new Date().toISOString();
    row.consumed_by_student_id = studentId;
    row.consumed_scan_id = scanId;

    return row;
  }
};

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

          if (
            normalizedSql.includes("from scan_records") &&
            normalizedSql.includes("where student_id = ?1 and mentor_id = ?2 and event_date = ?3")
          ) {
            const [studentId, mentorId, eventDate] = params as [string, string, string];
            const scanRecord = state.scanRecords.find(
              (candidate) =>
                candidate.student_id === studentId &&
                candidate.mentor_id === mentorId &&
                candidate.event_date === eventDate
            );

            return (scanRecord ?? null) as T | null;
          }

          if (
            normalizedSql.includes("from scan_records") &&
            normalizedSql.includes("where student_id = ?1 and mentor_id = ?2 and substr(scanned_at, 1, 10) = ?3")
          ) {
            const [studentId, mentorId, utcDate] = params as [string, string, string];
            const scanRecord = state.scanRecords.find(
              (candidate) =>
                candidate.student_id === studentId &&
                candidate.mentor_id === mentorId &&
                candidate.scanned_at.slice(0, 10) === utcDate
            );

            return (scanRecord ?? null) as T | null;
          }

          if (normalizedSql.includes("from scan_records") && normalizedSql.includes("where scan_id = ?1")) {
            const [scanId] = params as [string];
            const scanRecord = state.scanRecords.find((candidate) => candidate.scan_id === scanId);

            return (scanRecord ?? null) as T | null;
          }

          if (
            normalizedSql.includes("from scan_records") &&
            normalizedSql.includes("where student_id = ?1 and mentor_id = ?2 and event_date = ?3 and scan_id != ?4")
          ) {
            const [studentId, mentorId, eventDate, scanId] = params as [string, string, string, string];
            const scanRecord = state.scanRecords.find(
              (candidate) =>
                candidate.student_id === studentId &&
                candidate.mentor_id === mentorId &&
                candidate.event_date === eventDate &&
                candidate.scan_id !== scanId
            );

            return (scanRecord ?? null) as T | null;
          }

          if (
            normalizedSql.includes("from mentor_fallback_codes") &&
            normalizedSql.includes("where mentor_id = ?1 and consumed_at is null and expires_at > ?2")
          ) {
            const [mentorId, utcNow] = params as [string, string];
            const row = state.fallback_codes.find(
              (candidate) =>
                candidate.mentor_id === mentorId &&
                candidate.consumed_at === null &&
                candidate.expires_at > utcNow
            );

            return (row ?? null) as T | null;
          }

          if (normalizedSql.includes("from mentor_fallback_codes") && normalizedSql.includes("where code_value = ?1")) {
            const [codeValue] = params as [string];
            return (getFallbackCodeByValue(state, codeValue) ?? null) as T | null;
          }

          if (normalizedSql.includes("from mentor_fallback_codes") && normalizedSql.includes("where fallback_code_id = ?1")) {
            const [fallbackCodeId] = params as [string];
            return (getFallbackCodeById(state, fallbackCodeId) ?? null) as T | null;
          }

          throw new Error(`Unsupported first() SQL in mock D1: ${sql}`);
        },
        async all<T>(): Promise<QueryResult<T>> {
          if (
            state.missingScanRecordsEntryMethodColumn &&
            normalizedSql.includes("from scan_records") &&
            normalizedSql.includes("scan_records.entry_method")
          ) {
            throw new Error("D1_ERROR: no such column: scan_records.entry_method");
          }

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
            normalizedSql.includes("where student_id = ?1 and substr(scanned_at, 1, 10) = ?2")
          ) {
            const [studentId, utcDate] = params as [string, string];
            const results = state.scanRecords
              .filter((scanRecord) => scanRecord.student_id === studentId && scanRecord.scanned_at.slice(0, 10) === utcDate)
              .sort((left, right) => right.scanned_at.localeCompare(left.scanned_at));

            return createQueryResult(results as T[]);
          }

          if (
            normalizedSql.includes("from scan_records") &&
            normalizedSql.includes("where mentor_id = ?1 and substr(scanned_at, 1, 10) = ?2")
          ) {
            const [mentorId, utcDate] = params as [string, string];
            const results = state.scanRecords
              .filter((scanRecord) => scanRecord.mentor_id === mentorId && scanRecord.scanned_at.slice(0, 10) === utcDate)
              .sort((left, right) => right.scanned_at.localeCompare(left.scanned_at));

            return createQueryResult(results as T[]);
          }

          if (
            normalizedSql.includes("from scan_records") &&
            normalizedSql.includes("event_date >= ?1") &&
            normalizedSql.includes("event_date <= ?2") &&
            normalizedSql.includes("join people as student") &&
            normalizedSql.includes("join people as mentor")
          ) {
            const [startDate, endDate] = params as [string, string];
            const records = state.scanRecords
              .filter((scanRecord) => scanRecord.event_date >= startDate && scanRecord.event_date <= endDate)
              .sort((left, right) => {
                if (normalizedSql.includes("order by scan_records.scanned_at asc, scan_records.scan_id asc")) {
                  return compareScanRecords(left, right, "asc");
                }

                return compareScanRecords(left, right, "desc");
              });

            return createQueryResult(records.map((record) => buildAdminJoinedRow(state, record)).filter(Boolean) as T[]);
          }

          if (
            normalizedSql.includes("from scan_records") &&
            normalizedSql.includes("where event_date != substr(scanned_at, 1, 10)")
          ) {
            const results = state.scanRecords.filter(
              (scanRecord) => scanRecord.event_date !== scanRecord.scanned_at.slice(0, 10)
            );
            return createQueryResult(results as T[]);
          }

          if (
            normalizedSql.includes("from mentor_fallback_codes") &&
            normalizedSql.includes("where mentor_id = ?1") &&
            normalizedSql.includes("order by created_at desc")
          ) {
            const [mentorId] = params as [string];
            const results = state.fallback_codes
              .filter((candidate) => candidate.mentor_id === mentorId)
              .sort((left, right) => right.created_at.localeCompare(left.created_at));

            return createQueryResult(results as T[]);
          }

          if (normalizedSql.includes("from mentor_fallback_codes") && normalizedSql.includes("where code_value = ?1")) {
            const [codeValue] = params as [string];
            const row = getFallbackCodeByValue(state, codeValue);
            return createQueryResult((row ? [row] : []) as T[]);
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

            const [scanId, studentId, mentorId, eventDate, scannedAt] = params as [
              string,
              string,
              string,
              string,
              string
            ];
            const entryMethod = params.length === 8 ? (params[5] as ScanRecord["entry_method"]) : "qr";
            const notes = (params.length === 8 ? params[6] : params[5]) as string;
            const updatedAt = (params.length === 8 ? params[7] : params[6]) as string;

            state.scanRecords.push({
              scan_id: scanId,
              student_id: studentId,
              mentor_id: mentorId,
              event_date: eventDate,
              scanned_at: scannedAt,
              entry_method: entryMethod,
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

          if (normalizedSql.startsWith("update scan_records set event_date = ?1 where scan_id = ?2")) {
            const [eventDate, scanId] = params as [string, string];
            const scanRecord = state.scanRecords.find((candidate) => candidate.scan_id === scanId);
            if (scanRecord) {
              scanRecord.event_date = eventDate;
            }
          }

          if (
            normalizedSql.startsWith("update scan_records set event_date = ?1, entry_method = 'qr' where scan_id = ?2")
          ) {
            const [eventDate, scanId] = params as [string, string];
            const scanRecord = state.scanRecords.find((candidate) => candidate.scan_id === scanId);
            if (scanRecord) {
              scanRecord.event_date = eventDate;
              scanRecord.entry_method = "qr";
            }
          }

          if (normalizedSql.startsWith("insert into mentor_fallback_codes")) {
            const [fallbackCodeId, mentorId, codeValue, createdAt, expiresAt, consumedAt, consumedByStudentId, consumedScanId] =
              params as [string, string, string, string, string, string | null, string | null, string | null];

            state.fallback_codes.push({
              fallback_code_id: fallbackCodeId,
              mentor_id: mentorId,
              code_value: codeValue,
              created_at: createdAt,
              expires_at: expiresAt,
              consumed_at: consumedAt ?? null,
              consumed_by_student_id: consumedByStudentId ?? null,
              consumed_scan_id: consumedScanId ?? null
            });
          }

          if (normalizedSql.startsWith("update mentor_fallback_codes set")) {
            applyFallbackCodeUpdate(state, normalizedSql, params);
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

export function createMockD1Database(seed?: Partial<MockStateSeed>): D1Database {
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
