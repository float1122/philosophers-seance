// Cloudflare Pages Function for /api/seance. Needs the SEANCE_USAGE KV
// binding plus ANTHROPIC_API_KEY and DAILY_CALL_LIMIT; without them it
// refuses every call.
import handler from "../../api/seance.js";

export function onRequest(context) {
  return handler(context.request, context.env);
}
