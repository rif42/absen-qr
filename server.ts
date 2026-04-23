import { Database } from "bun:sqlite";
import worker from "./src/worker/index.ts";

/**
 * Cloudflare D1 Mock wrapper around bun:sqlite
 */
class LocalD1Database {
  private db: Database;

  constructor(sqliteFilePath: string) {
    this.db = new Database(sqliteFilePath, { create: true });
  }

  prepare(sql: string) {
    try {
      const stmt = this.db.prepare(sql);
      return {
        bind: (...args: any[]) => ({
          first: async <T>() => stmt.get(...args) as T | null,
          all: async <T>() => ({ results: stmt.all(...args) as T[] }),
          run: async () => stmt.run(...args),
        })
      };
    } catch (error) {
      console.error("SQL Error preparing statement:", sql);
      throw error;
    }
  }
}

/**
 * Cloudflare ASSETS Mock to serve from public directory
 */
const ASSETS = {
  async fetch(req: Request) {
    const url = new URL(req.url);
    const path = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = Bun.file(`./public${path}`);
    if (await file.exists()) {
      return new Response(file);
    }
    return new Response("Not Found", { status: 404 });
  }
};

const localEnv = {
  DB: new LocalD1Database("./local_database.db"),
  ASSETS,
  ADMIN_SECRET: process.env.ADMIN_SECRET || "admin-secret-dev",
  EVENT_DATE: process.env.EVENT_DATE || new Date().toISOString().substring(0, 10)
};

export default {
  port: process.env.PORT || 3042,
  hostname: "0.0.0.0",
  async fetch(req: Request) {
    try {
      const start = Date.now();
      const url = new URL(req.url);

      // Attempt to serve static assets from /public directly first (mimicking CF Pages behavior)
      if (req.method === "GET" && url.pathname !== "/") {
        const file = Bun.file(`./public${url.pathname}`);
        if (await file.exists()) {
          console.log(`[${req.method}] ${req.url} - ASSET 200 (${Date.now() - start}ms)`);
          return new Response(file);
        }
      }

      const res = await worker.fetch(req, localEnv as any, {} as any);
      console.log(`[${req.method}] ${req.url} - ${res.status} (${Date.now() - start}ms)`);
      return res;
    } catch (e) {
      console.error(`Error on ${req.url}:`, e);
      return new Response("Internal Server Error\n" + String(e), { status: 500 });
    }
  }
};
