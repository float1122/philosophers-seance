// Anthropic Messages API client. Upstream failures never leak to callers.
import { buildSystemPrompt } from "./prompt.js";
import { fallbackAnswer } from "./response.js";

export const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
export const ANTHROPIC_VERSION = "2023-06-01";
export const MODEL = "claude-haiku-5-5";
export const MAX_TOKENS = 1024;

function extractText(data) {
  const blocks = Array.isArray(data?.content) ? data.content : [];
  const first = blocks.find((b) => b?.type === "text" && typeof b.text === "string");
  return first ? first.text.trim() : "";
}

export async function callAnthropic({ env, fetch, philosopher, worry }) {
  const fallback = { ok: false, answer: fallbackAnswer("SPIRITS_UNREACHABLE") };
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "anthropic-version": ANTHROPIC_VERSION,
        "x-api-key": env.ANTHROPIC_API_KEY,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: buildSystemPrompt(philosopher),
        messages: [{ role: "user", content: worry }],
      }),
    });
    if (!res.ok) {
      console.warn(`[seance] upstream status ${res.status}`);
      return fallback;
    }
    const answer = extractText(await res.json());
    return answer ? { ok: true, answer } : fallback;
  } catch (err) {
    console.warn(`[seance] upstream request failed: ${err?.name ?? "Error"}`);
    return fallback;
  }
}
