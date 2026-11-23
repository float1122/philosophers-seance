// tests/prompt.test.js
//
// Test-first RED phase for the system-prompt module (seance-core spec task
// 3.3). Covers Property 12 (the composed system prompt contains the
// philosopher's persona, an imagination-framing clause, a no-real-contact /
// no-prediction clause, and a decline-medical/legal/financial/therapeutic-
// advice clause) and Property 15 (persona non-empty for all six
// philosophers). Also asserts the six prompt ids match the six client ids in
// src/philosophers.js to prevent drift without a build step.
//
// The module under test, api/prompt.js, exports:
//   - PHILOSOPHERS: the six philosophers' prompt data ({ id, name, persona }),
//     with personas authored by the project in each thinker's voice — never
//     quoted from a copyrighted translation;
//   - buildSystemPrompt(philosopher) -> string, composing the persona with the
//     voice traits and the guardrail clauses.
//
// api/prompt.js is implemented in a LATER task (3.4). Until then this file
// fails at import with a module-not-found error — the expected test-first red
// state. Do not stub api/prompt.js to make it pass.
//
// The parity assertion against src/philosophers.js uses a dynamic import in a
// try/catch and skips itself if that module cannot be imported yet (it is
// created in task 8.2). This keeps the test valid now and fully exercised once
// 8.2 lands.

import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";

import { buildSystemPrompt, PHILOSOPHERS } from "../api/prompt.js";

// The six public-domain philosopher identifiers (per design.md). A test
// asserting the two id sets match lives here; the fixed allowlist used by the
// validation module lives in validate.test.js.
const SIX_IDS = [
  "socrates",
  "confucius",
  "laozi",
  "seneca",
  "marcus-aurelius",
  "nietzsche",
];

// Look up a philosopher object by id in PHILOSOPHERS.
const byId = (id) => PHILOSOPHERS.find((p) => p.id === id);

// ---------------------------------------------------------------------------
// Feature: seance-core, Property 15: Persona non-emptiness
//
// For any of the six philosophers, the displayed persona SHALL be a non-empty
// string.
//
// Validates: Requirements 2.2
// ---------------------------------------------------------------------------

test("Feature: seance-core, Property 15 — all six philosophers have a non-empty persona string", () => {
  assert.equal(PHILOSOPHERS.length, 6, "exactly six philosophers");
  for (const id of SIX_IDS) {
    const philosopher = byId(id);
    assert.ok(philosopher, `philosopher ${id} must exist in PHILOSOPHERS`);
    assert.equal(
      typeof philosopher.persona,
      "string",
      `${id} persona is a string`
    );
    assert.ok(philosopher.persona.length > 0, `${id} persona is non-empty`);
  }
});

test("Feature: seance-core, Property 15 — for any of the six ids, the persona is a non-empty string", () => {
  fc.assert(
    fc.property(fc.constantFrom(...SIX_IDS), (id) => {
      const philosopher = byId(id);
      assert.ok(philosopher, `philosopher ${id} must exist`);
      assert.equal(typeof philosopher.persona, "string");
      assert.ok(philosopher.persona.length > 0, "persona must be non-empty");
      return true;
    }),
    { numRuns: 100 }
  );
});

// ---------------------------------------------------------------------------
// Feature: seance-core, Property 12: System prompt contents
//
// For any of the six philosophers, the composed system prompt SHALL contain:
//   (a) that philosopher's persona;
//   (b) an imagination-framing clause (frame replies as imagination and
//       reflection, never as genuine contact with the dead or prediction of
//       the future);
//   (c) a no-real-contact / no-prediction clause (never claim to truly contact
//       the dead or predict the future);
//   (d) a decline-medical/legal/financial/therapeutic-advice clause (decline
//       such requests and redirect to reflection).
//
// Validates: Requirements 5.5, 12.5, 12.6
// ---------------------------------------------------------------------------

test("Feature: seance-core, Property 12 — system prompt contains the persona and all guardrail clauses", () => {
  fc.assert(
    fc.property(fc.constantFrom(...SIX_IDS), (id) => {
      const philosopher = byId(id);
      assert.ok(philosopher, `philosopher ${id} must exist`);
      const prompt = buildSystemPrompt(philosopher);

      assert.equal(
        typeof prompt,
        "string",
        "buildSystemPrompt returns a string"
      );
      assert.ok(prompt.length > 0, "prompt is non-empty");

      // (a) The philosopher's authored persona is present in the prompt.
      assert.ok(
        prompt.includes(philosopher.persona),
        "prompt must contain the philosopher's persona"
      );

      // (b) Imagination-framing clause: frame every reply as imagination.
      assert.ok(
        /imagination/i.test(prompt),
        "prompt must frame replies as imagination"
      );

      // (c) No-real-contact / no-prediction clause: never claim to contact the
      // dead or predict the future.
      assert.ok(
        /contact the dead/i.test(prompt),
        "prompt must not claim to contact the dead"
      );
      assert.ok(
        /predict/i.test(prompt),
        "prompt must not claim to predict the future"
      );

      // (d) Decline medical, legal, financial, and therapeutic advice and
      // redirect to reflection.
      assert.ok(/medical/i.test(prompt), "prompt must address medical advice");
      assert.ok(/legal/i.test(prompt), "prompt must address legal advice");
      assert.ok(
        /financial/i.test(prompt),
        "prompt must address financial advice"
      );
      assert.ok(
        /therapeutic/i.test(prompt),
        "prompt must address therapeutic advice"
      );

      return true;
    }),
    { numRuns: 100 }
  );
});

// ---------------------------------------------------------------------------
// Parity: prompt ids match client ids in src/philosophers.js
//
// design.md specifies a test asserting the two id sets are identical to
// prevent drift without a build step. src/philosophers.js is created in task
// 8.2; until then the dynamic import fails and this subtest skips itself via
// t.skip(). Once 8.2 lands the import succeeds and the id sets are compared.
// ---------------------------------------------------------------------------

test("Parity: the six prompt ids match the six client ids in src/philosophers.js", async (t) => {
  let clientModule;
  try {
    clientModule = await import("../src/philosophers.js");
  } catch {
    t.skip(
      "src/philosophers.js not yet implemented (task 8.2); skipping parity check"
    );
    return;
  }

  const clientPhilosophers = clientModule.PHILOSOPHERS;
  assert.ok(
    Array.isArray(clientPhilosophers),
    "src/philosophers.js exports a PHILOSOPHERS array"
  );

  const promptIds = PHILOSOPHERS.map((p) => p.id).sort();
  const clientIds = clientPhilosophers.map((p) => p.id).sort();

  assert.deepEqual(
    promptIds,
    clientIds,
    "prompt ids and client ids must match exactly"
  );
});
