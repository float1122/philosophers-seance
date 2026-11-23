// Cloudflare KV usage store: per-UTC-day key counted with get -> put and an
// expirationTtl. KV has no atomic INCR, so concurrent bursts may overshoot
// slightly (documented in README and design.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import { KvUsageStore, usageStoreFromEnv, KV_KEY_PREFIX } from "../api/kv-store.js";
import { DAY_TTL_SECONDS } from "../api/usage-store.js";
import { fakeKv } from "./helpers/fake-kv.js";


test("tryConsume counts up to the limit and then refuses", async () => {
  const kv = fakeKv();
  const store = new KvUsageStore({ kv });
  assert.equal(store.durable, true);
  const results = [];
  for (let i = 0; i < 5; i += 1) results.push(await store.tryConsume("2026-12-01", 3, DAY_TTL_SECONDS));
  assert.deepEqual(results, [true, true, true, false, false]);
  assert.equal(kv.data.get(`${KV_KEY_PREFIX}2026-12-01`), "3");
});

test("every put carries an expirationTtl and a per-day key", async () => {
  const kv = fakeKv();
  const store = new KvUsageStore({ kv });
  await store.tryConsume("2026-12-01", 3, DAY_TTL_SECONDS);
  await store.tryConsume("2026-12-02", 3, DAY_TTL_SECONDS);
  assert.deepEqual(kv.puts.map((p) => p.key), [`${KV_KEY_PREFIX}2026-12-01`, `${KV_KEY_PREFIX}2026-12-02`]);
  for (const p of kv.puts) assert.deepEqual(p.options, { expirationTtl: DAY_TTL_SECONDS });
});

test("a corrupt stored value fails closed", async () => {
  const kv = fakeKv();
  kv.data.set(`${KV_KEY_PREFIX}2026-12-01`, "not-a-number");
  await assert.rejects(() => new KvUsageStore({ kv }).tryConsume("2026-12-01", 3, DAY_TTL_SECONDS));
});

test("usageStoreFromEnv needs a KV binding named SEANCE_USAGE", () => {
  assert.equal(usageStoreFromEnv({}), null);
  assert.equal(usageStoreFromEnv(undefined), null);
  assert.equal(usageStoreFromEnv({ SEANCE_USAGE: "not a binding" }), null);
  assert.equal(usageStoreFromEnv({ USAGE_KV: fakeKv() }), null);
  assert.ok(usageStoreFromEnv({ SEANCE_USAGE: fakeKv() }) instanceof KvUsageStore);
});
