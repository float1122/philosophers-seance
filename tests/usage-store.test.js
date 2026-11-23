// tests/usage-store.test.js
//
// Test-first RED phase for the per-UTC-day usage store (seance-core spec
// task 2.3). Covers Property 3 (UTC-day boundary) and Property 4 (count
// invariant) from the design document.
//
// The module under test, api/usage-store.js (InMemoryUsageStore implementing
// the Usage_Store interface), is implemented in a LATER task (2.4). Until then
// this file fails at import with a module-not-found error — the expected
// test-first red state. Do not stub api/usage-store.js to make it pass.

import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";

import { InMemoryUsageStore } from "../api/usage-store.js";

// Distinct, consecutive UTC-day keys ("YYYY-MM-DD"). The store is keyed by
// opaque day strings, so these need not be derived from the system clock.
const DAY_ONE = "2026-01-01";
const DAY_TWO = "2026-01-02";
const DAY_THREE = "2026-01-03";
const DAY_ALPHABET = [DAY_ONE, DAY_TWO, DAY_THREE];

// Feature: seance-core, Property 3: UTC-day boundary resets the count
//
// For any sequence of accepted calls spanning a UTC-midnight boundary, calls
// after midnight are counted against the new UTC day starting at zero, and the
// previous UTC day's terminal count is unchanged by the new day's calls.
test("Feature: seance-core, Property 3: UTC-day boundary resets the count", () => {
  fc.assert(
    fc.property(
      // number of accepted calls recorded for day one
      fc.integer({ min: 0, max: 50 }),
      // number of accepted calls recorded for day two
      fc.integer({ min: 0, max: 50 }),
      (dayOneOps, dayTwoOps) => {
        const store = new InMemoryUsageStore();

        // A never-touched day reports zero.
        assert.strictEqual(store.getCurrentCount(DAY_ONE), 0);

        // Record day one's accepted calls.
        for (let i = 0; i < dayOneOps; i += 1) {
          store.getAndIncrement(DAY_ONE);
        }
        const dayOneTerminal = store.getCurrentCount(DAY_ONE);
        assert.strictEqual(dayOneTerminal, dayOneOps);

        // The new UTC day begins at zero, independent of day one's calls.
        assert.strictEqual(store.getCurrentCount(DAY_TWO), 0);

        // Record day two's accepted calls.
        for (let i = 0; i < dayTwoOps; i += 1) {
          store.getAndIncrement(DAY_TWO);
        }

        // Day two is counted against the new day.
        assert.strictEqual(store.getCurrentCount(DAY_TWO), dayTwoOps);

        // Day one's terminal count is unchanged by the new day's calls.
        assert.strictEqual(store.getCurrentCount(DAY_ONE), dayOneTerminal);
      }
    ),
    { numRuns: 100 }
  );
});

// Feature: seance-core, Property 4: Usage store count invariant
//
// For any UTC day and any sequence of getCurrentCount/getAndIncrement
// operations: every returned count is a non-negative integer, a previously
// unseen day starts at zero, and getAndIncrement(day) returns the previous
// count for that day plus one.
test("Feature: seance-core, Property 4: Usage store count invariant", () => {
  // A single operation: pick a day from a bounded alphabet and either read or
  // increment its count.
  const opGen = fc.record({
    day: fc.constantFrom(...DAY_ALPHABET),
    op: fc.constantFrom("get", "inc"),
  });

  fc.assert(
    fc.property(fc.array(opGen, { maxLength: 100 }), (ops) => {
      const store = new InMemoryUsageStore();
      // Reference model kept in lockstep with the store.
      const model = new Map();
      const expectedFor = (day) => model.get(day) ?? 0;

      // A previously unseen day starts at zero (asserted independently of ops).
      assert.strictEqual(store.getCurrentCount("2099-12-31"), 0);

      for (const { day, op } of ops) {
        if (op === "get") {
          const actual = store.getCurrentCount(day);
          // Every returned count is a non-negative integer.
          assert.ok(
            Number.isInteger(actual) && actual >= 0,
            `getCurrentCount returned a non-negative integer, got ${actual}`
          );
          // Matches the reference model (unseen days resolve to zero).
          assert.strictEqual(actual, expectedFor(day));
        } else {
          const prev = expectedFor(day);
          const actual = store.getAndIncrement(day);
          // Every returned count is a non-negative integer.
          assert.ok(
            Number.isInteger(actual) && actual >= 0,
            `getAndIncrement returned a non-negative integer, got ${actual}`
          );
          // getAndIncrement returns the previous count plus one.
          assert.strictEqual(actual, prev + 1);
          model.set(day, prev + 1);
        }
      }
    }),
    { numRuns: 100 }
  );
});
