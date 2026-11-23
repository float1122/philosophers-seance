// JSON response helpers, error bodies and in-character fallback copy.

const STATUS_BY_CODE = Object.freeze({
  INVALID_REQUEST: 400,
  SPIRITS_RESTING: 429,
  SPIRITS_UNREACHABLE: 503,
});

const FALLBACKS = Object.freeze({
  SPIRITS_RESTING:
    "The spirits are resting now. Return when the candle burns brighter.",
  SPIRITS_UNREACHABLE:
    "The veil is too thick tonight; no spirit answers. Ask again when the flame steadies.",
  INVALID_REQUEST:
    "The board cannot read your question. Shape your worry in plainer words and ask again.",
  TIMEOUT:
    "The spirits linger too long. The flame gutters; ask again another night.",
});

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export function errorResponse(code) {
  const status = STATUS_BY_CODE[code] ?? 400;
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function fallbackAnswer(reason) {
  return FALLBACKS[reason] ?? FALLBACKS.SPIRITS_UNREACHABLE;
}

export function redact(text, { apiKey, worry } = {}) {
  let out = String(text);
  for (const secret of [apiKey, worry]) {
    if (typeof secret === "string" && secret.length > 0) {
      out = out.split(secret).join("[redacted]");
    }
  }
  return out;
}
