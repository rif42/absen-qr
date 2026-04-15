import type { Env } from "../types";
import { isEventDate } from "../validation/scan-records";

export function getConfiguredEventDate(env: Env): string {
  if (isEventDate(env.EVENT_DATE)) {
    return env.EVENT_DATE;
  }

  throw new Error("Invalid EVENT_DATE configuration.");
}

export function getCurrentUtcDate(now: Date = new Date()): string {
  const utcDate = now.toISOString().slice(0, 10);

  if (isEventDate(utcDate)) {
    return utcDate;
  }

  throw new Error("Invalid current UTC date.");
}

export function getUtcDayKey(timestamp: Date | string): string {
  const isoString = typeof timestamp === "string" ? timestamp : timestamp.toISOString();
  const utcDate = isoString.slice(0, 10);

  if (isEventDate(utcDate)) {
    return utcDate;
  }

  throw new Error("Invalid UTC day key.");
}
