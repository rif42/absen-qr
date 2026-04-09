import { describe, expect, it } from "vitest";

import { parseMentorQrPayload } from "../../src/worker/services/mentor-qr";

describe("parseMentorQrPayload", () => {
  it("returns the mentor id from a valid v1 mentor QR payload", () => {
    expect(parseMentorQrPayload("absenqr:v1:mentor:mentor-001")).toEqual({
      mentorId: "mentor-001"
    });
  });

  it("rejects payloads with the wrong prefix", () => {
    expect(parseMentorQrPayload("mentor-001")).toBeNull();
  });
});
