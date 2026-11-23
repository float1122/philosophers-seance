// Per-IP daily cap: 30 calls per IP per UTC day, counted atomically in D1
// under a salted, day-scoped hash. Checked before the global cap.
import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import handler, { createHandler } from "../api/seance.js";
import { D1IpUsageStore, IP_DAILY_LIMIT, hashIp, ipStoreFromEnv } from "../api/ip-store.js";
import { D1UsageStore } from "../api/d1-store.js";
import { fakeD1 } from "./helpers/fake-d1.js";

const KEY = "test-placeholder";
const SALT = "test-salt-not-secret";
const DAY = "2026-12-01";
const IP_A = "203.0.113.7";
const IP_B = "198.51.100.42";

const req = (ip) =>
  new Request("http://local/api/seance", {
    method: "POST",
    headers: { "content-type": "application/json", ...(ip ? { "cf-connecting-ip": ip } : {}) },
    body: JSON.stringify({ philosopherId: "seneca", worry: "Will it pass?" }),
  });

function stubModel(t) {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ content: [{ type: "text", text: "Steady." }] }));
  };
  t.after(() => { globalThis.fetch = original; });
  return () => calls;
}

async function expectResting(res) {
  assert.equal(res.status, 429);
  assert.deepEqual(await res.json(), { error: "SPIRITS_RESTING" });
}

const env = (db, extra = {}) => ({
  ANTHROPIC_API_KEY: KEY,
  DAILY_CALL_LIMIT: "2000",
  IP_HASH_SALT: SALT,
  SEANCE_DB: db,
  ...extra,
});

test("the per-IP cap is 30", () => {
  assert.equal(IP_DAILY_LIMIT, 30);
});

test("allows 30 calls per IP, blocks the 31st with SPIRITS_RESTING", async (t) => {
  const modelCalls = stubModel(t);
  const e = env(fakeD1());
  for (let i = 0; i < 30; i += 1) assert.equal((await handler(req(IP_A), e)).status, 200);
  await expectResting(await handler(req(IP_A), e));
  await expectResting(await handler(req(IP_A), e));
  assert.equal(modelCalls(), 30);
});

test("different IPs are counted separately", async (t) => {
  stubModel(t);
  const e = env(fakeD1());
  for (let i = 0; i < 30; i += 1) await handler(req(IP_A), e);
  await expectResting(await handler(req(IP_A), e));
  assert.equal((await handler(req(IP_B), e)).status, 200);
});

test("store: per-IP limit holds for any limit and separates IPs", async () => {
  const db = fakeD1();
  const store = new D1IpUsageStore({ db, salt: SALT });
  const a = [];
  for (let i = 0; i < 5; i += 1) a.push(await store.tryConsume(DAY, IP_A, 3));
  assert.deepEqual(a, [true, true, true, false, false]);
  assert.equal(await store.tryConsume(DAY, IP_B, 3), true);
});

test("concurrent requests from one IP never pass the per-IP limit", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 6 }), fc.integer({ min: 1, max: 20 }), async (limit, extra) => {
      const db = fakeD1();
      const store = new D1IpUsageStore({ db, salt: SALT });
      const results = await Promise.all(
        Array.from({ length: limit + extra }, () => store.tryConsume(DAY, IP_A, limit))
      );
      assert.equal(results.filter(Boolean).length, limit);
      assert.equal(db.ipRows()[0].n, limit);
    }),
    { numRuns: 50 }
  );
});

test("concurrent requests through the handler make at most 30 model calls per IP", async (t) => {
  const modelCalls = stubModel(t);
  const e = env(fakeD1());
  const results = await Promise.all(Array.from({ length: 45 }, () => handler(req(IP_A), e)));
  assert.equal(results.filter((r) => r.status === 200).length, 30);
  assert.equal(results.filter((r) => r.status === 429).length, 15);
  assert.equal(modelCalls(), 30);
});

test("the per-IP count is checked with one atomic upsert", async () => {
  const db = fakeD1();
  await new D1IpUsageStore({ db, salt: SALT }).tryConsume(DAY, IP_A, 30);
  const upserts = db.queries.filter((q) => /INSERT INTO ip_usage/.test(q.sql));
  assert.equal(upserts.length, 1);
  assert.match(upserts[0].sql, /ON CONFLICT\(day, ?ip_hash\) DO UPDATE SET n = n \+ 1 WHERE n < \? RETURNING n/);
});

test("IP check comes before the global cap: a blocked IP does not use global calls", async (t) => {
  stubModel(t);
  const db = fakeD1();
  const e = env(db);
  const today = new Date().toISOString().slice(0, 10);
  for (let i = 0; i < 35; i += 1) await handler(req(IP_A), e);
  assert.equal(db.count(today), 30);
});

test("missing CF-Connecting-IP -> SPIRITS_RESTING, nothing counted, no model call", async (t) => {
  const modelCalls = stubModel(t);
  for (const ip of [undefined, "", "   "]) {
    const db = fakeD1();
    const r = new Request("http://local/api/seance", {
      method: "POST",
      headers: { "content-type": "application/json", ...(ip !== undefined ? { "cf-connecting-ip": ip } : {}) },
      body: JSON.stringify({ philosopherId: "seneca", worry: "Will it pass?" }),
    });
    await expectResting(await handler(r, env(db)));
    assert.equal(db.queries.length, 0);
  }
  assert.equal(modelCalls(), 0);
});

test("missing IP_HASH_SALT -> SPIRITS_RESTING, nothing counted, no model call", async (t) => {
  const modelCalls = stubModel(t);
  for (const salt of [undefined, "", "  "]) {
    const db = fakeD1();
    await expectResting(await handler(req(IP_A), env(db, { IP_HASH_SALT: salt })));
    assert.equal(db.queries.length, 0);
  }
  assert.equal(ipStoreFromEnv({ SEANCE_DB: fakeD1() }), null);
  assert.equal(ipStoreFromEnv({ IP_HASH_SALT: SALT }), null);
  assert.ok(ipStoreFromEnv({ SEANCE_DB: fakeD1(), IP_HASH_SALT: SALT }) instanceof D1IpUsageStore);
  assert.throws(() => new D1IpUsageStore({ db: fakeD1(), salt: "" }), TypeError);
  assert.equal(modelCalls(), 0);
});

test("a new UTC day allows the IP again and drops the old day's rows", async (t) => {
  const modelCalls = stubModel(t);
  const db = fakeD1();
  const e = env(db);
  let current = new Date("2026-12-01T23:59:00Z");
  const h = createHandler({
    env: e,
    store: new D1UsageStore({ db }),
    ipStore: ipStoreFromEnv(e),
    now: () => current,
  });
  for (let i = 0; i < 30; i += 1) await h(req(IP_A));
  await expectResting(await h(req(IP_A)));
  current = new Date("2026-12-02T00:00:01Z");
  assert.equal((await h(req(IP_A))).status, 200);
  const rows = db.ipRows();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].day, "2026-12-02");
  assert.equal(rows[0].n, 1);
  assert.equal(modelCalls(), 31);
});

test("hash is day-scoped and salted; the raw IP never reaches the database", async () => {
  await fc.assert(
    fc.asyncProperty(fc.ipV4(), async (ip) => {
      const db = fakeD1();
      await new D1IpUsageStore({ db, salt: SALT }).tryConsume(DAY, ip, 30);
      assert.ok(!db.dump().includes(ip));
      for (const q of db.queries) assert.ok(!JSON.stringify(q.params).includes(ip));
      assert.match(db.ipRows()[0].ip_hash, /^[0-9a-f]{64}$/);
    }),
    { numRuns: 50 }
  );
  const h1 = await hashIp(DAY, IP_A, SALT);
  assert.notEqual(h1, await hashIp("2026-12-02", IP_A, SALT));
  assert.notEqual(h1, await hashIp(DAY, IP_A, "other-salt"));
  assert.notEqual(h1, await hashIp(DAY, IP_B, SALT));
  const { createHash } = await import("node:crypto");
  assert.equal(h1, createHash("sha256").update(`${DAY}:${IP_A}:${SALT}`).digest("hex"));
});

test("IPv6 addresses work too and stay out of the database", async (t) => {
  stubModel(t);
  const db = fakeD1();
  const ip = "2001:db8::1";
  assert.equal((await handler(req(ip), env(db))).status, 200);
  assert.ok(!db.dump().includes(ip));
});
