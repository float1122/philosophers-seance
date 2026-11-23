// The single serverless function: POST /api/seance {philosopherId, worry}.
// Order: 400 (input) -> 429 (limit, fail closed) -> 503 (key) -> count -> call.
import { parseAndValidate } from "./validate.js";
import { parseDailyCallLimit } from "./limit.js";
import { InMemoryUsageStore, utcDayKey } from "./usage-store.js";
import { getPhilosopher } from "./prompt.js";
import { callAnthropic } from "./anthropic.js";
import { errorResponse, jsonResponse } from "./response.js";

export function createHandler({ env, store, fetch = globalThis.fetch, now = () => new Date() }) {
  return async function handle(request) {
    if (request.method !== "POST") {
      return new Response(null, { status: 405, headers: { allow: "POST" } });
    }

    const input = await parseAndValidate(request);
    if (!input.ok) return errorResponse("INVALID_REQUEST");

    const limit = parseDailyCallLimit(env.DAILY_CALL_LIMIT);
    const day = utcDayKey(now());
    if (limit === null || store.getCurrentCount(day) >= limit) {
      return errorResponse("SPIRITS_RESTING");
    }

    if (typeof env.ANTHROPIC_API_KEY !== "string" || env.ANTHROPIC_API_KEY.trim() === "") {
      return errorResponse("SPIRITS_UNREACHABLE");
    }

    store.getAndIncrement(day);
    const { answer } = await callAnthropic({
      env,
      fetch,
      philosopher: getPhilosopher(input.philosopher),
      worry: input.worry,
    });
    return jsonResponse({ answer });
  };
}

// Default export for platforms that call a (Request) => Response function.
let defaultHandler;
export default async function handler(request) {
  defaultHandler ??= createHandler({ env: process.env, store: new InMemoryUsageStore() });
  return defaultHandler(request);
}
