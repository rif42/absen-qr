import { describe, expect, it } from "vitest";

import worker from "../../src/worker/index";
import { REAL_STUDENTS } from "../support/real-roster";

type FetchHandler = NonNullable<typeof worker.fetch>;
type WorkerRequest = Parameters<FetchHandler>[0];
type WorkerEnv = Parameters<FetchHandler>[1];
type WorkerContext = Parameters<FetchHandler>[2];

const [student1] = REAL_STUDENTS;

type MockEnv = {
  ADMIN_SECRET: string;
  ASSETS: Fetcher;
  DB: D1Database;
};

function createAssetFetcher(): Fetcher {
  return {
    fetch(request: Request): Promise<Response> {
      const url = new URL(request.url);

      if (url.pathname === "/") {
        return Promise.resolve(
          new Response("<html><body>Scaffold root</body></html>", {
            headers: { "content-type": "text/html; charset=utf-8" }
          })
        );
      }

      if (url.pathname === "/student/index.html") {
        return Promise.resolve(
          new Response("<html><body>Student placeholder</body></html>", {
            headers: { "content-type": "text/html; charset=utf-8" }
          })
        );
      }

      if (url.pathname === "/mentor/index.html") {
        return Promise.resolve(
          new Response("<html><body>Mentor placeholder</body></html>", {
            headers: { "content-type": "text/html; charset=utf-8" }
          })
        );
      }

      if (url.pathname === "/admin/index.html") {
        return Promise.resolve(
          new Response("<html><body>Admin placeholder</body></html>", {
            headers: { "content-type": "text/html; charset=utf-8" }
          })
        );
      }

      return Promise.resolve(new Response("Not found", { status: 404 }));
    },
    connect(): Socket {
      throw new Error("Socket connections are not used in this test.");
    }
  };
}

function createRedirectingStudentAssetFetcher(): Fetcher {
  return {
    fetch(request: Request): Promise<Response> {
      const url = new URL(request.url);

      if (url.pathname === "/student/index.html") {
        return Promise.resolve(
          new Response(null, {
            status: 307,
            headers: {
              location: "/student/"
            }
          })
        );
      }

      if (url.pathname === "/student/") {
        return Promise.resolve(
          new Response("<html><body>Student redirect target</body></html>", {
            headers: { "content-type": "text/html; charset=utf-8" }
          })
        );
      }

      return Promise.resolve(new Response("Not found", { status: 404 }));
    },
    connect(): Socket {
      throw new Error("Socket connections are not used in this test.");
    }
  };
}

function createEnv(): MockEnv {
  return {
    ADMIN_SECRET: "local-admin-secret-token",
    ASSETS: createAssetFetcher(),
    DB: {} as D1Database
  };
}

describe("worker scaffold", () => {
  it("serves the root HTML page", async () => {
    const fetchHandler = worker.fetch as FetchHandler;
    const response = await fetchHandler(
      new Request("https://example.com/") as WorkerRequest,
      createEnv() as WorkerEnv,
      {} as WorkerContext
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
  });

  it("serves the student placeholder page for a valid secret route", async () => {
    const fetchHandler = worker.fetch as FetchHandler;
    const response = await fetchHandler(
      new Request(`https://example.com/student/${student1.secret_path_token}`) as WorkerRequest,
      createEnv() as WorkerEnv,
      {} as WorkerContext
    );

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain("Student placeholder");
  });

  it("serves the student page content even if assets redirect index requests", async () => {
    const fetchHandler = worker.fetch as FetchHandler;
    const response = await fetchHandler(
      new Request(`https://example.com/student/${student1.secret_path_token}`) as WorkerRequest,
      {
        ...createEnv(),
        ASSETS: createRedirectingStudentAssetFetcher()
      } as WorkerEnv,
      {} as WorkerContext
    );

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain("Student redirect target");
  });
});
