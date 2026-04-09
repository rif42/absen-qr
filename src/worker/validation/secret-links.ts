import { ROLE_VALUES, type Role } from "../types";

const SECRET_TOKEN_PATTERN = /^[a-z0-9-]+$/;

export function isRole(value: string): value is Role {
  return ROLE_VALUES.includes(value as Role);
}

export function isValidSecretToken(value: string): boolean {
  return SECRET_TOKEN_PATTERN.test(value);
}
