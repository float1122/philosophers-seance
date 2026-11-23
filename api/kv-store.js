// Cloudflare KV usage store (binding name: SEANCE_USAGE).
// KV has no atomic increment, so this is get -> put on a per-UTC-day key with
// an expirationTtl. Concurrent bursts (and KV's eventual consistency across
// locations) can let a few calls past the limit; see README "Limits".

export const KV_KEY_PREFIX = "seance:calls:";
export const KV_BINDING = "SEANCE_USAGE";

const isKvBinding = (kv) => Boolean(kv) && typeof kv.get === "function" && typeof kv.put === "function";

export class KvUsageStore {
  durable = true;
  #kv;

  constructor({ kv }) {
    if (!isKvBinding(kv)) throw new TypeError("KV binding required");
    this.#kv = kv;
  }

  async tryConsume(utcDay, limit, ttlSeconds) {
    const key = `${KV_KEY_PREFIX}${utcDay}`;
    const raw = await this.#kv.get(key);
    const count = raw === null ? 0 : Number(raw);
    if (!Number.isInteger(count) || count < 0) throw new Error("usage counter unreadable");
    if (count >= limit) return false;
    await this.#kv.put(key, String(count + 1), { expirationTtl: ttlSeconds });
    return true;
  }
}

export function usageStoreFromEnv(env) {
  const kv = env?.[KV_BINDING];
  return isKvBinding(kv) ? new KvUsageStore({ kv }) : null;
}
