import { test } from "@playwright/test";
import { execSync } from "node:child_process";

const WRANGLER_PERSIST_DIR = ".wrangler/state/e2e";

function runWranglerCommand(args: string[]) {
  execSync(`npx wrangler ${args.join(" ")}`, {
    cwd: process.cwd(),
    stdio: "inherit"
  });
}

test("prepares deterministic admin e2e data", async () => {
  runWranglerCommand([
    "d1",
    "migrations",
    "apply",
    "DB",
    "--local",
    "--persist-to",
    WRANGLER_PERSIST_DIR,
    "--config",
    "wrangler.jsonc"
  ]);

  runWranglerCommand([
    "d1",
    "execute",
    "DB",
    "--local",
    "--persist-to",
    WRANGLER_PERSIST_DIR,
    "--config",
    "wrangler.jsonc",
    "--file",
    "./seed/dev.sql"
  ]);

  runWranglerCommand([
    "d1",
    "execute",
    "DB",
    "--local",
    "--persist-to",
    WRANGLER_PERSIST_DIR,
    "--config",
    "wrangler.jsonc",
    "--file",
    "./seed/e2e-admin.sql"
  ]);
});
