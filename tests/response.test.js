// tests/response.test.js
//
// Test-first RED phase for the response-shaping module (seance-core spec
// task 3.5). Covers the three error bodies (INVALID_REQUEST, SPIRITS_RESTING,
// SPIRITS_UNREACHABLE), the in-character fallback strings (numeral-free per
// tone.md), and the redact helper that strips ANTHROPIC_API_KEY and the full
// worry text from log output.
//
// The module under test, api/response.js, exports:
//   - errorResponse(code): -> Web Response whose status is mapped from the code
//     (INVALID_REQUEST -> 400, SPIRITS_RESTING -> 429, SPIRITS_UNREACHABLE ->
//     503) with a JSON body { error: code } and content-type application/json;
//   - fallbackAnswer(reason): -> the in-character, numeral-free, eerie-but-kind
//     message for a reason key ("SPIRITS_RESTING", "SPIRITS_UNREACHABLE",
//     "INVALID_REQUEST", "TIMEOUT");
//   - redact(text, { apiKey, worry }): -> text with every occurrence of the API
//     key and the full worry removed, so neither ever appears in logs.
//
// api/response.js is implemented in a LATER task (3.6). Until then this file
// fails at import with a module-not-found error — the expected test-first red
// state. Do not stub api/response.js to make it pass.
//
// Refs: Requirements 4.3, 6.6, 7.5, 10.1; tone.md (numeral-free, eerie but kind)

import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";

import { errorResponse, fallbackAnswer, redact } from "../api/response.js";

// The in-character fallback strings are fixed by design.md. Asserting them
// exactly pins the copy (eerie but kind) and lets the numeral-free checks
// below confirm tone.md's no-numerals rule for in-character text.
const EXPECTED_FALLBACKS = {
  SPIRITS_RESTING:
    "The spirits are resting now. Return when the candle burns brighter.",
  SPIRITS_UNREACHABLE:
    "The veil is too thick tonight; no spirit answers. Ask again when the flame steadies.",
  INVALID_REQUEST:
    "The board cannot read your question. Shape your worry in plainer words and ask again.",
  TIMEOUT:
    "The spirits linger too long. The flame gutters; ask again another night.",
};

const REASONS = Object.keys(EXPECTED_FALLBACKS);

// A digit character anywhere in in-character copy would violate tone.md's
// numeral-free rule.
const HAS_DIGIT = /[0-9]/;

// A clearly fake placeholder key — never a real credential. Used only to prove
// redact removes it; no real key is ever written into the codebase.
const FAKE_KEY = "sk-test-fake-key-REDACTED";
const FAKE_WORRY = "a worry the visitor whispered to the flame";

// ---------------------------------------------------------------------------
// Error bodies: each code maps to the right HTTP status and JSON shape.
//
// Validates: Requirements 4.3, 6.6, 10.1
// ---------------------------------------------------------------------------

test("Feature: seance-core — errorResponse(INVALID_REQUEST) -> 400 { error: 'INVALID_REQUEST' }", async () => {
  const res = errorResponse("INVALID_REQUEST");
  assert.equal(res.status, 400);
  assert.equal(res.headers.get("content-type"), "application/json");
  assert.deepEqual(await res.json(), { error: "INVALID_REQUEST" });
});

test("Feature: seance-core — errorResponse(SPIRITS_RESTING) -> 429 { error: 'SPIRITS_RESTING' }", async () => {
  const res = errorResponse("SPIRITS_RESTING");
  assert.equal(res.status, 429);
  assert.equal(res.headers.get("content-type"), "application/json");
  assert.deepEqual(await res.json(), { error: "SPIRITS_RESTING" });
});

test("Feature: seance-core — errorResponse(SPIRITS_UNREACHABLE) -> 503 { error: 'SPIRITS_UNREACHABLE' }", async () => {
  const res = errorResponse("SPIRITS_UNREACHABLE");
  assert.equal(res.status, 503);
  assert.equal(res.headers.get("content-type"), "application/json");
  assert.deepEqual(await res.json(), { error: "SPIRITS_UNREACHABLE" });
});

// ---------------------------------------------------------------------------
// In-character fallback strings: eerie but kind, and numeral-free (tone.md).
//
// Validates: Requirements 4.3, 6.6, 10.1; tone.md (numeral-free)
// ---------------------------------------------------------------------------

for (const reason of REASONS) {
  test(`Feature: seance-core — fallbackAnswer("${reason}") matches the design.md text`, () => {
    assert.equal(fallbackAnswer(reason), EXPECTED_FALLBACKS[reason]);
  });

  test(`Feature: seance-core — fallbackAnswer("${reason}") is non-empty and numeral-free`, () => {
    const msg = fallbackAnswer(reason);
    assert.equal(typeof msg, "string");
    assert.ok(msg.length > 0, "fallback must be a non-empty string");
    assert.doesNotMatch(
      msg,
      HAS_DIGIT,
      "in-character fallback must contain no digit characters (tone.md)"
    );
  });
}

test("Feature: seance-core — Property: every fallback answer is non-empty and numeral-free", () => {
  fc.assert(
    fc.property(fc.constantFrom(...REASONS), (reason) => {
      const msg = fallbackAnswer(reason);
      return typeof msg === "string" && msg.length > 0 && !HAS_DIGIT.test(msg);
    }),
    { numRuns: 100 }
  );
});

// ---------------------------------------------------------------------------
// redact: strips ANTHROPIC_API_KEY and the full worry from log output.
//
// Validates: Requirements 7.5 (the key and full worry never appear in logs)
// ---------------------------------------------------------------------------

test("Feature: seance-core — redact removes the API key and the full worry, keeping the rest", () => {
  const log = `Calling Anthropic with key=${FAKE_KEY} worry="${FAKE_WORRY}" at dusk`;
  const out = redact(log, { apiKey: FAKE_KEY, worry: FAKE_WORRY });

  assert.equal(typeof out, "string");
  assert.ok(!out.includes(FAKE_KEY), "API key must not appear in redacted output");
  assert.ok(
    !out.includes(FAKE_WORRY),
    "full worry must not appear in redacted output"
  );
  assert.ok(out.includes("at dusk"), "non-sensitive context must remain");
});

test("Feature: seance-core — redact handles a log containing only the key and worry", () => {
  const out = redact(`${FAKE_KEY}${FAKE_WORRY}`, {
    apiKey: FAKE_KEY,
    worry: FAKE_WORRY,
  });
  assert.ok(!out.includes(FAKE_KEY), "API key must not appear");
  assert.ok(!out.includes(FAKE_WORRY), "full worry must not appear");
});

test("Feature: seance-core — redact is idempotent", () => {
  const log = `key=${FAKE_KEY} worry=${FAKE_WORRY}`;
  const once = redact(log, { apiKey: FAKE_KEY, worry: FAKE_WORRY });
  const twice = redact(once, { apiKey: FAKE_KEY, worry: FAKE_WORRY });
  assert.equal(once, twice, "redacting twice must not change the result");
});

test("Feature: seance-core — Property: redact never leaks the key or the worry over arbitrary log text", () => {
  fc.assert(
    fc.property(fc.string({ maxLength: 300 }), (extra) => {
      const log = `${extra}${FAKE_KEY}${extra}${FAKE_WORRY}${extra}`;
      const out = redact(log, { apiKey: FAKE_KEY, worry: FAKE_WORRY });
      return (
        typeof out === "string" &&
        !out.includes(FAKE_KEY) &&
        !out.includes(FAKE_WORRY)
      );
    }),
    { numRuns: 100 }
  );
});
