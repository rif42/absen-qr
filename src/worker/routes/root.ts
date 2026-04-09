import type { Env } from "../types";

export function handleRootRoute(request: Request, env: Env): Promise<Response> {
  return env.ASSETS.fetch(request);
}
