import { describe, expect, it } from "vitest";

import worker from "../../src/worker/index";
import { createMockD1Database } from "../support/mock-d1";

type FetchHandler = NonNullable<typeof worker.fetch>;
type WorkerRequest = Parameters<FetchHandler>[0];
type WorkerEnv = Parameters<FetchHandler>[1];
type WorkerContext = Parameters<FetchHandler>[2];

function createAssetFetcher(): Fetcher {
  return {
    fetch(): Promise<Response> {
      return Promise.resolve(new Response("<html><body>Student shell</body></html>"));
    },
    connect(): Socket {
      throw new Error("Socket connections are not used in this test.");
    }
  };
}

function createEnv(): WorkerEnv {
  return {
    ADMIN_SECRET: "local-admin-secret-token",
    ASSETS: createAssetFetcher(),
    DB: createMockD1Database()
  } as WorkerEnv;
}

describe("student API", () => {
  it("returns the student identity for a valid student secret token", async () => {
    const fetchHandler = worker.fetch as FetchHandler;
    const response = await fetchHandler(
      new Request("https://example.com/student/local-student-token-001/api/me") as WorkerRequest,
      createEnv(),
      {} as WorkerContext
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      student: {
        personId: "student-001",
        displayName: "Student Local 01",
        secretId: "student-secret-001"
      }
    });
  });

  it("rejects a student route whose secret token belongs to another role", async () => {
    const fetchHandler = worker.fetch as FetchHandler;
    const response = await fetchHandler(
      new Request("https://example.com/student/local-mentor-token-001/api/me") as WorkerRequest,
      createEnv(),
      {} as WorkerContext
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Not found" });
  });
});
