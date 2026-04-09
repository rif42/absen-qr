import { handleAdminApi, handleAdminPage } from "./routes/admin";
import { handleMentorApi, handleMentorPage } from "./routes/mentor";
import { handleRootRoute } from "./routes/root";
import { handleStudentApi, handleStudentPage } from "./routes/student";
import { notFound } from "./services/http";
import { parseSecretLinkPath } from "./services/secret-links";
import type { Env } from "./types";

const worker: ExportedHandler<Env> = {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return handleRootRoute(request, env);
    }

    const routeMatch = parseSecretLinkPath(url.pathname);

    if (!routeMatch) {
      return notFound();
    }

    if (routeMatch.kind === "page") {
      switch (routeMatch.role) {
        case "student":
          return handleStudentPage(request, env);
        case "mentor":
          return handleMentorPage(request, env);
        case "admin":
          return handleAdminPage(request, env, routeMatch.secretToken);
      }
    }

    switch (routeMatch.role) {
      case "student":
        return handleStudentApi(request, routeMatch.secretToken);
      case "mentor":
        return handleMentorApi(request, routeMatch.secretToken);
      case "admin":
        return handleAdminApi(request, env, routeMatch.secretToken);
    }
  }
};

export default worker;
