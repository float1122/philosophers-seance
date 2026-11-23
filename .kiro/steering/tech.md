# Tech

## Stack
- Front end: static HTML, CSS, vanilla JavaScript. No build step, no bundler, no framework. Served as plain files.
- Back end: exactly one serverless function. Node 22, plain ESM (`"type": "module"`), no web framework.
- The function calls the Anthropic Messages API with model `claude-haiku-5-5`.
- All UI and response text in English.

## Structure
```
/               index.html, style.css
src/            front-end JS (séance UI, board interactions)
api/            the single serverless function (e.g. api/seance.js)
tests/          node:test files, one per module, named *.test.js
package.json    "type": "module"; "scripts": { "test": "node --test" }
```

## Commands
- `npm test` → `node --test` (runs every `*.test.js` under tests/).
- Serve the front end as static files (any static file server).

## Testing
- Tests use the built-in `node:test` runner (`node --test`).
- Write the test before the implementation it covers.
- Cover at least: `DAILY_CALL_LIMIT` parsing and fail-closed behavior, per-UTC-day usage tracking, and validation/sanitization of the worry text at the trust boundary.
- A `.js` file saved or edited under `src/`, `api/`, or `tests/` triggers `npm test` via the Kiro hook in `.kiro/hooks/`.

## Environment & security
- `ANTHROPIC_API_KEY`: read from the environment only. Never hardcode, never commit, never log. Keep `.env*` and any secrets out of git via `.gitignore`.
- `DAILY_CALL_LIMIT`: caps the number of calls per UTC day.
  - If it is empty, unset, or not a positive integer, fail closed: block every call and return the in-character "the spirits are resting" message. No call reaches the Anthropic API in that state.
  - When usage for the current UTC day is at or over the limit, reject the call the same way (fail closed).
- Validate all input at the trust boundary (inside the serverless function). Reject or sanitize the worry text before it is sent to the model; bound its length.
- Least privilege: the function does only what the séance needs. No file-system writes, no outbound calls except the Anthropic Messages API.
- Never log the API key or full user worries.
