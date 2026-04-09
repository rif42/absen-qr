import { describe, expect, it } from "vitest";

import { parseSecretLinkPath } from "../../src/worker/services/secret-links";

describe("parseSecretLinkPath", () => {
  it("parses a student secret page route", () => {
    expect(parseSecretLinkPath("/student/local-student-token-001")).toEqual({
      kind: "page",
      role: "student",
      secretToken: "local-student-token-001"
    });
  });

  it("parses a mentor API route beneath the same secret link", () => {
    expect(parseSecretLinkPath("/mentor/local-mentor-token-001/api/recent-scans")).toEqual({
      kind: "api",
      role: "mentor",
      secretToken: "local-mentor-token-001",
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
