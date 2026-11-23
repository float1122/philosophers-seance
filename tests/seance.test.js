// Feature: seance-core, Properties 1, 2, 9, 10 (handler orchestration).
import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { createHandler } from "../api/seance.js";
import { InMemoryUsageStore, utcDayKey } from "../api/usage-store.js";
import { PHILOSOPHER_IDS } from "../api/prompt.js";

const KEY = "test-placeholder";
const okFetch = () => {
  const fn = async () => new Response(JSON.stringify({ content: [{ type: "text", text: "Breathe, and look again." }] }));
  let n = 0;
  const wrapped = async (...a) => { n += 1; return fn(...a); };
  wrapped.count = () => n;
  return wrapped;
};
const failFetch = () => {
  let n = 0;
  const wrapped = async () => { n += 1; throw new Error("boom"); };
  wrapped.count = () => n;
  return wrapped;
};
const req = (philosopherId = "seneca", worry = "I cannot sleep.") =>
  new Request("http://local/api/seance", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ philosopherId, worry }),
  });

test("Property 1: invalid DAILY_CALL_LIMIT -> 429 SPIRITS_RESTING, zero calls, count unchanged", async () => {
  await fc.assert(
    fc.asyncProperty(fc.constantFrom(undefined, "", "0", "-1", "abc", "1.5", " "), async (limit) => {
      const store = new InMemoryUsageStore();
      const fetch = okFetch();
      const handler = createHandler({ env: { ANTHROPIC_API_KEY: KEY, DAILY_CALL_LIMIT: limit }, store, fetch, allowEphemeralStore: true });
      const res = await handler(req());
      assert.equal(res.status, 429);
      assert.deepEqual(await res.json(), { error: "SPIRITS_RESTING" });
      assert.equal(fetch.count(), 0);
      assert.equal(store.getCurrentCount(utcDayKey()), 0);
    }),
    { numRuns: 100 }
  );
});

test("Property 1: exhausted limit -> 429, never more than L accepted calls", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 5 }), fc.integer({ min: 0, max: 8 }), async (limit, extra) => {
      const store = new InMemoryUsageStore();
      const fetch = okFetch();
      const handler = createHandler({ env: { ANTHROPIC_API_KEY: KEY, DAILY_CALL_LIMIT: String(limit) }, store, fetch, allowEphemeralStore: true });
      const statuses = [];
      for (let i = 0; i < limit + extra; i += 1) statuses.push((await handler(req())).status);
      assert.equal(statuses.filter((s) => s === 200).length, limit);
      assert.equal(statuses.filter((s) => s === 429).length, extra);
      assert.equal(fetch.count(), limit);
      assert.equal(store.getCurrentCount(utcDayKey()), limit);
    }),
    { numRuns: 100 }
  );
});

test("Property 2: under limit the count increments by one and is kept when Anthropic fails", async () => {
  const store = new InMemoryUsageStore();
  const fetch = failFetch();
  const handler = createHandler({ env: { ANTHROPIC_API_KEY: KEY, DAILY_CALL_LIMIT: "3" }, store, fetch, allowEphemeralStore: true });
  const res = await handler(req());
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.answer.length > 0);
  assert.doesNotMatch(body.answer, /boom/);
  assert.equal(store.getCurrentCount(utcDayKey()), 1);
});

test("Property 9: missing or empty ANTHROPIC_API_KEY -> 503, zero calls, count unchanged", async () => {
  for (const key of [undefined, ""]) {
    const store = new InMemoryUsageStore();
    const fetch = okFetch();
    const handler = createHandler({ env: { ANTHROPIC_API_KEY: key, DAILY_CALL_LIMIT: "5" }, store, fetch, allowEphemeralStore: true });
    const res = await handler(req());
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { error: "SPIRITS_UNREACHABLE" });
    assert.equal(fetch.count(), 0);
    assert.equal(store.getCurrentCount(utcDayKey()), 0);
  }
});

test("Property 10: valid round trip -> 200 with non-empty answer", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.constantFrom(...PHILOSOPHER_IDS),
      fc.string({ minLength: 1, maxLength: 80 }).filter((s) => s.replace(/[\u0000-\u001F\u007F]/g, "").trim().length > 0),
      async (id, worry) => {
        const handler = createHandler({ env: { ANTHROPIC_API_KEY: KEY, DAILY_CALL_LIMIT: "1000" }, store: new InMemoryUsageStore(), fetch: okFetch(), allowEphemeralStore: true });
        const res = await handler(req(id, worry));
        assert.equal(res.status, 200);
        assert.equal((await res.json()).answer, "Breathe, and look again.");
      }
    ),
    { numRuns: 100 }
  );
});

test("invalid input -> 400 before limit or key checks", async () => {
  const fetch = okFetch();
  const handler = createHandler({ env: {}, store: new InMemoryUsageStore(), fetch });
  const res = await handler(req("plato", "hi"));
  assert.equal(res.status, 400);
  assert.equal(fetch.count(), 0);
});

test("non-POST methods are rejected with 405", async () => {
  const handler = createHandler({ env: {}, store: new InMemoryUsageStore(), fetch: okFetch() });
  const res = await handler(new Request("http://local/api/seance", { method: "GET" }));
  assert.equal(res.status, 405);
});

test("DI seam: any durable object with tryConsume can be injected", async () => {
  const seen = [];
  const fakeStore = { durable: true, tryConsume: async (day, limit) => { seen.push([day, limit]); return true; } };
  const handler = createHandler({ env: { ANTHROPIC_API_KEY: KEY, DAILY_CALL_LIMIT: "1" }, store: fakeStore, ipStore: { durable: true, tryConsume: async () => true }, fetch: okFetch() });
  const withIp = new Request(req(), { headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.7" } });
  assert.equal((await handler(withIp)).status, 200);
  assert.equal(seen.length, 1);
  assert.equal(seen[0][1], 1);
});
