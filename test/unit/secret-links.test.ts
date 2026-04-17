import { describe, expect, it } from "vitest";

import { parseSecretLinkPath } from "../../src/worker/services/secret-links";
import { REAL_MENTORS, REAL_STUDENTS } from "../support/real-roster";

const [student1] = REAL_STUDENTS;
const [mentor1] = REAL_MENTORS;

describe("parseSecretLinkPath", () => {
  it("parses a student secret page route", () => {
    expect(parseSecretLinkPath(`/student/${student1.secret_path_token}`)).toEqual({
      kind: "page",
      role: "student",
      secretToken: student1.secret_path_token
    });
  });

  it("parses a mentor API route beneath the same secret link", () => {
    expect(parseSecretLinkPath(`/mentor/${mentor1.secret_path_token}/api/recent-scans`)).toEqual({
      kind: "api",
      role: "mentor",
      secretToken: mentor1.secret_path_token,
      apiPath: "/recent-scans"
    });
  });

  it("rejects unknown role prefixes", () => {
    expect(parseSecretLinkPath("/guest/not-allowed")).toBeNull();
  });

  it("rejects missing secret tokens", () => {
    expect(parseSecretLinkPath("/student/")).toBeNull();
  });

  it("rejects secret tokens with invalid characters", () => {
    expect(parseSecretLinkPath("/admin/not valid")).toBeNull();
  });
});
