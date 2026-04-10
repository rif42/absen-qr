import { describe, expect, it } from "vitest";

import { createMockD1Database, readMockD1State } from "../support/mock-d1";

describe("mock D1 foundation seed", () => {
  it("mirrors the full 5 student and 5 mentor pilot roster by default", () => {
    const db = createMockD1Database();
    const state = readMockD1State(db);

    expect(state.people).toHaveLength(10);
    expect(state.people.filter((person) => person.role === "student")).toHaveLength(5);
    expect(state.people.filter((person) => person.role === "mentor")).toHaveLength(5);

    expect(state.people).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          person_id: "student-005",
          secret_path_token: "local-student-token-005"
        }),
        expect.objectContaining({
          person_id: "mentor-005",
          secret_path_token: "local-mentor-token-005"
        })
      ])
    );
  });
});
