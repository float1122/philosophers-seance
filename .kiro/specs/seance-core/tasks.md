# Implementation Plan: Philosophers' Séance (seance-core)

## Overview

Build the core séance experience as a build-free static front end (HTML/CSS/vanilla JavaScript) plus exactly one Node 22 serverless function that calls the Anthropic Messages API (`claude-haiku-5-5`). The back end validates input at the trust boundary, enforces a per-UTC-day call cap with fail-closed defaults, and degrades gracefully to in-character messages. The front end renders a candlelit Ouija board, philosopher picker, worry input with a code-point counter, and a spirit-writing reveal, with keyboard and reduced-motion accessibility. A dependency-free local dev server ties the two tiers together for development only; production deployment is out of scope.

Every module is developed test-first with the built-in `node:test` runner — the test file is written before the implementation it covers. Pure logic (limit parsing, usage counting, worry validation/sanitization, code-point counting, planchette path, error mapping) is property-tested with `fast-check` (dev-only, min 100 iterations per property); DOM behavior is example-tested via `linkedom`. Follow the module breakdown and interfaces in `design.md` exactly.

## Tasks

- [x] 1. Project setup and dependencies
  - Initialize `package.json` with `"type": "module"` and `"scripts": { "test": "node --test" }`
  - Add dev-only dependencies `fast-check` (property-based testing) and `linkedom` (DOM shim); neither is a runtime dependency of the serverless function or the static front end, preserving the no-build/no-runtime-deps constraints
  - Create `.gitignore` excluding `.env*` and any secrets so `ANTHROPIC_API_KEY` and `DAILY_CALL_LIMIT` never commit
  - Confirm a `.kiro/hooks/` hook runs `npm test` on every save of a `.js` file under `src/`, `api/`, or `tests/`
  - _Refs: Requirement 8 (dev server), tech.md (stack, environment & security)_

- [ ] 2. Back-end: daily call limit parsing and usage store (test-first)
  - [x] 2.1 Write `tests/limit.test.js` (test-first, before `api/limit.js`) covering **Property 1** (fail-closed on invalid limits): for `DAILY_CALL_LIMIT` values `undefined`, `""`, `"0"`, `"-1"`, `"abc"`, `"1.5"`, `parseDailyCallLimit` returns `null`; for positive integers it returns the integer. Use `fast-check`, min 100 iterations, tagged `Feature: seance-core, Property 1`.
    - _Refs: Requirement 6.2_
  - [~] 2.2 Implement `api/limit.js` exporting `parseDailyCallLimit(value) → positiveInt | null` (returns `null` for unset, empty, non-integer, or values less than one) so all tests pass
    - _Refs: Requirement 6.2_
  - [x] 2.3 Write `tests/usage-store.test.js` (test-first, before `api/usage-store.js`) covering **Property 3** (UTC-day boundary: a new day starts at zero, the previous day's terminal count is unchanged) and **Property 4** (count invariant: every returned count is a non-negative integer, unseen days start at 0, `getAndIncrement(day)` returns previous+1). Use `fast-check`, min 100 iterations.
    - _Refs: Requirements 6.1, 6.5, 11.1_
  - [~] 2.4 Implement `api/usage-store.js` defining the `Usage_Store` interface (`getCurrentCount(utcDay)`, `getAndIncrement(utcDay)`) and `InMemoryUsageStore` backed by a `Map<string, number>` keyed by UTC date `YYYY-MM-DD`, defaulting unseen days to zero
    - _Refs: Requirements 6.1, 6.5, 11.1, 11.2_

- [ ] 3. Back-end: trust-boundary validation, system prompt, and response shaping (test-first)
  - [x] 3.1 Write `tests/validate.test.js` (test-first, before `api/validate.js`) covering **Property 5** (worry rejected when trimmed length is 0 or exceeds 500 code points), **Property 6** (sanitization removes U+0000–U+001F and U+007F, is idempotent, never longer than input), **Property 7** (philosopher allowlist: accepted iff one of the six ids), and **Property 8** (malformed requests rejected: bad Content-Type, invalid JSON, missing `philosopherId`/`worry`, non-string fields). Use `fast-check`, min 100 iterations.
    - _Refs: Requirements 7.1, 7.2, 7.3, 7.4, 12.4_
  - [~] 3.2 Implement `api/validate.js` exporting `sanitizeWorry(s)` (strip ASCII control chars U+0000–U+001F and U+007F before trimming) and `parseAndValidate(request)` returning `{ ok, philosopher, worry }` or `{ status: 400, code: "INVALID_REQUEST" }`; sanitize before trim, before the empty and length checks, before any model call
    - _Refs: Requirements 7.1–7.4_
  - [-] 3.3 Write `tests/prompt.test.js` (test-first, before `api/prompt.js`) covering **Property 12** (system prompt contains the philosopher's persona, an imagination-framing clause, a no-real-contact/no-prediction clause, and a decline-medical/legal/financial/therapeutic-advice clause) and **Property 15** (persona non-empty for all six); also assert the six prompt ids match the six client ids in `src/philosophers.js` to prevent drift without a build step (this parity assertion is fully validated once `src/philosophers.js` exists in task 8.2)
    - _Refs: Requirements 5.5, 12.5, 12.6, 2.2_
  - [~] 3.4 Implement `api/prompt.js` with the six philosophers' authored personas (original, composed in each thinker's voice — never quoted from a copyrighted translation), the per-philosopher voice traits from `tone.md`, and `buildSystemPrompt(philosopher) → string` composing persona + voice + guardrail clauses
    - _Refs: Requirements 5.5, 12.5, 12.6; tone.md_
  - [ ] 3.5 Write `tests/response.test.js` (test-first, before `api/response.js`) covering the error bodies (`INVALID_REQUEST`, `SPIRITS_RESTING`, `SPIRITS_UNREACHABLE`), the in-character fallback strings, and `redact` stripping `ANTHROPIC_API_KEY` and the full worry from sample log output
    - _Refs: Requirements 4.3, 6.6, 7.5, 10.1_
  - [~] 3.6 Implement `api/response.js` with JSON response helpers, error bodies, in-character fallback messages (numeral-free, eerie-but-kind), and a `redact` helper ensuring the key and full worry never appear in logs
    - _Refs: Requirements 4.3, 6.6, 7.5, 10.1; tone.md_

- [ ] 4. Back-end: Anthropic Messages API client (test-first)
  - [-] 4.1 Write `tests/anthropic.test.js` (test-first, before `api/anthropic.js`) covering **Property 11** (outbound payload sets `model` to `claude-haiku-5-5` and `max_tokens` to 1024, targets only the Anthropic Messages API endpoint) and **Property 13** (upstream failure — non-2xx, fetch rejection, or empty answer — returns a non-empty in-character answer with no upstream status/body/stack leaked). Use an injected mock `fetch`. Use `fast-check`, min 100 iterations.
    - _Refs: Requirements 5.2, 5.3, 5.6, 10.1_
  - [~] 4.2 Implement `api/anthropic.js` exporting `callAnthropic({ env, fetch, philosopher, worry }) → { answer }`: build the payload, post to the pinned Anthropic endpoint with the key from `env`, extract the first `text` block, and on any upstream failure return an in-character fallback with no upstream detail
    - _Refs: Requirements 5.2, 5.3, 5.6, 10.1_

- [ ] 5. Back-end: handler orchestration — the single serverless function (test-first)
  - [~] 5.1 Write `tests/seance.test.js` (test-first, before `api/seance.js`) covering **Property 1** (fail-closed: invalid/exhausted limit → 429 `SPIRITS_RESTING`, zero Anthropic calls, count unchanged), **Property 2** (under-limit: count incremented by exactly one and retained even when the mocked Anthropic call fails, returning 200 with an in-character answer), **Property 9** (missing/empty `ANTHROPIC_API_KEY` → 503, zero calls, count unchanged), and **Property 10** (valid round-trip → 200 with non-empty `answer` using a mocked fetch); inject a fake `Usage_Store` to verify the DI seam swaps stores with no handler edit; include one end-to-end integration round-trip. Use `fast-check`, min 100 iterations.
    - _Refs: Requirements 5.1, 5.4, 6.2, 6.3, 6.4, 10.1, 11.2, 11.3_
  - [~] 5.2 Implement `api/seance.js` exporting `createHandler({ env, store, fetch }) → async (Request) => Response` orchestrating validate → limit check → key check → increment → Anthropic call → response, applying the 400→429→503→increment→call precedence; depend only on the `Usage_Store` interface, not any specific implementation
    - _Refs: Requirements 5, 6, 7, 10, 11_

- [~] 6. Checkpoint — back-end test suite passes
  - Run `npm test` and ensure all back-end tests pass, ask the user if questions arise.

- [ ] 7. Front-end: worry input, planchette, and API client pure helpers (test-first)
  - [~] 7.1 Write `tests/worry.test.js` (test-first, before `src/worry.js`) covering **Property 17** (value at most 500 code points, supplementary characters via surrogate pairs count as one), **Property 18** (truncation to the first 500 code points), **Property 19** (remaining count equals `max(0, 500 − codePointCount)`), and **Property 20** (trimmed-empty disables summon). Use `fast-check`, min 100 iterations.
    - _Refs: Requirements 3.1, 3.2, 3.3, 3.4_
  - [~] 7.2 Implement `src/worry.js` with pure helpers `countCodePoints`, `truncateToCodePoints`, `remainingCount`, `isTrimmedEmpty` (no top-level DOM access) plus thin DOM wiring for the input, the 500-code-point bound, blocking overflow keystrokes/paste, and the live remaining counter
    - _Refs: Requirements 3.1–3.4_
  - [~] 7.3 Write `tests/planchette.test.js` (test-first, before `src/planchette.js`) covering **Property 14** (`planchettePath(name)` equals the name's letters in order and rests on the final letter) for all six philosopher names; add an example test for the 20-second glide using a fake clock
    - _Refs: Requirements 1.2_
  - [~] 7.4 Implement `src/planchette.js` with pure `planchettePath(name) → letters[]`, the glide (visit each letter in order and come to rest on the final letter within 20 seconds), and the reduced-motion instant transition to the final letter
    - _Refs: Requirements 1.2, 1.4_
  - [~] 7.5 Write `tests/api-client.test.js` (test-first, before `src/api-client.js`) covering **Property 21** (`mapErrorToMessage` returns an in-character message containing no HTTP status, stack trace, or model error text, and a 429 `SPIRITS_RESTING` maps to the spirits-resting message); add example tests for the 30-second `AbortController` timeout and abort-on-new-summon using fake timers
    - _Refs: Requirements 4.3, 4.5, 6.6, 10.2_
  - [~] 7.6 Implement `src/api-client.js` exporting `summon({ philosopherId, worry })` (POST `/api/seance` with a 30-second `AbortController`), `cancelInFlight()` (aborts the current controller on a new summon), and `mapErrorToMessage(resp|timeout|abort)` (in-character only, never raw technical detail)
    - _Refs: Requirements 4.3, 4.5, 6.6, 10.2_

- [ ] 8. Front-end: philosopher picker, Ouija board, and spirit-writing reveal (test-first)
  - [~] 8.1 Write `tests/philosophers.test.js` (test-first, via `linkedom`) covering exactly six philosophers offered (2.1), selection visually distinguished + previous deselected + worry input enabled (2.3), invalid selected id disables the summon action (2.4, **Property 16**), and worry input + summon disabled while no philosopher is selected (2.5)
    - _Refs: Requirements 2.1, 2.3, 2.4, 2.5, 12.3_
  - [~] 8.2 Implement `src/philosophers.js` with the six philosophers' client data (`id`, `name`, display `persona` — authored, non-empty, no copyrighted translations) and the picker UI logic (distinguish selected, deselect previous, enable worry, disable summon for an invalid id)
    - _Refs: Requirements 2.1–2.5, 12.3; tone.md_
  - [~] 8.3 Write `tests/board.test.js` (test-first, via `linkedom`) covering the 26 letters A–Z rendered on the board (1.1), the board and planchette each having a non-empty accessible name and role (9.4), and candle elements marked decorative (`aria-hidden="true"`) (9.4)
    - _Refs: Requirements 1.1, 9.4_
  - [~] 8.4 Implement `src/board.js` rendering the Ouija board (A–Z), the planchette element, and candle elements; set an ARIA role + accessible name on the board and planchette; mark candles decorative
    - _Refs: Requirements 1.1, 9.4_
  - [~] 8.5 Write `tests/reveal.test.js` (test-first, via `linkedom`) covering the progressive spirit-writing reveal in sequence within 5 seconds (4.1), the waiting indicator while fetching (4.2), the live region keeping the full answer text present and assistive-technology-readable throughout the reveal (4.4, 9.5), and the reduced-motion instant reveal within 16 milliseconds (9.2)
    - _Refs: Requirements 4.1, 4.2, 4.4, 9.2, 9.5_
  - [~] 8.6 Implement `src/reveal.js` with the progressive reveal, the waiting indicator, and the live region (full text kept present throughout the reveal); the reduced-motion path reveals instantly within 16 milliseconds
    - _Refs: Requirements 4.1, 4.2, 4.4, 9.2, 9.5_

- [ ] 9. Front-end: candle flicker, reduced-motion detection, and static files
  - [~] 9.1 Implement `src/candle.js` driving CSS-based candle flicker (brightness varying visibly over time) and disabling the flicker under reduced motion
    - _Refs: Requirements 1.3, 1.4_
  - [~] 9.2 Implement `src/reduced-motion.js` detecting `prefers-reduced-motion: reduce` via `matchMedia` and broadcasting `change` events to `planchette`, `candle`, and `reveal`
    - _Refs: Requirements 1.4, 9.2_
  - [~] 9.3 Create `index.html` with the board layout, philosopher picker, worry input + remaining counter, summon action, waiting indicator, answer region, live region, and a continuously visible disclaimer (a product of imagination; does not genuinely contact the dead or predict the future; not professional medical, legal, financial, or therapeutic counsel); arrange interactive elements in visual reading order for keyboard Tab/Shift+Tab with Enter/Space activation
    - _Refs: Requirements 1, 2, 3, 4, 9.1, 12.1, 12.2_
  - [~] 9.4 Create `style.css` with the candlelit séance aesthetic, candle flicker keyframes, focus indicators meeting at least 3:1 contrast, and a `prefers-reduced-motion: reduce` media query that disables flicker and makes all transitions instant (within 16 milliseconds)
    - _Refs: Requirements 1.3, 1.4, 9.2, 9.3_

- [ ] 10. Front-end: entry orchestrator and disclaimer (test-first)
  - [~] 10.1 Write `tests/ui-disclaimer.test.js` (test-first, via `linkedom`) covering the disclaimer present and continuously visible from page load through philosopher selection, worry entry, the waiting state, and answer reveal
    - _Refs: Requirements 12.1, 12.2_
  - [~] 10.2 Implement `src/main.js` as the entry orchestrator: wire the DOM, hold app state (selected philosopher, worry, in-flight controller), delegate to `board`, `philosophers`, `worry`, `planchette`, `reveal`, `api-client`, `candle`, and `reduced-motion`, and manage keyboard focus order in the visual reading order of the board
    - _Refs: Requirements 1, 2, 3, 4, 9.1, 12_

- [ ] 11. Local dev server (test-first)
  - [~] 11.1 Write `tests/serve.test.js` (test-first, before `serve.mjs`) covering: the server starts on a random `PORT`, serves `index.html` as static, a `POST /api/seance` reaches the handler rather than being treated as a static file, it imports only `node:*` built-ins plus local `api/seance.js` (no runtime deps), and it reads `ANTHROPIC_API_KEY` and `DAILY_CALL_LIMIT` from `process.env`
    - _Refs: Requirements 8.1, 8.2, 8.3, 8.4_
  - [~] 11.2 Implement `serve.mjs` (development convenience only, not a production target) using `node:http`, `node:fs`, `node:path`, `node:url`: serve static files from the project root, route `POST /api/seance` to `createHandler({ env: process.env, store: new InMemoryUsageStore(), fetch: globalThis.fetch })` bridging `IncomingMessage`/`ServerResponse` to Web `Request`/`Response`, and listen on `process.env.PORT || 3000`
    - _Refs: Requirements 8.1, 8.2, 8.3, 8.4, 8.5_

- [~] 12. Checkpoint — full test suite passes
  - Run `npm test` and ensure every `*.test.js` passes, ask the user if questions arise.

- [~] 13. Final verification
  - Run the full `node --test` suite and confirm all modules pass end-to-end; do NOT deploy (production deployment is out of scope)
  - _Refs: all requirements_

## Notes

- Every module is developed test-first: the `tests/*.test.js` file is written before the implementation it covers, per `tech.md`.
- Property-based tests use `fast-check` (dev-only), a minimum of 100 iterations each, tagged `Feature: seance-core, Property N`.
- Front-end DOM tests use `linkedom` (dev-only) so the browser is not required; purely visual behaviors (candle flicker "varies visibly", focus-indicator 3:1 contrast) are noted for manual/visual review.
- `fast-check` and `linkedom` are dev-only and are never runtime dependencies of the serverless function or the static front end.
- All UI and in-character copy is eerie but kind, atmospheric and sparse, and numeral-free in promotional copy; philosopher personas are authored in each thinker's voice, never quoted from copyrighted translations.
- The Kiro hook runs `npm test` on every save under `src/`, `api/`, or `tests/`, enforcing test-first continuously.
- The single serverless function is `api/seance.js`; sibling modules under `api/` are its private, unit-testable implementation (one entrypoint/deployment unit).
- Deployment is out of scope; only the dependency-free `serve.mjs` local dev server is provided.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "2.3", "3.1", "3.3", "3.5", "4.1"] },
    { "id": 2, "tasks": ["2.2", "2.4", "3.2", "3.4", "3.6", "4.2"] },
    { "id": 3, "tasks": ["5.1"] },
    { "id": 4, "tasks": ["5.2"] },
    { "id": 5, "tasks": ["6"] },
    { "id": 6, "tasks": ["7.1", "7.3", "7.5", "8.1", "9.1", "9.2", "9.3", "9.4"] },
    { "id": 7, "tasks": ["7.2", "7.4", "7.6", "8.2"] },
    { "id": 8, "tasks": ["8.3", "8.5", "10.1"] },
    { "id": 9, "tasks": ["8.4", "8.6"] },
    { "id": 10, "tasks": ["10.2"] },
    { "id": 11, "tasks": ["11.1"] },
    { "id": 12, "tasks": ["11.2"] },
    { "id": 13, "tasks": ["12"] },
    { "id": 14, "tasks": ["13"] }
  ]
}
```
