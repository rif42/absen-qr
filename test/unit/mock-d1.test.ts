import { describe, expect, it } from "vitest";

import { createMockD1Database, readMockD1State } from "../support/mock-d1";
import { REAL_MENTORS, REAL_STUDENTS } from "../support/real-roster";

describe("mock D1 foundation seed", () => {
  it("mirrors the full canonical 10 student and 10 mentor roster by default", () => {
    const db = createMockD1Database();
    const state = readMockD1State(db);
    const lastStudent = REAL_STUDENTS.at(-1);
    const lastMentor = REAL_MENTORS.at(-1);

    expect(lastStudent).toBeDefined();
    expect(lastMentor).toBeDefined();

    expect(state.people).toHaveLength(20);
    expect(state.people.filter((person) => person.role === "student")).toHaveLength(10);
    expect(state.people.filter((person) => person.role === "mentor")).toHaveLength(10);

    expect(state.people).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          person_id: lastStudent?.person_id,
          secret_path_token: lastStudent?.secret_path_token
        }),
        expect.objectContaining({
          person_id: lastMentor?.person_id,
          secret_path_token: lastMentor?.secret_path_token
        })
      ])
    );
  });
});
