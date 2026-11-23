// The single serverless function: POST /api/seance {philosopherId, worry}.
// Order: 400 (input) -> 429 (limit or store missing, fail closed) -> 503 (key)
//        -> 429 (daily cap reached) -> call.
import { parseAndValidate } from "./validate.js";
import { parseDailyCallLimit } from "./limit.js";
import { DAY_TTL_SECONDS, utcDayKey } from "./usage-store.js";
import { usageStoreFromEnv } from "./d1-store.js";
import { getPhilosopher } from "./prompt.js";
import { callAnthropic } from "./anthropic.js";
import { errorResponse, jsonResponse } from "./response.js";

// Only shared, persistent stores may count calls in production. The
// in-memory store is accepted only when a caller opts in (dev server, tests).
function isUsableStore(store, allowEphemeralStore) {
  if (!store || typeof store.tryConsume !== "function") return false;
  return store.durable === true || allowEphemeralStore === true;
}

export function createHandler({
  env,
  store,
  fetch = globalThis.fetch,
  now = () => new Date(),
  allowEphemeralStore = false,
}) {
  return async function handle(request) {
    if (request.method !== "POST") {
      return new Response(null, { status: 405, headers: { allow: "POST" } });
    }

    const input = await parseAndValidate(request);
    if (!input.ok) return errorResponse("INVALID_REQUEST");

    const limit = parseDailyCallLimit(env.DAILY_CALL_LIMIT);
    if (limit === null || !isUsableStore(store, allowEphemeralStore)) {
      return errorResponse("SPIRITS_RESTING");
    }

    if (typeof env.ANTHROPIC_API_KEY !== "string" || env.ANTHROPIC_API_KEY.trim() === "") {
      return errorResponse("SPIRITS_UNREACHABLE");
    }

    let allowed = false;
    try {
      allowed = await store.tryConsume(utcDayKey(now()), limit, DAY_TTL_SECONDS);
    } catch (err) {
      console.warn(`[seance] usage store failed: ${err?.name ?? "Error"}`);
    }
    if (!allowed) return errorResponse("SPIRITS_RESTING");

    const { answer } = await callAnthropic({
      env,
      fetch,
      philosopher: getPhilosopher(input.philosopher),
      worry: input.worry,
    });
    return jsonResponse({ answer });
  };
}

// Platform entry: (Request, env) => Response. The usage store comes only from
// the SEANCE_DB D1 binding; without it every call is refused.
export default async function handler(request, env = globalThis.process?.env ?? {}) {
  return createHandler({ env, store: usageStoreFromEnv(env) })(request);
}
