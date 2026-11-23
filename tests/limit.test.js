// tests/limit.test.js
// Feature: seance-core, Property 1
//
// Property 1: Fail-closed rejection on an invalid limit.
// parseDailyCallLimit(value) -> positiveInt | null
//   - returns null (fail-closed) for any DAILY_CALL_LIMIT value that is unset,
//     empty, non-integer, or less than one;
//   - returns the positive integer for any valid positive integer string.
//
// Validates: Requirements 6.2

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { parseDailyCallLimit } from '../api/limit.js';

// --- Examples: the named invalid values all fail closed to null ---

test('Feature: seance-core, Property 1 — invalid limits return null (fail-closed)', () => {
  // Unset / empty
  assert.equal(parseDailyCallLimit(undefined), null, 'undefined -> null');
  assert.equal(parseDailyCallLimit(''), null, 'empty string -> null');
  // Less than one
  assert.equal(parseDailyCallLimit('0'), null, '"0" -> null');
  assert.equal(parseDailyCallLimit('-1'), null, '"-1" -> null');
  // Non-integer
  assert.equal(parseDailyCallLimit('abc'), null, '"abc" -> null');
  assert.equal(parseDailyCallLimit('1.5'), null, '"1.5" -> null');
});

// --- Examples: named valid positive integers round-trip to the integer ---

test('Feature: seance-core, Property 1 — valid positive integer limits return the integer', () => {
  assert.equal(parseDailyCallLimit('1'), 1, '"1" -> 1');
  assert.equal(parseDailyCallLimit('42'), 42, '"42" -> 42');
  assert.equal(parseDailyCallLimit('1000'), 1000, '"1000" -> 1000');
});

// --- Property-based: any invalid DAILY_CALL_LIMIT fails closed to null ---

test('Feature: seance-core, Property 1 — for any invalid DAILY_CALL_LIMIT, parseDailyCallLimit returns null', () => {
  fc.assert(
    fc.property(
      fc.constantFrom(undefined, '', '0', '-1', 'abc', '1.5'),
      (value) => {
        assert.equal(parseDailyCallLimit(value), null);
        return true;
      }
    ),
    { numRuns: 100 }
  );
});

// --- Property-based: any positive integer (as a string) round-trips to the integer ---

test('Feature: seance-core, Property 1 — for any positive integer string, parseDailyCallLimit returns the integer', () => {
  fc.assert(
    fc.property(fc.integer({ min: 1 }), (n) => {
      assert.equal(parseDailyCallLimit(String(n)), n);
      return true;
    }),
    { numRuns: 100 }
  );
});
