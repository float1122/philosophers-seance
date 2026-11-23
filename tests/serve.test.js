// Feature: seance-core — local dev server (Requirement 8).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { startServer } from "../serve.mjs";

test("serve.mjs imports only node built-ins and local modules", () => {
  const src = readFileSync(new URL("../serve.mjs", import.meta.url), "utf8");
  const specs = [...src.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
  for (const s of specs) assert.ok(s.startsWith("node:") || s.startsWith("./"), s);
});

test("serves index.html and routes POST /api/seance to the handler", async (t) => {
  const server = await startServer({ port: 0, env: { DAILY_CALL_LIMIT: "" } });
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;

  const page = await fetch(`${base}/`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Philosophers/);

  const api = await fetch(`${base}/api/seance`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ philosopherId: "socrates", worry: "Am I wise?" }),
  });
  assert.equal(api.status, 429);
  assert.deepEqual(await api.json(), { error: "SPIRITS_RESTING" });

  const escape = await fetch(`${base}/..%2fpackage.json`);
  assert.equal(escape.status, 404);
  const hidden = await fetch(`${base}/.kiro/steering/tech.md`);
  assert.equal(hidden.status, 404);
});
