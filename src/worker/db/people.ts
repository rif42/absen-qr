import type { PersonRecord, Role } from "../types";

export async function findPersonBySecretToken(
  db: D1Database,
  role: Exclude<Role, "admin">,
  secretToken: string
): Promise<PersonRecord | null> {
  const statement = db
    .prepare(
      `
        SELECT person_id, display_name, role, secret_id, secret_path_token
        FROM people
        WHERE role = ?1 AND secret_path_token = ?2
        LIMIT 1
      `
    )
    .bind(role, secretToken);

  const result = await statement.first<PersonRecord>();
  return result ?? null;
}

export async function findPersonById(
  db: D1Database,
  role: Exclude<Role, "admin">,
  personId: string
): Promise<PersonRecord | null> {
  const statement = db
    .prepare(
      `
        SELECT person_id, display_name, role, secret_id, secret_path_token
        FROM people
        WHERE role = ?1 AND person_id = ?2
        LIMIT 1
      `
    )
    .bind(role, personId);

  const result = await statement.first<PersonRecord>();
  return result ?? null;
}

export async function listPeopleByRole(
  db: D1Database,
  role: Exclude<Role, "admin">,
): Promise<PersonRecord[]> {
  const statement = db
    .prepare(
      `
        SELECT person_id, display_name, role, secret_id, secret_path_token
        FROM people
        WHERE role = ?1
        ORDER BY display_name ASC
      `
    )
    .bind(role);

  const result = await statement.all<PersonRecord>();
  return result.results;
}
