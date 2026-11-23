# How we used Kiro

Philosophers' Séance was planned spec-first in Kiro. Everything described here is in the public repository: the steering docs, the agent hook and the full spec live under [`/.kiro`](../../.kiro), and the history of the build is in the git log and in the "Execution log" at the end of [`tasks.md`](../../.kiro/specs/seance-core/tasks.md).

We used the **Kiro CLI**, in spec mode. The repository contains no custom agents, MCP configuration or Kiro powers; this build relied on steering, a spec and an agent hook.

## Steering: three short documents that set the rules

Before any spec existed we wrote three steering files, so every later step in Kiro started from the same ground rules.

- **`product.md`**: what the app is (a candlelit Ouija board where you summon a dead public-domain philosopher and pose a worry), who it is for, the Costume Contest category, and what is out of scope: living or copyrighted thinkers, claims of real divination or contact with the dead, and medical, legal, financial or therapeutic advice.
- **`tech.md`**: the stack and the security rules. A static front end with no build step and no framework; exactly one serverless function; tests with the built-in `node:test` runner, written before the code they cover. It also states the rules that matter most for a free public demo that calls a paid model: the API key comes only from the environment and is never logged, the daily call limit fails closed when it is missing or invalid, the worry text is validated at the trust boundary, and the function makes no outbound calls except to the model API.
- **`tone.md`**: the voice of the spirits ("eerie but kind"), a one-line voice for each philosopher (Socrates answers with a probing question, Laozi is flowing and paradoxical, and so on), the content guardrails (public-domain thinkers only, never paste a modern copyrighted translation, always frame answers as imagination rather than counsel), and a hard rule that promotional copy contains no numerals.

The strategy that made the biggest difference was putting the **security and content rules in steering rather than in prompts**. Because "fail closed" and "public-domain only" were in steering from the start, they showed up on their own in the requirements, the design and the task list. We never had to re-explain them task by task.

## Spec-driven development: requirements, design, tasks

The spec is in `.kiro/specs/seance-core/` and was created as a requirements-first feature spec (`.config.kiro`).

**Requirements (`requirements.md`).** Kiro produced a glossary and a set of user stories, each with acceptance criteria written in **EARS** (Easy Approach to Requirements Syntax). They cover the board, philosopher selection, worry capture, the answer reveal, the API endpoint, the daily limit, input validation, the local dev server, accessibility and reduced motion, graceful degradation, the usage store and the content guardrails. Writing the failure cases as EARS made them precise enough to test directly. For example:

> IF the DAILY_CALL_LIMIT environment variable is unset, empty, or not an integer greater than or equal to one, THEN THE Séance_API SHALL reject every call with HTTP 429 and error code SPIRITS_RESTING before any Anthropic Messages API call and without incrementing the count.

The requirements end with a section of correctness properties written for property-based testing: fail-closed on an invalid limit, the limit is never exceeded, sanitization is idempotent, the philosopher allowlist is exact, the count resets at the UTC day boundary, and so on.

**Design (`design.md`).** Kiro turned those requirements into an architecture: a single serverless entry (`api/seance.js`) with small pure sibling modules for limit parsing, usage counting, validation, the system prompt, response shaping and the model client, and a front end split into pure helpers plus thin DOM wiring. Three decisions from the design shaped the whole build:

- a **dependency-injection seam**: `createHandler({ env, store, fetch })`, so tests swap the usage store and mock the model call without touching request handling;
- an explicit **check order**: validate input first, then the limit, then the key, then count the call, then call the model, so a misconfigured limit blocks everything and malformed probes never spend the budget;
- **front-end purity**: code-point counting, truncation, the planchette's letter path and error-to-message mapping are pure functions, so `node:test` can property-test them with no browser.

The design restates the requirements as numbered correctness properties, each tied to the requirement it validates.

**Tasks (`tasks.md`).** The task list is test-first by construction: almost every implementation task is preceded by a task that writes its test file, and each test task names the properties it must cover. It ends with a dependency graph in "waves", so independent test-writing tasks sit together before the implementations they unblock.

**Compared with vibe coding.** The spec moved the hard thinking before any code existed. Questions like "does a failed model call still count against the daily limit?" or "what does the visitor see when the limit is misconfigured?" were settled as acceptance criteria up front. Without a spec we would likely have found them later, as bugs.

## Agent hook: tests on every save

Task one in the plan was to confirm a Kiro hook that keeps the test-first loop running. The hook, `.kiro/hooks/run-tests-on-save.json`, runs `npm test` whenever a `.js` file under `src/`, `api/` or `tests/` is saved or edited by the agent:

```json
"trigger": "PostFileSave",
"matcher": "(^|/)(src|api|tests)/.*\\.js$",
"action": { "type": "command", "command": "npm test" }
```

This is what makes "write the test first" a real loop rather than an intention: a new test file is saved, the suite runs and goes red, the implementation is saved, the suite runs again and goes green. `tech.md` spells out the same loop, so the hook and the steering agree.

## Property-based testing

The correctness properties from the spec are tested with `fast-check` (a dev-only dependency), alongside example tests with `node:test` and DOM tests with `linkedom`. Property tests cover the parts where one hand-picked example would prove little:

- the daily limit parser returns "no limit" for every malformed value, so the function fails closed;
- the usage counter never goes negative, starts each new UTC day from zero, and leaves the previous day's count alone;
- worry sanitization strips control characters, is idempotent, and never makes the text longer;
- worry length is counted in Unicode code points, so an emoji or other supplementary character counts as one character on the client and on the server alike;
- the philosopher allowlist accepts exactly the defined spirits and nothing else;
- when the model call fails, the visitor gets an in-character answer that never leaks an upstream status, body or stack trace.

## Where the Kiro credits ran out

We want to be straightforward about this part. Kiro generated the steering, the hook, the requirements, the design and the task list. It then executed the first task (project setup and dependencies) and wrote the first batch of test files: limit parsing, the usage store, validation, the system prompt and response shaping. At that point **the free-tier monthly Kiro credits ran out**, partway through implementation.

The rest of the plan was completed **outside Kiro, by hand, following `tasks.md` in order** and keeping the same discipline: for each task the test was written first, `npm test` was red before the implementation and green after. The git history shows the split: the Kiro spec commit, then a commit of the failing back-end tests from the Kiro tasks, then the implementation commits.

The task list recorded where the build departed from the plan:

- the candle flicker is pure CSS, so there is no separate candle script;
- the board, picker, disclaimer and reveal DOM tests are consolidated in one test file.

Two security follow-ups were also done by hand after the credits were gone, and both were written back into the spec instead of patched silently. The design gained a "Revision: durable usage store" section, and the execution log records the changes:

- A review found that an in-memory counter would let each serverless instance keep its own count, so the daily limit could be bypassed. The handler now refuses any usage store that is missing or not durable, and fails closed if the store errors.
- A first durable store (Cloudflare KV) used a read-then-write that could let simultaneous requests past the limit. It was replaced with Cloudflare D1 and a single atomic upsert that checks and increments in one statement, tested against a fake D1 backed by real SQLite.

Even without credits, the spec kept paying off. Because the requirements, design and task order were already written, finishing by hand meant working through a plan that already existed, not improvising. When the security review changed the storage design, there was a clear place to record why.

## Summary

| Kiro feature | How it was used | Where to look |
|---|---|---|
| Kiro CLI, spec mode | Generated the requirements, design and task list, then started executing tasks | `.kiro/specs/seance-core/` |
| Steering docs | Product scope, stack and security rules, voice and content guardrails | `.kiro/steering/` |
| Spec-driven development | EARS acceptance criteria, design with correctness properties, test-first tasks with a dependency graph | `requirements.md`, `design.md`, `tasks.md` |
| Agent hook | Runs `npm test` on every save of a source or test file | `.kiro/hooks/run-tests-on-save.json` |
| Property-based testing | Spec correctness properties tested with `fast-check` | `tests/` |
| Not in this repo | Custom agents, MCP configuration, Kiro powers | |
