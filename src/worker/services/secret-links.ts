import type { Role, SecretLinkRouteMatch } from "../types";
import { isRole, isValidSecretToken } from "../validation/secret-links";

const ROLE_PAGE_ASSETS: Record<Role, string> = {
  student: "/student/index.html",
  mentor: "/mentor/index.html",
  admin: "/admin/index.html"
};

export function parseSecretLinkPath(pathname: string): SecretLinkRouteMatch | null {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length < 2) {
    return null;
  }

  const [roleSegment, secretToken, thirdSegment, ...remainingSegments] = segments;

  if (!isRole(roleSegment) || !isValidSecretToken(secretToken)) {
    return null;
  }

  if (thirdSegment === undefined) {
    return {
      kind: "page",
      role: roleSegment,
      secretToken
    };
  }

  if (thirdSegment !== "api") {
    return null;
  }

  return {
    kind: "api",
    role: roleSegment,
    secretToken,
    apiPath: `/${remainingSegments.join("/")}`
  };
}

export function getRolePageAssetPath(role: Role): string {
  return ROLE_PAGE_ASSETS[role];
}

export function rewriteRequestPath(request: Request, pathname: string): Request {
  const url = new URL(request.url);
  url.pathname = pathname;
  return new Request(url.toString(), request);
}

export async function fetchAssetWithRedirectFallback(request: Request, assets: Fetcher, pathname: string): Promise<Response> {
  const initialResponse = await assets.fetch(rewriteRequestPath(request, pathname));

  if (initialResponse.status < 300 || initialResponse.status >= 400) {
    return initialResponse;
  }

  const location = initialResponse.headers.get("location");

  if (!location) {
    return initialResponse;
  }

  const redirectedPathname = new URL(location, request.url).pathname;
  return assets.fetch(rewriteRequestPath(request, redirectedPathname));
}
