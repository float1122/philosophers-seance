// Cloudflare D1 usage store (binding name: SEANCE_DB, table from
// migrations/0001_usage.sql). Check and increment happen in one upsert, so
// concurrent requests cannot both pass the limit: when the day's count has
// reached the limit the UPDATE's WHERE fails and no row is returned.
// Rows are keyed by UTC day, so ttlSeconds is not needed; old rows are left.

export const D1_BINDING = "SEANCE_DB";

export const CONSUME_SQL =
  "INSERT INTO usage(day,n) VALUES(?,1) ON CONFLICT(day) DO UPDATE SET n = n + 1 WHERE n < ? RETURNING n";

const isD1Binding = (db) => Boolean(db) && typeof db.prepare === "function";

export class D1UsageStore {
  durable = true;
  #db;

  constructor({ db }) {
    if (!isD1Binding(db)) throw new TypeError("D1 binding required");
    this.#db = db;
  }

  async tryConsume(utcDay, limit) {
    // The INSERT branch ignores the WHERE clause, so a limit below 1 must be
    // refused here or the first call of the day would still be counted.
    if (!Number.isSafeInteger(limit) || limit < 1) return false;
    const row = await this.#db.prepare(CONSUME_SQL).bind(utcDay, limit).first();
    return row !== null && row !== undefined;
  }
}

export function usageStoreFromEnv(env) {
  const db = env?.[D1_BINDING];
  return isD1Binding(db) ? new D1UsageStore({ db }) : null;
}
