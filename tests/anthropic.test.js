// Feature: seance-core, Property 11 and Property 13 (Anthropic client).
import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { callAnthropic, ANTHROPIC_URL, MODEL } from "../api/anthropic.js";
import { PHILOSOPHERS } from "../api/prompt.js";

const env = { ANTHROPIC_API_KEY: "test-placeholder" };
const okBody = (text) => ({ content: [{ type: "text", text }] });

function mockFetch(impl) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    return impl(url, init);
  };
  fn.calls = calls;
  return fn;
}

test("Property 11: payload uses claude-haiku-5-5, max_tokens 1024, only the Messages endpoint", async () => {
  await fc.assert(
    fc.asyncProperty(fc.constantFrom(...PHILOSOPHERS), fc.string({ minLength: 1, maxLength: 50 }), async (p, worry) => {
      const fetch = mockFetch(() => new Response(JSON.stringify(okBody("hush")), { status: 200 }));
      await callAnthropic({ env, fetch, philosopher: p, worry });
      assert.equal(fetch.calls.length, 1);
      const { url, init } = fetch.calls[0];
      assert.equal(url, ANTHROPIC_URL);
      assert.equal(url, "https://api.anthropic.com/v1/messages");
      const body = JSON.parse(init.body);
      assert.equal(body.model, MODEL);
      assert.equal(body.model, "claude-haiku-5-5");
      assert.equal(body.max_tokens, 1024);
      assert.ok(body.system.includes(p.persona));
      assert.deepEqual(body.messages, [{ role: "user", content: worry }]);
      assert.equal(init.headers["x-api-key"], env.ANTHROPIC_API_KEY);
    }),
    { numRuns: 100 }
  );
});

test("returns the first text block as the answer", async () => {
  const fetch = mockFetch(() => new Response(JSON.stringify({ content: [{ type: "thinking" }, { type: "text", text: " Be still. " }] })));
  const out = await callAnthropic({ env, fetch, philosopher: PHILOSOPHERS[0], worry: "w" });
  assert.deepEqual(out, { answer: "Be still.", ok: true });
});

test("Property 13: upstream failure yields an in-character answer with no upstream detail", async () => {
  const failures = fc.constantFrom(
    () => new Response("upstream exploded: overloaded_error", { status: 529 }),
    () => new Response("bad", { status: 401 }),
    () => { throw new Error("ECONNRESET stack trace here"); },
    () => new Response(JSON.stringify(okBody("   ")), { status: 200 }),
    () => new Response(JSON.stringify({ content: [] }), { status: 200 }),
    () => new Response("not json", { status: 200 })
  );
  await fc.assert(
    fc.asyncProperty(failures, async (impl) => {
      const fetch = mockFetch(impl);
      const out = await callAnthropic({ env, fetch, philosopher: PHILOSOPHERS[1], worry: "w" });
      assert.equal(out.ok, false);
      assert.ok(out.answer.length > 0);
      assert.doesNotMatch(out.answer, /overloaded|ECONNRESET|stack|529|401|json/i);
    }),
    { numRuns: 100 }
  );
});
