// The single serverless function: POST /api/seance {philosopherId, worry}.
// Order: 400 (input) -> 429 (limit, store, IP store/salt or CF-Connecting-IP
//        missing, fail closed) -> 503 (key) -> 429 (per-IP cap) -> 429 (daily
//        cap) -> call. The per-IP cap is checked first so one client cannot
//        use up the global cap.
import { parseAndValidate } from "./validate.js";
import { parseDailyCallLimit } from "./limit.js";
import { DAY_TTL_SECONDS, utcDayKey } from "./usage-store.js";
import { usageStoreFromEnv } from "./d1-store.js";
import { clientIp, ipStoreFromEnv } from "./ip-store.js";
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
  ipStore = null,
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

    // The per-IP store is required in production. Only the dev server and
    // tests (allowEphemeralStore) may run without one.
    const enforceIpCap = ipStore !== null || !allowEphemeralStore;
    const ip = clientIp(request);
    if (enforceIpCap && (!isUsableStore(ipStore, false) || ip === null)) {
      return errorResponse("SPIRITS_RESTING");
    }

    if (typeof env.ANTHROPIC_API_KEY !== "string" || env.ANTHROPIC_API_KEY.trim() === "") {
      return errorResponse("SPIRITS_UNREACHABLE");
    }

    const day = utcDayKey(now());
    let allowed = false;
    try {
      const ipAllowed = !enforceIpCap || (await ipStore.tryConsume(day, ip));
      allowed = ipAllowed && (await store.tryConsume(day, limit, DAY_TTL_SECONDS));
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

// Platform entry: (Request, env) => Response. Both stores come only from the
// SEANCE_DB D1 binding (the IP store also needs IP_HASH_SALT); without them
// every call is refused.
export default async function handler(request, env = globalThis.process?.env ?? {}) {
  return createHandler({ env, store: usageStoreFromEnv(env), ipStore: ipStoreFromEnv(env) })(request);
}
