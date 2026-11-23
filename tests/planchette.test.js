// Feature: seance-core, Property 14 (planchette path).
import { test } from "node:test";
import assert from "node:assert/strict";
import { planchettePath, glideSchedule, MAX_GLIDE_MS } from "../src/planchette.js";
import { PHILOSOPHERS } from "../src/philosophers.js";

test("Property 14: path is the name's letters in order, ending on the final letter", () => {
  for (const p of PHILOSOPHERS) {
    const path = planchettePath(p.name);
    const letters = p.name.toUpperCase().replace(/[^A-Z]/g, "").split("");
    assert.deepEqual(path, letters);
    assert.equal(path.at(-1), letters.at(-1));
  }
});

test("glide schedule finishes within twenty seconds for every name", () => {
  assert.ok(MAX_GLIDE_MS <= 20000);
  for (const p of PHILOSOPHERS) {
    const steps = glideSchedule(planchettePath(p.name));
    assert.equal(steps.length, planchettePath(p.name).length);
    assert.ok(steps.at(-1).at <= MAX_GLIDE_MS);
    for (let i = 1; i < steps.length; i += 1) assert.ok(steps[i].at > steps[i - 1].at);
  }
});

test("reduced motion schedule rests on the final letter immediately", () => {
  const steps = glideSchedule(["L", "A", "O", "Z", "I"], { reducedMotion: true });
  assert.deepEqual(steps, [{ letter: "I", at: 0 }]);
});
