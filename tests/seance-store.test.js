// Usage store hardening: the deployed function must fail closed unless a
// durable store with atomic consume + expiry is configured.
import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import handler, { createHandler } from "../api/seance.js";
import { InMemoryUsageStore, DAY_TTL_SECONDS } from "../api/usage-store.js";
import { fakeKv } from "./helpers/fake-kv.js";

const KEY = "test-placeholder";
const req = () =>
  new Request("http://local/api/seance", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ philosopherId: "seneca", worry: "Will it pass?" }),
  });
const countingFetch = () => {
  let n = 0;
  const f = async () => { n += 1; return new Response(JSON.stringify({ content: [{ type: "text", text: "It will." }] })); };
  f.count = () => n;
  return f;
};

// A fake durable store: atomic check-and-increment with expiry.
function fakeDurableStore() {
  const counts = new Map();
  const calls = [];
  return {
    durable: true,
    calls,
    async tryConsume(utcDay, limit, ttlSeconds) {
      calls.push({ utcDay, limit, ttlSeconds });
      const n = counts.get(utcDay) ?? 0;
      if (n >= limit) return false;
      counts.set(utcDay, n + 1);
      return true;
    },
  };
}

async function expectResting(res) {
  assert.equal(res.status, 429);
  assert.deepEqual(await res.json(), { error: "SPIRITS_RESTING" });
}

test("no store configured -> SPIRITS_RESTING and no model call", async () => {
  const fetch = countingFetch();
  const h = createHandler({ env: { ANTHROPIC_API_KEY: KEY, DAILY_CALL_LIMIT: "5" }, fetch });
  await expectResting(await h(req()));
  assert.equal(fetch.count(), 0);
});

test("in-memory store is refused unless explicitly allowed for dev/test", async () => {
  const fetch = countingFetch();
  const h = createHandler({ env: { ANTHROPIC_API_KEY: KEY, DAILY_CALL_LIMIT: "5" }, store: new InMemoryUsageStore(), fetch });
  await expectResting(await h(req()));
  assert.equal(fetch.count(), 0);
});

test("store without tryConsume is refused", async () => {
  const fetch = countingFetch();
  const h = createHandler({ env: { ANTHROPIC_API_KEY: KEY, DAILY_CALL_LIMIT: "5" }, store: { durable: true }, fetch });
  await expectResting(await h(req()));
  assert.equal(fetch.count(), 0);
});

test("default export fails closed when no durable store is configured", async (t) => {
  const original = { key: process.env.ANTHROPIC_API_KEY, limit: process.env.DAILY_CALL_LIMIT, fetch: globalThis.fetch };
  let called = 0;
  globalThis.fetch = async () => { called += 1; return new Response("{}"); };
  process.env.ANTHROPIC_API_KEY = KEY;
  process.env.DAILY_CALL_LIMIT = "5";
  t.after(() => {
    globalThis.fetch = original.fetch;
    if (original.key === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = original.key;
    if (original.limit === undefined) delete process.env.DAILY_CALL_LIMIT; else process.env.DAILY_CALL_LIMIT = original.limit;
  });
  await expectResting(await handler(req()));
  assert.equal(called, 0);
});

test("durable store + empty limit -> SPIRITS_RESTING without touching the store", async () => {
  for (const limit of [undefined, "", "0", "abc"]) {
    const store = fakeDurableStore();
    const fetch = countingFetch();
    const h = createHandler({ env: { ANTHROPIC_API_KEY: KEY, DAILY_CALL_LIMIT: limit }, store, fetch });
    await expectResting(await h(req()));
    assert.equal(store.calls.length, 0);
    assert.equal(fetch.count(), 0);
  }
});

test("durable store over the limit -> SPIRITS_RESTING; never more than L model calls", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 5 }), fc.integer({ min: 1, max: 6 }), async (limit, extra) => {
      const store = fakeDurableStore();
      const fetch = countingFetch();
      const h = createHandler({ env: { ANTHROPIC_API_KEY: KEY, DAILY_CALL_LIMIT: String(limit) }, store, fetch });
      const results = await Promise.all(Array.from({ length: limit + extra }, () => h(req())));
      assert.equal(results.filter((r) => r.status === 200).length, limit);
      assert.equal(results.filter((r) => r.status === 429).length, extra);
      assert.equal(fetch.count(), limit);
    }),
    { numRuns: 100 }
  );
});

test("durable store receives the UTC day, the limit and an expiry", async () => {
  const store = fakeDurableStore();
  const h = createHandler({
    env: { ANTHROPIC_API_KEY: KEY, DAILY_CALL_LIMIT: "3" },
    store,
    fetch: countingFetch(),
    now: () => new Date("2026-12-01T23:59:00Z"),
  });
  assert.equal((await h(req())).status, 200);
  assert.deepEqual(store.calls, [{ utcDay: "2026-12-01", limit: 3, ttlSeconds: DAY_TTL_SECONDS }]);
  assert.ok(DAY_TTL_SECONDS >= 24 * 60 * 60);
});

test("a failing store fails closed", async () => {
  const fetch = countingFetch();
  const store = { durable: true, tryConsume: async () => { throw new Error("store down"); } };
  const h = createHandler({ env: { ANTHROPIC_API_KEY: KEY, DAILY_CALL_LIMIT: "3" }, store, fetch });
  await expectResting(await h(req()));
  assert.equal(fetch.count(), 0);
});

test("in-memory tryConsume is atomic under concurrent calls", async () => {
  const store = new InMemoryUsageStore();
  const results = await Promise.all(Array.from({ length: 10 }, () => store.tryConsume("2026-12-01", 4, DAY_TTL_SECONDS)));
  assert.equal(results.filter(Boolean).length, 4);
  assert.equal(store.getCurrentCount("2026-12-01"), 4);
  assert.equal(store.durable, false);
});

test("default export uses the SEANCE_USAGE KV binding and enforces the limit", async (t) => {
  const originalFetch = globalThis.fetch;
  let modelCalls = 0;
  globalThis.fetch = async () => { modelCalls += 1; return new Response(JSON.stringify({ content: [{ type: "text", text: "Steady." }] })); };
  t.after(() => { globalThis.fetch = originalFetch; });
  const env = { ANTHROPIC_API_KEY: KEY, DAILY_CALL_LIMIT: "1", SEANCE_USAGE: fakeKv() };
  assert.equal((await handler(req(), env)).status, 200);
  await expectResting(await handler(req(), env));
  assert.equal(modelCalls, 1);
});

test("Pages Function adapter: no KV binding -> SPIRITS_RESTING", async () => {
  const { onRequest } = await import("../functions/api/seance.js");
  const res = await onRequest({ request: req(), env: { ANTHROPIC_API_KEY: KEY, DAILY_CALL_LIMIT: "5" } });
  await expectResting(res);
});

test("Pages Function adapter: empty limit or limit reached -> SPIRITS_RESTING", async (t) => {
  const { onRequest } = await import("../functions/api/seance.js");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ content: [{ type: "text", text: "Breathe." }] }));
  t.after(() => { globalThis.fetch = originalFetch; });
  await expectResting(await onRequest({ request: req(), env: { ANTHROPIC_API_KEY: KEY, DAILY_CALL_LIMIT: "", SEANCE_USAGE: fakeKv() } }));
  const env = { ANTHROPIC_API_KEY: KEY, DAILY_CALL_LIMIT: "1", SEANCE_USAGE: fakeKv() };
  assert.equal((await onRequest({ request: req(), env })).status, 200);
  await expectResting(await onRequest({ request: req(), env }));
});
