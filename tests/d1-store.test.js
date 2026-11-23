// Cloudflare D1 usage store: one atomic upsert per call checks and increments
// the UTC day's counter, so concurrent requests can never pass the limit.
import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import handler from "../api/seance.js";
import { D1UsageStore, usageStoreFromEnv } from "../api/d1-store.js";
import { DAY_TTL_SECONDS } from "../api/usage-store.js";
import { fakeD1 } from "./helpers/fake-d1.js";

const KEY = "test-placeholder";
const SALT = "test-salt-not-secret";
const DAY = "2026-12-01";
const req = () =>
  new Request("http://local/api/seance", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.7" },
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

test("allows calls up to the limit, then blocks", async () => {
  for (const limit of [1, 2, 5]) {
    const db = fakeD1();
    const store = new D1UsageStore({ db });
    const results = [];
    for (let i = 0; i < limit + 3; i += 1) results.push(await store.tryConsume(DAY, limit, DAY_TTL_SECONDS));
    assert.deepEqual(results, [...Array(limit).fill(true), false, false, false]);
    assert.equal(db.count(DAY), limit);
  }
});

test("first call of the day inserts the row when the limit is 1", async () => {
  const db = fakeD1();
  const store = new D1UsageStore({ db });
  assert.equal(await store.tryConsume(DAY, 1, DAY_TTL_SECONDS), true);
  assert.equal(db.count(DAY), 1);
  assert.equal(await store.tryConsume(DAY, 1, DAY_TTL_SECONDS), false);
  assert.equal(db.count(DAY), 1);
});

test("each UTC day has its own counter", async () => {
  const db = fakeD1();
  const store = new D1UsageStore({ db });
  assert.equal(await store.tryConsume(DAY, 1, DAY_TTL_SECONDS), true);
  assert.equal(await store.tryConsume("2026-12-02", 1, DAY_TTL_SECONDS), true);
  assert.equal(await store.tryConsume(DAY, 1, DAY_TTL_SECONDS), false);
});

test("check and increment are one statement bound to (day, limit)", async () => {
  const db = fakeD1();
  await new D1UsageStore({ db }).tryConsume(DAY, 3, DAY_TTL_SECONDS);
  assert.equal(db.queries.length, 1);
  assert.match(db.queries[0].sql, /ON CONFLICT\(day\) DO UPDATE SET n = n \+ 1 WHERE n < \? RETURNING n/);
  assert.deepEqual(db.queries[0].params, [DAY, 3]);
});

test("concurrent requests never pass the limit", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 6 }), fc.integer({ min: 1, max: 20 }), async (limit, extra) => {
      const db = fakeD1();
      const store = new D1UsageStore({ db });
      const results = await Promise.all(
        Array.from({ length: limit + extra }, () => store.tryConsume(DAY, limit, DAY_TTL_SECONDS))
      );
      assert.equal(results.filter(Boolean).length, limit);
      assert.equal(db.count(DAY), limit);
    }),
    { numRuns: 50 }
  );
});

test("concurrent requests through the handler make at most L model calls", async (t) => {
  const modelCalls = stubModel(t);
  const env = { ANTHROPIC_API_KEY: KEY, DAILY_CALL_LIMIT: "3", IP_HASH_SALT: SALT, SEANCE_DB: fakeD1() };
  const results = await Promise.all(Array.from({ length: 12 }, () => handler(req(), env)));
  assert.equal(results.filter((r) => r.status === 200).length, 3);
  assert.equal(results.filter((r) => r.status === 429).length, 9);
  assert.equal(modelCalls(), 3);
});

test("a limit below 1 never consumes, even on the first call", async () => {
  for (const limit of [0, -1, 1.5, NaN, undefined]) {
    const db = fakeD1();
    assert.equal(await new D1UsageStore({ db }).tryConsume(DAY, limit, DAY_TTL_SECONDS), false);
    assert.equal(db.count(DAY), 0);
  }
});

test("usageStoreFromEnv needs a D1 binding named SEANCE_DB", () => {
  assert.equal(usageStoreFromEnv({}), null);
  assert.equal(usageStoreFromEnv(undefined), null);
  assert.equal(usageStoreFromEnv({ SEANCE_DB: "not a binding" }), null);
  assert.equal(usageStoreFromEnv({ SEANCE_USAGE: fakeD1() }), null);
  const store = usageStoreFromEnv({ SEANCE_DB: fakeD1() });
  assert.ok(store instanceof D1UsageStore);
  assert.equal(store.durable, true);
});

test("missing D1 binding -> SPIRITS_RESTING, no model call", async (t) => {
  const modelCalls = stubModel(t);
  await expectResting(await handler(req(), { ANTHROPIC_API_KEY: KEY, DAILY_CALL_LIMIT: "5" }));
  const { onRequest } = await import("../functions/api/seance.js");
  await expectResting(await onRequest({ request: req(), env: { ANTHROPIC_API_KEY: KEY, DAILY_CALL_LIMIT: "5" } }));
  assert.equal(modelCalls(), 0);
});

test("D1 error -> SPIRITS_RESTING, no model call", async (t) => {
  const modelCalls = stubModel(t);
  const env = { ANTHROPIC_API_KEY: KEY, DAILY_CALL_LIMIT: "5", IP_HASH_SALT: SALT, SEANCE_DB: fakeD1({ failWith: new Error("D1_ERROR") }) };
  await expectResting(await handler(req(), env));
  assert.equal(modelCalls(), 0);
});

test("empty or invalid limit -> SPIRITS_RESTING without touching D1", async (t) => {
  const modelCalls = stubModel(t);
  for (const limit of [undefined, "", "0", "abc"]) {
    const db = fakeD1();
    await expectResting(await handler(req(), { ANTHROPIC_API_KEY: KEY, DAILY_CALL_LIMIT: limit, SEANCE_DB: db }));
    assert.equal(db.queries.length, 0);
  }
  assert.equal(modelCalls(), 0);
});

test("Pages Function adapter enforces the limit through SEANCE_DB", async (t) => {
  const modelCalls = stubModel(t);
  const { onRequest } = await import("../functions/api/seance.js");
  const env = { ANTHROPIC_API_KEY: KEY, DAILY_CALL_LIMIT: "1", IP_HASH_SALT: SALT, SEANCE_DB: fakeD1() };
  assert.equal((await onRequest({ request: req(), env })).status, 200);
  await expectResting(await onRequest({ request: req(), env }));
  assert.equal(modelCalls(), 1);
});
