import { getRolePageAssetPath, rewriteRequestPath } from "../services/secret-links";
import { methodNotAllowed, notImplemented } from "../services/http";
import type { Env } from "../types";

export function handleMentorPage(request: Request, env: Env): Promise<Response> {
  return env.ASSETS.fetch(rewriteRequestPath(request, getRolePageAssetPath("mentor")));
}

export function handleMentorApi(request: Request, secretToken: string): Response {
  const pathname = new URL(request.url).pathname;
  const apiPath = pathname.replace(`/mentor/${secretToken}/api`, "") || "/";

  if (apiPath === "/me") {
    if (request.method !== "GET") {
      return methodNotAllowed(["GET"]);
    }

    return notImplemented("GET /mentor/:secret/api/me", { secretToken });
  }

  if (apiPath === "/recent-scans") {
    if (request.method !== "GET") {
      return methodNotAllowed(["GET"]);
    }

    return notImplemented("GET /mentor/:secret/api/recent-scans", { secretToken });
  }

  if (apiPath.startsWith("/notes/")) {
    if (request.method !== "POST") {
      return methodNotAllowed(["POST"]);
    }

    return notImplemented("POST /mentor/:secret/api/notes/:scanId", { secretToken, apiPath });
  }

  return notImplemented("mentor api route placeholder", { secretToken, apiPath });
}
