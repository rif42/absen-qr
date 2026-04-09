export const ROLE_VALUES = ["student", "mentor", "admin"] as const;

export type Role = (typeof ROLE_VALUES)[number];

export type PageRouteMatch = {
  kind: "page";
  role: Role;
  secretToken: string;
};

export type ApiRouteMatch = {
  kind: "api";
  role: Role;
  secretToken: string;
  apiPath: string;
};

export type SecretLinkRouteMatch = PageRouteMatch | ApiRouteMatch;

export type Env = {
  ADMIN_SECRET: string;
  EVENT_DATE: string;
  ASSETS: Fetcher;
  DB: D1Database;
};

export type PersonRecord = {
  person_id: string;
  display_name: string;
  role: Exclude<Role, "admin">;
  secret_id: string;
  secret_path_token: string;
};

export type ScanRecord = {
  scan_id: string;
  student_id: string;
  mentor_id: string;
  event_date: string;
  scanned_at: string;
  notes: string;
  updated_at: string;
};
