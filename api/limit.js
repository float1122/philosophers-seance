// Parse DAILY_CALL_LIMIT. Anything but a positive integer fails closed (null).
const POSITIVE_INT = /^[1-9][0-9]*$/;

export function parseDailyCallLimit(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!POSITIVE_INT.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isSafeInteger(n) ? n : null;
}
