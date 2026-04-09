import { getRolePageAssetPath, rewriteRequestPath } from "../services/secret-links";
import { findPersonBySecretToken } from "../db/people";
import { json, methodNotAllowed, notFound, notImplemented } from "../services/http";
import type { Env } from "../types";

export function handleStudentPage(request: Request, env: Env): Promise<Response> {
  return env.ASSETS.fetch(rewriteRequestPath(request, getRolePageAssetPath("student")));
}

export async function handleStudentApi(request: Request, env: Env, secretToken: string): Promise<Response> {
  const pathname = new URL(request.url).pathname;
  const apiPath = pathname.replace(`/student/${secretToken}/api`, "") || "/";

  if (apiPath === "/me") {
    if (request.method !== "GET") {
      return methodNotAllowed(["GET"]);
    }

    const student = await findPersonBySecretToken(env.DB, "student", secretToken);

    if (!student) {
      return notFound();
    }

    return json({
      student: {
        personId: student.person_id,
        displayName: student.display_name,
        secretId: student.secret_id
      }
    });
  }

  if (apiPath === "/scan") {
    if (request.method !== "POST") {
      return methodNotAllowed(["POST"]);
    }

    return notImplemented("POST /student/:secret/api/scan", { secretToken });
  }

  if (apiPath === "/history") {
    if (request.method !== "GET") {
      return methodNotAllowed(["GET"]);
    }

    return notImplemented("GET /student/:secret/api/history", { secretToken });
  }

  return notImplemented("student api route placeholder", { secretToken, apiPath });
}
