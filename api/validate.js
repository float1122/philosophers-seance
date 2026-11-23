// Trust-boundary validation for POST /api/seance.
import { PHILOSOPHER_IDS } from "./prompt.js";

export const MAX_WORRY_CODE_POINTS = 500;
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;
const INVALID = Object.freeze({ ok: false, status: 400, code: "INVALID_REQUEST" });

export function sanitizeWorry(s) {
  return String(s).replace(CONTROL_CHARS, "");
}

function isJsonContentType(request) {
  const type = request.headers.get("content-type") ?? "";
  return type.split(";")[0].trim().toLowerCase() === "application/json";
}

export async function parseAndValidate(request) {
  if (!isJsonContentType(request)) return INVALID;

  let body;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return INVALID;
  }
  if (body === null || typeof body !== "object") return INVALID;

  const { philosopherId, worry } = body;
  if (typeof philosopherId !== "string" || typeof worry !== "string") return INVALID;
  if (!PHILOSOPHER_IDS.includes(philosopherId)) return INVALID;

  const cleaned = sanitizeWorry(worry).trim();
  const length = [...cleaned].length;
  if (length === 0 || length > MAX_WORRY_CODE_POINTS) return INVALID;

  return { ok: true, philosopher: philosopherId, worry: cleaned };
}
