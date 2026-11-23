// Per-IP daily usage store on the SEANCE_DB D1 binding (table ip_usage from
// migrations/0002_ip_usage.sql). The raw IP is never stored: the key is
// SHA-256(day + ":" + ip + ":" + IP_HASH_SALT), so it changes every UTC day
// and cannot be reversed without the secret salt. Rows from other days are
// deleted on each call. Counting is one atomic upsert, like d1-store.js.

import { D1_BINDING } from "./d1-store.js";

export const IP_DAILY_LIMIT = 30;
export const IP_SALT_ENV = "IP_HASH_SALT";

export const PURGE_SQL = "DELETE FROM ip_usage WHERE day <> ?";
export const CONSUME_IP_SQL =
  "INSERT INTO ip_usage(day,ip_hash,n) VALUES(?,?,1) ON CONFLICT(day,ip_hash) DO UPDATE SET n = n + 1 WHERE n < ? RETURNING n";

const isD1Binding = (db) => Boolean(db) && typeof db.prepare === "function";
const isNonEmpty = (value) => typeof value === "string" && value.trim() !== "";

export async function hashIp(utcDay, ip, salt) {
  const bytes = new TextEncoder().encode(`${utcDay}:${ip}:${salt}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export class D1IpUsageStore {
  durable = true;
  #db;
  #salt;

  constructor({ db, salt }) {
    if (!isD1Binding(db)) throw new TypeError("D1 binding required");
    if (!isNonEmpty(salt)) throw new TypeError("IP hash salt required");
    this.#db = db;
    this.#salt = salt;
  }

  async tryConsume(utcDay, ip, limit = IP_DAILY_LIMIT) {
    // Same guard as D1UsageStore: the INSERT branch ignores the WHERE clause.
    if (!Number.isSafeInteger(limit) || limit < 1) return false;
    if (!isNonEmpty(ip)) return false;
    const ipHash = await hashIp(utcDay, ip.trim(), this.#salt);
    await this.#db.prepare(PURGE_SQL).bind(utcDay).run();
    const row = await this.#db.prepare(CONSUME_IP_SQL).bind(utcDay, ipHash, limit).first();
    return row !== null && row !== undefined;
  }
}

export function ipStoreFromEnv(env) {
  const db = env?.[D1_BINDING];
  const salt = env?.[IP_SALT_ENV];
  if (!isD1Binding(db) || !isNonEmpty(salt)) return null;
  return new D1IpUsageStore({ db, salt });
}

// Cloudflare sets CF-Connecting-IP on every request; null when absent/empty.
export function clientIp(request) {
  const ip = request.headers.get("cf-connecting-ip");
  return isNonEmpty(ip) ? ip.trim() : null;
}
