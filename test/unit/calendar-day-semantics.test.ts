import { describe, expect, it } from "vitest";

import { getUtcDayKey } from "../../src/worker/services/event-day";

describe("getUtcDayKey", () => {
  it("derives 2026-01-14 from 2026-01-14T23:59:59Z", () => {
    expect(getUtcDayKey("2026-01-14T23:59:59Z")).toBe("2026-01-14");
  });

  it("derives 2026-01-15 from 2026-01-15T00:00:01Z", () => {
    expect(getUtcDayKey("2026-01-15T00:00:01Z")).toBe("2026-01-15");
  });

  it("derives the same value from a Date object and its ISO string", () => {
    const date = new Date("2026-03-10T12:30:00.000Z");
    expect(getUtcDayKey(date)).toBe("2026-03-10");
    expect(getUtcDayKey(date.toISOString())).toBe("2026-03-10");
  });
});
