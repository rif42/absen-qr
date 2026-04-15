import { describe, expect, it } from "vitest";

import { auditAndBackfillEventDates } from "../../src/worker/db/scan-records";
import { createMockD1Database, readMockD1State } from "../support/mock-d1";

describe("auditAndBackfillEventDates", () => {
  it("backfills event_date from scanned_at utc day", async () => {
    const db = createMockD1Database({
      scanRecords: [
        {
          scan_id: "scan-stale-001",
          student_id: "student-001",
          mentor_id: "mentor-001",
          event_date: "2026-01-14",
          scanned_at: "2026-01-15T08:00:00.000Z",
          notes: "",
          updated_at: "2026-01-15T08:00:00.000Z"
        }
      ]
    });

    const result = await auditAndBackfillEventDates(db);

    expect(result.mismatchedRows).toBe(1);
    expect(result.updatedRows).toBe(1);
    expect(result.collisions).toHaveLength(0);

    const state = readMockD1State(db);
    const updated = state.scanRecords.find((r) => r.scan_id === "scan-stale-001");
    expect(updated?.event_date).toBe("2026-01-15");
  });

  it("halts when backfill would create a duplicate student mentor day key", async () => {
    const db = createMockD1Database({
      scanRecords: [
        {
          scan_id: "scan-collision-source",
          student_id: "student-001",
          mentor_id: "mentor-001",
          event_date: "2026-01-14",
          scanned_at: "2026-01-15T08:00:00.000Z",
          notes: "",
          updated_at: "2026-01-15T08:00:00.000Z"
        },
        {
          scan_id: "scan-collision-blocker",
          student_id: "student-001",
          mentor_id: "mentor-001",
          event_date: "2026-01-15",
          scanned_at: "2026-01-15T09:00:00.000Z",
          notes: "",
          updated_at: "2026-01-15T09:00:00.000Z"
        }
      ]
    });

    await expect(auditAndBackfillEventDates(db)).rejects.toThrow(
      /Backfill aborted: 1 row\(s\) would violate the unique \(student_id, mentor_id, event_date\) constraint/
    );

    const state = readMockD1State(db);
    const source = state.scanRecords.find((r) => r.scan_id === "scan-collision-source");
    const blocker = state.scanRecords.find((r) => r.scan_id === "scan-collision-blocker");

    expect(source?.event_date).toBe("2026-01-14");
    expect(blocker?.event_date).toBe("2026-01-15");
  });
});
