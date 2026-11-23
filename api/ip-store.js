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

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const HEX_GROUP_RE = /^[0-9a-f]{1,4}$/;
const IPV6_GROUPS = 8;

function parseIpv4(text) {
  const m = IPV4_RE.exec(text);
  if (!m) return null;
  const octets = m.slice(1).map(Number);
  return octets.every((o) => o <= 255) ? octets : null;
}

function parseHexGroups(part) {
  if (part === "") return [];
  const groups = part.split(":");
  return groups.every((g) => HEX_GROUP_RE.test(g)) ? groups.map((g) => parseInt(g, 16)) : null;
}

// Expands an IPv6 address (with optional "::" and trailing dotted IPv4) into
// 8 numeric groups, or null when it is not a valid address.
function parseIpv6(text) {
  let addr = text.toLowerCase().replace(/%.*$/, "");
  const lastColon = addr.lastIndexOf(":");
  if (addr.slice(lastColon + 1).includes(".")) {
    const v4 = parseIpv4(addr.slice(lastColon + 1));
    if (!v4) return null;
    const hi = ((v4[0] << 8) | v4[1]).toString(16);
    const lo = ((v4[2] << 8) | v4[3]).toString(16);
    addr = `${addr.slice(0, lastColon + 1)}${hi}:${lo}`;
  }
  const halves = addr.split("::");
  if (halves.length > 2) return null;
  const head = parseHexGroups(halves[0]);
  const tail = halves.length === 2 ? parseHexGroups(halves[1]) : [];
  if (!head || !tail) return null;
  if (halves.length === 1) return head.length === IPV6_GROUPS ? head : null;
  const missing = IPV6_GROUPS - head.length - tail.length;
  return missing >= 1 ? [...head, ...Array(missing).fill(0), ...tail] : null;
}

const isIpv4Mapped = (g) => g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff;

// Rate-limit key for a client address: full IPv4 ("a.b.c.d", also for
// ::ffff:a.b.c.d) or the IPv6 /64 prefix ("xxxx:xxxx:xxxx:xxxx::/64").
// Returns null for anything that is not an IP address.
export function normalizeIp(raw) {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  const v4 = parseIpv4(text);
  if (v4) return v4.join(".");
  if (!text.includes(":")) return null;
  const groups = parseIpv6(text);
  if (!groups) return null;
  if (isIpv4Mapped(groups)) {
    return [groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff].join(".");
  }
  const prefix = groups.slice(0, 4).map((g) => g.toString(16).padStart(4, "0"));
  return `${prefix.join(":")}::/64`;
}

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
    const key = normalizeIp(ip);
    if (key === null) return false;
    const ipHash = await hashIp(utcDay, key, this.#salt);
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
