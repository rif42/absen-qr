export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");

  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers
  });
}

export function notFound(): Response {
  return json({ error: "Not found" }, { status: 404 });
}

export function forbidden(message = "Forbidden"): Response {
  return json({ error: message }, { status: 403 });
}

export function methodNotAllowed(allowed: string[]): Response {
  return json(
    { error: "Method not allowed", allowed },
    {
      status: 405,
      headers: {
        allow: allowed.join(", ")
      }
    }
  );
}

export function notImplemented(feature: string, details?: Record<string, unknown>): Response {
  return json(
    {
      error: "Scaffold placeholder",
      feature,
      phase: "phase-1-scaffold",
      ...details
    },
    { status: 501 }
  );
}
