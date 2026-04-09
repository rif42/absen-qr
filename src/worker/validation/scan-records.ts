export function isEventDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function isValidNotes(value: string): boolean {
  return value.length <= 2_000;
}
