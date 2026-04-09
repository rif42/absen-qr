import { fetchAssetWithRedirectFallback, getRolePageAssetPath } from "../services/secret-links";
import { forbidden, methodNotAllowed, notImplemented } from "../services/http";
import type { Env } from "../types";

function isAuthorizedAdminSecret(secretToken: string, env: Env): boolean {
  return secretToken === env.ADMIN_SECRET;
}

export function handleAdminPage(request: Request, env: Env, secretToken: string): Promise<Response> | Response {
  if (!isAuthorizedAdminSecret(secretToken, env)) {
    return forbidden();
  }

  return fetchAssetWithRedirectFallback(request, env.ASSETS, getRolePageAssetPath("admin"));
}

export function handleAdminApi(request: Request, env: Env, secretToken: string): Response {
  if (!isAuthorizedAdminSecret(secretToken, env)) {
    return forbidden();
  }

  const pathname = new URL(request.url).pathname;
  const apiPath = pathname.replace(`/admin/${secretToken}/api`, "") || "/";

  if (apiPath === "/records") {
    if (request.method !== "GET") {
      return methodNotAllowed(["GET"]);
    }

    return notImplemented("GET /admin/:secret/api/records");
  }

  if (apiPath === "/export.csv") {
    if (request.method !== "GET") {
      return methodNotAllowed(["GET"]);
    }

    return notImplemented("GET /admin/:secret/api/export.csv", {
      csvColumns: ["student name", "secret id", "mentor scanned", "date", "notes"]
    });
  }

  if (apiPath.startsWith("/records/")) {
    if (request.method === "PATCH") {
      return notImplemented("PATCH /admin/:secret/api/records/:scanId", { apiPath });
    }

    if (request.method === "DELETE") {
      return notImplemented("DELETE /admin/:secret/api/records/:scanId", { apiPath });
    }

    return methodNotAllowed(["PATCH", "DELETE"]);
  }

  return notImplemented("admin api route placeholder", { apiPath });
}
