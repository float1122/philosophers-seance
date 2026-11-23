// Feature: seance-core, Properties 17-20 (worry input helpers).
import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { countCodePoints, truncateToCodePoints, remainingCount, isTrimmedEmpty, MAX_WORRY } from "../src/worry.js";

test("MAX_WORRY is five hundred", () => assert.equal(MAX_WORRY, 500));

test("Property 17: surrogate pairs count as one code point", () => {
  assert.equal(countCodePoints("🕯️"), 2); // candle + variation selector
  assert.equal(countCodePoints("👻"), 1);
  assert.equal(countCodePoints("abc"), 3);
});

test("Property 18: truncation keeps the first N code points and never splits a pair", () => {
  fc.assert(
    fc.property(fc.string({ unit: "grapheme", maxLength: 700 }), fc.integer({ min: 0, max: 600 }), (s, max) => {
      const out = truncateToCodePoints(s, max);
      assert.ok(countCodePoints(out) <= max);
      assert.ok(s.startsWith(out));
      assert.ok(!/[\uD800-\uDBFF]$/.test(out));
      if (countCodePoints(s) <= max) assert.equal(out, s);
    }),
    { numRuns: 100 }
  );
});

test("Property 19: remaining = max(0, 500 - count)", () => {
  fc.assert(
    fc.property(fc.string({ unit: "grapheme", maxLength: 700 }), (s) => {
      assert.equal(remainingCount(s), Math.max(0, 500 - countCodePoints(s)));
    }),
    { numRuns: 100 }
  );
});

test("Property 20: trimmed-empty detection", () => {
  assert.equal(isTrimmedEmpty("   \n\t"), true);
  assert.equal(isTrimmedEmpty(""), true);
  assert.equal(isTrimmedEmpty(" why "), false);
});
