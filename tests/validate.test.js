// tests/validate.test.js
//
// Test-first RED phase for the trust-boundary validation module (seance-core
// spec task 3.1). Covers Property 5 (worry validation), Property 6 (worry
// sanitization), Property 7 (philosopher allowlist), and Property 8 (malformed
// request rejection) from the design document.
//
// The module under test, api/validate.js, exports:
//   - sanitizeWorry(s): remove ASCII control chars U+0000-U+001F and U+007F
//     (applied before trimming);
//   - parseAndValidate(request): -> { ok: true, philosopher, worry }
//     | { ok: false, status: 400, code: "INVALID_REQUEST" }.
//
// api/validate.js is implemented in a LATER task (3.2). Until then this file
// fails at import with a module-not-found error — the expected test-first red
// state. Do not stub api/validate.js to make it pass.

import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";

import { sanitizeWorry, parseAndValidate } from "../api/validate.js";

// The six public-domain philosopher identifiers (per design.md). A test
// asserting the two id sets match lives in prompt.test.js; here they are the
// fixed allowlist the validation module must accept.
const SIX_IDS = [
  "socrates",
  "confucius",
  "laozi",
  "seneca",
  "marcus-aurelius",
  "nietzsche",
];

// A worry that is always valid: non-empty after trim, no control chars, and
// far under the 500-code-point bound. Used to isolate the philosopher check
// (Property 7) and the malformed-request generators (Property 8).
const VALID_WORRY = "The candle flickers and I am afraid it will go out.";
const VALID_ID = "socrates";

// Count Unicode code points, where a supplementary character encoded as a
// surrogate pair counts as one (Requirement 3.1 / 7.3).
const codePointCount = (s) => [...s].length;

// Build a Web Request (global in Node 22) with the given body and Content-Type.
function makeRequest(body, contentType = "application/json") {
  return new Request("https://example.com/api/seance", {
    method: "POST",
    headers: { "content-type": contentType },
    body,
  });
}

// ---------------------------------------------------------------------------
// Feature: seance-core, Property 5: Worry validation rejects invalid input
//
// For any string s, after sanitization and trimming, if the trimmed length is
// zero or exceeds five hundred code points, parseAndValidate SHALL reject
// with 400 / INVALID_REQUEST; otherwise it SHALL accept and return the
// sanitized+trimmed worry.
//
// Validates: Requirements 7.3
// ---------------------------------------------------------------------------

test("Feature: seance-core, Property 5: worry rejected when trimmed length is 0 or exceeds 500 code points", async () => {
  await fc.assert(
    fc.asyncProperty(fc.string({ maxLength: 600 }), async (s) => {
      const req = makeRequest(
        JSON.stringify({ philosopherId: VALID_ID, worry: s })
      );
      const res = await parseAndValidate(req);

      // Oracle: sanitization then trimming, counted in code points.
      const trimmed = sanitizeWorry(s).trim();
      const cps = codePointCount(trimmed);
      const expectedInvalid = cps === 0 || cps > 500;

      if (expectedInvalid) {
        assert.equal(res.ok, false, "invalid worry should be rejected");
        assert.equal(res.status, 400);
        assert.equal(res.code, "INVALID_REQUEST");
      } else {
        assert.equal(res.ok, true, "valid worry should be accepted");
        assert.equal(res.philosopher, VALID_ID);
        // The accepted worry is the sanitized, trimmed value sent to the model.
        assert.equal(res.worry, trimmed);
      }
    }),
    { numRuns: 100 }
  );
});

// ---------------------------------------------------------------------------
// Feature: seance-core, Property 6: Worry sanitization is correct and idempotent
//
// For any string s, sanitizeWorry(s) SHALL contain no code points in
// U+0000-U+001F or U+007F, sanitizeWorry(sanitizeWorry(s)) SHALL equal
// sanitizeWorry(s), and the length of sanitizeWorry(s) SHALL not exceed the
// length of s.
//
// Validates: Requirements 7.4
// ---------------------------------------------------------------------------

test("Feature: seance-core, Property 6: sanitizeWorry strips control chars, is idempotent, and never lengthens", async () => {
  await fc.assert(
    fc.asyncProperty(fc.string(), async (s) => {
      const out = sanitizeWorry(s);

      // No ASCII control characters remain (U+0000-U+001F or U+007F).
      for (const ch of out) {
        const cp = ch.codePointAt(0);
        assert.ok(
          !(cp >= 0x0000 && cp <= 0x001f) && cp !== 0x007f,
          `control char U+${cp.toString(16).toUpperCase()} remained in sanitized output`
        );
      }

      // Idempotent: sanitizing twice equals sanitizing once.
      assert.equal(sanitizeWorry(out), out, "sanitizeWorry is idempotent");

      // Never longer than the input (measured in code points).
      assert.ok(
        codePointCount(out) <= codePointCount(s),
        "sanitizeWorry never lengthens its input"
      );
    }),
    { numRuns: 100 }
  );
});

// ---------------------------------------------------------------------------
// Feature: seance-core, Property 7: Philosopher allowlist membership
//
// For any philosopherId value p, parseAndValidate SHALL accept the request
// (subject to the worry being valid) if and only if p is one of the six
// defined identifiers; otherwise it SHALL reject with 400 / INVALID_REQUEST.
//
// Validates: Requirements 7.2, 12.4
// ---------------------------------------------------------------------------

test("Feature: seance-core, Property 7: philosopher allowlist accepted iff one of the six ids", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.oneof(fc.constantFrom(...SIX_IDS), fc.string()),
      async (philosopherId) => {
        const req = makeRequest(
          JSON.stringify({ philosopherId, worry: VALID_WORRY })
        );
        const res = await parseAndValidate(req);

        const inSix = SIX_IDS.includes(philosopherId);

        if (inSix) {
          assert.equal(res.ok, true, "known philosopher should be accepted");
          assert.equal(res.philosopher, philosopherId);
          assert.equal(res.worry, VALID_WORRY);
        } else {
          assert.equal(res.ok, false, "unknown philosopher should be rejected");
          assert.equal(res.status, 400);
          assert.equal(res.code, "INVALID_REQUEST");
        }
      }
    ),
    { numRuns: 100 }
  );
});

// ---------------------------------------------------------------------------
// Feature: seance-core, Property 8: Malformed request rejection
//
// For any request whose Content-Type is not application/json, whose body is
// not valid JSON, which lacks philosopherId or worry, or whose philosopherId
// or worry is not a string, parseAndValidate SHALL reject with 400 /
// INVALID_REQUEST. (The guarantee that zero Anthropic calls follow is enforced
// at the handler level and is covered by seance.test.js.)
//
// Validates: Requirements 7.1
// ---------------------------------------------------------------------------

test("Feature: seance-core, Property 8: malformed requests rejected with 400 INVALID_REQUEST", async () => {
  const malformedGen = fc.oneof(
    // Bad Content-Type (body happens to be valid JSON).
    fc.record({
      ct: fc.constant("text/plain"),
      body: fc.constant(JSON.stringify({ philosopherId: VALID_ID, worry: VALID_WORRY })),
    }),
    // Body is not valid JSON.
    fc.record({
      ct: fc.constant("application/json"),
      body: fc.constant("{not valid json"),
    }),
    // Missing philosopherId.
    fc.record({
      ct: fc.constant("application/json"),
      body: fc.constant(JSON.stringify({ worry: VALID_WORRY })),
    }),
    // Missing worry.
    fc.record({
      ct: fc.constant("application/json"),
      body: fc.constant(JSON.stringify({ philosopherId: VALID_ID })),
    }),
    // philosopherId is not a string.
    fc.record({
      ct: fc.constant("application/json"),
      body: fc.constant(JSON.stringify({ philosopherId: 7, worry: VALID_WORRY })),
    }),
    // worry is not a string.
    fc.record({
      ct: fc.constant("application/json"),
      body: fc.constant(JSON.stringify({ philosopherId: VALID_ID, worry: 7 })),
    })
  );

  await fc.assert(
    fc.asyncProperty(malformedGen, async ({ ct, body }) => {
      const req = makeRequest(body, ct);
      const res = await parseAndValidate(req);

      assert.equal(res.ok, false, "malformed request should be rejected");
      assert.equal(res.status, 400);
      assert.equal(res.code, "INVALID_REQUEST");
    }),
    { numRuns: 100 }
  );
});
