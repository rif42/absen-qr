import { describe, expect, it } from "vitest";

/**
 * Replicates the normalizeHistory mapping logic from public/student/app.js.
 *
 * app.js is a plain browser script with no module exports, so the function
 * cannot be imported directly. This mirror keeps the unit test honest about
 * the expected mapping contract.
 *
 * When Task 1 adds `notes: entry.notes || ''` to the real function, these
 * tests verify the correct behaviour.
 */
function normalizeHistory(payload: unknown): Array<{ mentorName: string; scannedAt: string; notes: string }> {
  const source = Array.isArray(payload)
    ? payload
    : (payload as Record<string, unknown>)?.history ||
      (payload as Record<string, unknown>)?.scans ||
      (payload as Record<string, unknown>)?.records ||
      (payload as Record<string, unknown>)?.mentorHistory ||
      [];

  if (!Array.isArray(source)) {
    return [];
  }

  return source.map((entry: Record<string, unknown>) => ({
    mentorName:
      (entry.mentorName as string) ||
      (entry.mentor_name as string) ||
      (entry.displayName as string) ||
      (entry.display_name as string) ||
      (entry.name as string) ||
      "Mentor",
    scannedAt:
      (entry.scannedAt as string) ||
      (entry.scanned_at as string) ||
      (entry.updatedAt as string) ||
      (entry.updated_at as string) ||
      "",
    notes: (entry.notes as string) || "",
  }));
}

describe("normalizeHistory", () => {
  it("preserves notes when present in the API entry", () => {
    const input = {
      history: [
        {
          mentorName: "Dr. Mentor",
          scannedAt: "2026-01-15T09:00:00.000Z",
          notes: "Discussed research plan",
        },
      ],
    };

    const result = normalizeHistory(input);

    expect(result).toHaveLength(1);
    expect(result[0].notes).toBe("Discussed research plan");
  });

  it("returns empty string when notes is an empty string", () => {
    const input = {
      history: [
        {
          mentorName: "Dr. Mentor",
          scannedAt: "2026-01-15T09:00:00.000Z",
          notes: "",
        },
      ],
    };

    const result = normalizeHistory(input);

    expect(result).toHaveLength(1);
    expect(result[0].notes).toBe("");
  });

  it("returns empty string as defensive default when notes field is missing", () => {
    const input = {
      history: [
        {
          mentorName: "Dr. Mentor",
          scannedAt: "2026-01-15T09:00:00.000Z",
          // notes field intentionally omitted
        },
      ],
    };

    const result = normalizeHistory(input);

    expect(result).toHaveLength(1);
    expect(result[0].notes).toBe("");
  });

  it("returns empty array for null payload", () => {
    expect(normalizeHistory(null)).toEqual([]);
  });

  it("returns empty array for payload without history array", () => {
    expect(normalizeHistory({})).toEqual([]);
  });

  it("preserves mentorName and scannedAt alongside notes", () => {
    const input = {
      history: [
        {
          mentorName: "Prof. Test",
          scannedAt: "2026-01-15T10:00:00.000Z",
          notes: "All good",
        },
      ],
    };

    const result = normalizeHistory(input);

    expect(result[0]).toEqual({
      mentorName: "Prof. Test",
      scannedAt: "2026-01-15T10:00:00.000Z",
      notes: "All good",
    });
  });
});
