// Feature: seance-core, Property 21 (client error mapping) and summon behaviour.
import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { createSummoner, mapErrorToMessage, MESSAGES, TIMEOUT_MS } from "../src/api-client.js";

test("Property 21: every failure maps to in-character text without technical detail", () => {
  fc.assert(
    fc.property(fc.integer({ min: 400, max: 599 }), fc.string(), (status, error) => {
      const msg = mapErrorToMessage({ status, error });
      assert.ok(msg.length > 0);
      assert.doesNotMatch(msg, /[0-9]/);
      assert.ok(!msg.includes("Error") && !msg.includes("stack"));
    }),
    { numRuns: 100 }
  );
});

test("429 SPIRITS_RESTING maps to the resting message", () => {
  assert.equal(mapErrorToMessage({ status: 429, error: "SPIRITS_RESTING" }), MESSAGES.resting);
  assert.match(MESSAGES.resting, /spirits are resting/i);
});

test("timeout maps to the timeout message and the timeout is thirty seconds", () => {
  assert.equal(TIMEOUT_MS, 30000);
  assert.equal(mapErrorToMessage({ kind: "timeout" }), MESSAGES.timeout);
});

test("summon posts JSON and returns the answer", async () => {
  let seen;
  const fetch = async (url, init) => { seen = { url, init }; return new Response(JSON.stringify({ answer: "Look inward." }), { status: 200 }); };
  const summon = createSummoner({ fetch });
  const out = await summon({ philosopherId: "laozi", worry: "x" });
  assert.deepEqual(out, { ok: true, answer: "Look inward." });
  assert.equal(seen.url, "/api/seance");
  assert.equal(seen.init.method, "POST");
  assert.deepEqual(JSON.parse(seen.init.body), { philosopherId: "laozi", worry: "x" });
});

test("summon maps a 429 to the resting message", async () => {
  const fetch = async () => new Response(JSON.stringify({ error: "SPIRITS_RESTING" }), { status: 429 });
  const out = await createSummoner({ fetch })({ philosopherId: "laozi", worry: "x" });
  assert.deepEqual(out, { ok: false, resting: true, message: MESSAGES.resting });
});

test("a new summon aborts the one in flight", async () => {
  const signals = [];
  const fetch = (url, init) => new Promise((resolve, reject) => {
    signals.push(init.signal);
    init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    if (signals.length === 2) resolve(new Response(JSON.stringify({ answer: "Second." })));
  });
  const summon = createSummoner({ fetch });
  const first = summon({ philosopherId: "seneca", worry: "a" });
  const second = summon({ philosopherId: "seneca", worry: "b" });
  assert.equal(signals[0].aborted, true);
  assert.deepEqual(await first, { ok: false, cancelled: true });
  assert.deepEqual(await second, { ok: true, answer: "Second." });
});

test("summon times out with an in-character message", async () => {
  const fetch = (url, init) => new Promise((_, reject) => {
    init.signal.addEventListener("abort", () => reject(new DOMException("t", "AbortError")));
  });
  const out = await createSummoner({ fetch, timeoutMs: 10 })({ philosopherId: "seneca", worry: "a" });
  assert.deepEqual(out, { ok: false, message: MESSAGES.timeout });
});
