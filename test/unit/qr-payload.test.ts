import { describe, expect, it } from "vitest";

import { parseQrPayload } from "../../src/worker/services/qr-payload";

describe("parseQrPayload", () => {
  it("returns role and personId from a valid v1 mentor QR payload", () => {
    expect(parseQrPayload("absenqr:v1:mentor:mentor-001")).toEqual({
      role: "mentor",
      personId: "mentor-001"
    });
  });

  it("returns role and personId from a valid v1 student QR payload", () => {
    expect(parseQrPayload("absenqr:v1:student:student-001")).toEqual({
      role: "student",
      personId: "student-001"
    });
  });

  it("rejects payloads with the wrong prefix", () => {
    expect(parseQrPayload("mentor-001")).toBeNull();
  });

  it("rejects payloads with invalid person ID", () => {
    expect(parseQrPayload("absenqr:v1:mentor:MENTOR_001")).toBeNull();
  });

  it("rejects empty string", () => {
    expect(parseQrPayload("")).toBeNull();
  });
});
