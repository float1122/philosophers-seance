// Browser client for POST /api/seance. Visitors only ever see in-character text.
export const TIMEOUT_MS = 30000;

export const MESSAGES = Object.freeze({
  resting: "The spirits are resting now. The candles have burned low for today; return after the next midnight.",
  timeout: "The spirits linger too long. The flame gutters; ask again another night.",
  unreachable: "The veil is too thick tonight; no spirit answers. Ask again when the flame steadies.",
  invalid: "The board cannot read your question. Shape your worry in plainer words and ask again.",
});

export function mapErrorToMessage({ status, error, kind } = {}) {
  if (kind === "timeout") return MESSAGES.timeout;
  if (status === 429 || error === "SPIRITS_RESTING") return MESSAGES.resting;
  if (status === 400) return MESSAGES.invalid;
  return MESSAGES.unreachable;
}

export function createSummoner({ fetch = globalThis.fetch.bind(globalThis), timeoutMs = TIMEOUT_MS, endpoint = "/api/seance" } = {}) {
  let current = null;

  return async function summon({ philosopherId, worry }) {
    if (current) current.abort("superseded");
    const controller = new AbortController();
    current = controller;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort("timeout"); }, timeoutMs);

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ philosopherId, worry }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof data.answer === "string" && data.answer.trim()) {
        return { ok: true, answer: data.answer };
      }
      const message = mapErrorToMessage({ status: res.status, error: data.error });
      return res.status === 429 ? { ok: false, resting: true, message } : { ok: false, message };
    } catch {
      if (timedOut) return { ok: false, message: MESSAGES.timeout };
      if (controller.signal.aborted) return { ok: false, cancelled: true };
      return { ok: false, message: MESSAGES.unreachable };
    } finally {
      clearTimeout(timer);
      if (current === controller) current = null;
    }
  };
}
