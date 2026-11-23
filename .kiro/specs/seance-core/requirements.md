# Requirements Document

## Introduction

Philosophers' Séance is a web app styled as a candlelit Ouija board. A visitor summons the spirit of one of six dead public-domain philosophers, types a personal worry, and the summoned spirit replies in character. The front end is static HTML, CSS, and vanilla JavaScript served as plain files with no build step. The back end is a single Node 22 serverless function that calls the Anthropic Messages API (model `claude-haiku-5-5`) and enforces a per-UTC-day call cap with fail-closed defaults. The aesthetic is eerie but kind — a séance of the imagination, never genuine divination and never professional counsel. This spec defines the core séance experience for the Kiroween 2026 Costume Contest; deployment is out of scope for this phase.

## Glossary

- **Séance_App**: The complete application, comprising the Séance_UI front end and the Séance_API back end.
- **Séance_UI**: The static front end (HTML, CSS, vanilla JavaScript) that renders the Ouija board, philosopher picker, worry input, and answer reveal.
- **Séance_API**: The single Node 22 serverless function that validates input, enforces the daily call limit, and calls the Anthropic Messages API.
- **Usage_Store**: An in-memory per-UTC-day counter behind a minimal interface, used by the Séance_API to track accepted calls.
- **Ouija_Board**: The candlelit board rendered by the Séance_UI, displaying the letters of the alphabet over which the Planchette moves.
- **Planchette**: The pointer on the Ouija_Board that glides across letters to spell the summoned philosopher's name.
- **Spirit**: The summoned philosopher replying in character to the visitor's worry.
- **Philosopher_persona**: An original short description of each philosopher, composed by the project authors rather than quoted from any modern translation.
- **Philosopher**: One of the six public-domain figures the visitor may summon: Socrates, Confucius, Laozi, Seneca, Marcus Aurelius, Nietzsche.
- **DAILY_CALL_LIMIT**: An environment variable that caps the number of accepted séance calls per UTC day.
- **ANTHROPIC_API_KEY**: The secret environment variable holding the key for the Anthropic Messages API.
- **Fail closed**: The behavior of rejecting a call and returning the in-character "the spirits are resting" message rather than proceeding; no call reaches the Anthropic Messages API in a fail-closed state.
- **UTC day**: A 24-hour window from 00:00:00 UTC to 23:59:59 UTC, used as the accounting period for DAILY_CALL_LIMIT.
- **SPIRITS_RESTING**: The error code returned by the Séance_API when a call is rejected by the fail-closed behavior or the daily limit.
- **EARS**: Easy Approach to Requirements Syntax, the patterns used for every acceptance criterion in this document.
- **Reduced motion**: A visitor or operating-system preference to minimize or remove animations.

## Requirements

### Requirement 1: Ouija Board Séance Interface

**User Story:** As a visitor, I want a candlelit Ouija board interface, so that I feel immersed in a séance atmosphere.

#### Acceptance Criteria

1. THE Séance_UI SHALL render a candlelit Ouija_Board displaying the twenty-six letters of the English alphabet, A through Z.
2. WHEN a Philosopher is summoned, THE Planchette SHALL glide across the letters to spell the summoned Philosopher's name in sequence, visiting each letter of the name in order and coming to rest on the final letter, completing the glide within twenty seconds.
3. THE Séance_UI SHALL display flickering candle animations positioned around the Ouija_Board, each candle's brightness varying visibly over time.
4. WHERE the visitor's browser requests reduced motion, THE Séance_UI SHALL disable the candle flicker animation and replace the Planchette glide with an instant transition that brings the Planchette to rest on the final letter of the summoned Philosopher's name.

### Requirement 2: Philosopher Selection

**User Story:** As a visitor, I want to choose one of six public-domain philosophers to summon, so that I can hear a distinct voice address my worry.

#### Acceptance Criteria

1. THE Séance_UI SHALL offer exactly the six Philosophers: Socrates, Confucius, Laozi, Seneca, Marcus Aurelius, and Nietzsche.
2. THE Séance_UI SHALL display a non-empty Philosopher_persona for each of the six Philosophers, with each Philosopher_persona composed by the project authors rather than quoted from any modern translation.
3. WHEN a visitor selects one of the six Philosophers, THE Séance_UI SHALL visually distinguish the selected Philosopher from the unselected Philosophers, deselect any previously selected Philosopher, and enable the worry input.
4. IF a selected Philosopher identifier does not correspond to one of the six Philosophers, THEN THE Séance_UI SHALL disable the summon action.
5. WHILE no Philosopher is selected, THE Séance_UI SHALL disable the worry input and the summon action.

### Requirement 3: Worry Capture and Client Validation

**User Story:** As a visitor, I want to type a personal worry, so that the summoned Spirit can address it.

#### Acceptance Criteria

1. THE Séance_UI SHALL provide a worry text input bounded to a maximum of five hundred characters, where a character is a Unicode code point so that a supplementary character represented by a surrogate pair counts as a single character.
2. WHILE the trimmed worry text is empty, THE Séance_UI SHALL disable the summon action.
3. WHEN a keystroke or pasted text would cause the worry text to exceed five hundred characters, THE Séance_UI SHALL prevent input beyond five hundred characters by blocking further keystrokes and truncating the resulting worry text to five hundred characters.
4. WHILE the visitor edits the worry text, THE Séance_UI SHALL display a remaining character count computed as five hundred minus the current character count of the worry text, updating on each edit.

### Requirement 4: Spirit Answer Reveal

**User Story:** As a visitor, I want the answer to appear like spirit writing, so that the reply matches the séance atmosphere.

#### Acceptance Criteria

1. WHEN a valid answer is received, IF reduced motion is not requested, THEN THE Séance_UI SHALL reveal the answer text in a spirit-writing style by displaying the characters progressively in sequence over a total duration not exceeding five seconds.
2. WHILE the answer is being fetched, THE Séance_UI SHALL display a séance-themed waiting indicator.
3. WHEN the request fails, THE Séance_UI SHALL display an in-character message in place of a raw technical error, without exposing HTTP status codes, stack traces, or model error text to the visitor.
4. WHILE the answer text is being revealed progressively, THE Séance_UI SHALL keep the complete answer text present in the document and readable by assistive technology throughout the reveal.
5. WHEN the visitor begins a new summon while an answer is being fetched, THE Séance_UI SHALL cancel the in-flight request.

### Requirement 5: Séance API Endpoint

**User Story:** As a developer, I want a single serverless function to mediate between the board and the model, so that the API key stays server-side and usage stays bounded.

#### Acceptance Criteria

1. WHEN the Séance_API receives a POST request to `/api/seance` with a JSON body containing a `philosopherId` that is one of the six defined identifiers and a `worry` that is non-empty after trimming and no longer than five hundred characters, THE Séance_API SHALL return HTTP 200 with a JSON object containing a non-empty string `answer` field.
2. THE Séance_API SHALL call the Anthropic Messages API using model `claude-haiku-5-5` with a maximum output token limit of one thousand twenty-four tokens via the standard fetch API.
3. THE Séance_API SHALL read the Anthropic API key exclusively from the ANTHROPIC_API_KEY environment variable.
4. IF the ANTHROPIC_API_KEY environment variable is unset or empty, THEN THE Séance_API SHALL return HTTP 503 without calling the Anthropic Messages API.
5. THE Séance_API SHALL send the model a system prompt, built from the selected Philosopher's Philosopher_persona, that instructs the model to reply in that Philosopher's voice and to frame the reply as entertainment and reflection rather than genuine contact with the dead or professional counsel.
6. THE Séance_API SHALL restrict outbound network calls to the Anthropic Messages API endpoint only.

### Requirement 6: Daily Call Limit and Fail-Closed Behavior

**User Story:** As a developer, I want a per-UTC-day call cap with fail-closed defaults, so that runaway usage cannot occur and misconfiguration blocks rather than leaks.

#### Acceptance Criteria

1. THE Usage_Store SHALL maintain a non-negative integer count, starting at zero, of accepted séance calls for each UTC day, where a call counts as accepted only when it passes the DAILY_CALL_LIMIT check and proceeds to call the Anthropic Messages API, and rejected calls leave the count unchanged.
2. IF the DAILY_CALL_LIMIT environment variable is unset, empty, or not an integer greater than or equal to one, THEN THE Séance_API SHALL reject every call with HTTP 429 and error code SPIRITS_RESTING before any Anthropic Messages API call and without incrementing the count.
3. IF DAILY_CALL_LIMIT is an integer greater than or equal to one and the count of accepted calls for the current UTC day is greater than or equal to DAILY_CALL_LIMIT, THEN THE Séance_API SHALL reject the call with HTTP 429 and error code SPIRITS_RESTING before any Anthropic Messages API call and without incrementing the count.
4. IF DAILY_CALL_LIMIT is an integer greater than or equal to one and the count of accepted calls for the current UTC day is less than DAILY_CALL_LIMIT, THEN THE Séance_API SHALL increment the count by one for the current UTC day and proceed to call the Anthropic Messages API, retaining the increment regardless of whether the Anthropic Messages API call subsequently succeeds or fails.
5. WHEN a call's timestamp falls within a UTC day different from the currently tracked UTC day, THE Usage_Store SHALL begin a new count of zero for that UTC day while leaving the previous UTC day's count unchanged at its terminal value.
6. WHEN the Séance_UI receives an HTTP 429 response with error code SPIRITS_RESTING, THE Séance_UI SHALL display an in-character "the spirits are resting" message in place of an answer.

### Requirement 7: Input Validation at the Trust Boundary

**User Story:** As a developer, I want the Séance_API to validate and sanitize all input at the trust boundary, so that malformed or hostile input never reaches the model.

#### Acceptance Criteria

1. IF the request Content-Type is not `application/json`, OR the request body is not valid JSON, OR the parsed JSON lacks a `philosopherId` field, OR the parsed JSON lacks a `worry` field, OR `philosopherId` is not a string, OR `worry` is not a string, THEN THE Séance_API SHALL reject the request with HTTP 400 before any Anthropic Messages API call.
2. IF `philosopherId` is not one of the six defined identifiers, THEN THE Séance_API SHALL reject the request with HTTP 400 before any Anthropic Messages API call.
3. IF the `worry` text is empty or exceeds five hundred characters in length after sanitization and trimming, THEN THE Séance_API SHALL reject the request with HTTP 400 before any Anthropic Messages API call.
4. THE Séance_API SHALL sanitize the `worry` text by removing all ASCII control characters (code points U+0000 through U+001F and U+007F), and SHALL apply this sanitization before trimming, before the empty and length checks, and before any Anthropic Messages API call.
5. THE Séance_API SHALL omit the ANTHROPIC_API_KEY and the full `worry` text from all log output.

### Requirement 8: Local Development Server

**User Story:** As a developer, I want a dependency-free local server, so that I can run the séance end-to-end without installing extra tooling.

#### Acceptance Criteria

1. THE Séance_App SHALL include a Node script that serves the static front-end files and exposes the `/api/seance` endpoint on a single local port, listening on port 3000 by default unless a PORT environment variable overrides it.
2. WHERE no external runtime dependencies are installed, THE local server script SHALL start and serve the séance using only the Node standard library.
3. WHEN the local server receives a POST request to `/api/seance`, THE local server script SHALL dispatch the request to the Séance_API handler rather than treating it as a static file request.
4. THE local server script SHALL load ANTHROPIC_API_KEY and DAILY_CALL_LIMIT from the runtime environment without requiring any external configuration file or loader.
5. THE Séance_App SHALL designate the local server script as a development convenience rather than a production deployment target, with production deployment out of scope for this script.

### Requirement 9: Accessibility and Reduced Motion

**User Story:** As a visitor who uses the keyboard or prefers reduced motion, I want the séance to remain usable, so that I can participate without a mouse or without animations.

#### Acceptance Criteria

1. THE Séance_UI SHALL permit the visitor to select a Philosopher, enter a worry, and summon the Spirit using only the keyboard, with Tab and Shift+Tab moving focus among the interactive elements in the visual reading order of the board and Enter or Space activating the focused element.
2. WHERE the prefers-reduced-motion media query is set to reduce, THE Séance_UI SHALL display the full spirit-writing answer text within 16 milliseconds without playing the reveal animation, and SHALL complete every other transition within 16 milliseconds.
3. THE Séance_UI SHALL provide a focus indicator on each interactive element that achieves a contrast ratio of at least 3:1 against the element's adjacent colors.
4. THE Séance_UI SHALL expose a non-empty accessible name and a role for the Ouija_Board and the Planchette, and SHALL mark each candle element as decorative so that it is hidden from assistive technology.
5. WHEN the answer text is revealed, THE Séance_UI SHALL announce the answer text to assistive technology through a live region.

### Requirement 10: Robustness and Graceful Degradation

**User Story:** As a developer, I want the séance to degrade gracefully when the model is unavailable, so that the visitor sees an in-character message rather than a crash.

#### Acceptance Criteria

1. IF the Anthropic Messages API returns a non-2xx HTTP response, the fetch call to the Anthropic Messages API rejects, or the response body does not yield a non-empty answer string, THEN THE Séance_API SHALL return a successful HTTP response whose JSON body contains an `answer` field holding an in-character message, and the response body and headers SHALL exclude any raw upstream error status text, error body, or stack trace.
2. IF the Séance_UI does not receive an answer within thirty seconds, THEN THE Séance_UI SHALL abort the in-flight request, end the waiting state, and display an in-character message that contains no raw technical error detail.

### Requirement 11: Maintainability of the Usage Store

**User Story:** As a developer, I want the per-day usage counter behind a small interface, so that a durable store can replace the in-memory store without changing the API logic.

#### Acceptance Criteria

1. THE Usage_Store SHALL expose an interface consisting of a `getCurrentCount` method that returns the accepted-call count for a specified UTC day and a `getAndIncrement` method that increments the accepted-call count for a specified UTC day by one and returns the resulting count.
2. THE Séance_API SHALL depend only on the Usage_Store interface and not on any specific implementation.
3. WHILE the in-memory implementation is the default, THE Séance_API SHALL receive the Usage_Store instance through a dependency-injection seam, allowing a substitute durable implementation that conforms to the Usage_Store interface to be provided without any edit to the Séance_API request-handling logic.

### Requirement 12: Content Guardrails

**User Story:** As a visitor, I want the séance to stay within public-domain thinkers and frame itself as imagination, so that I am not misled into thinking it is real divination or professional advice.

#### Acceptance Criteria

1. THE Séance_UI SHALL display a disclaimer stating that the séance is a product of imagination, that it does not genuinely contact the dead or predict the future, and that it is not professional medical, legal, financial, or therapeutic counsel.
2. THE Séance_UI SHALL keep the disclaimer continuously visible from initial page load through Philosopher selection, worry entry, the waiting state, and answer reveal.
3. THE Séance_UI SHALL offer no Philosopher outside the six public-domain figures listed in the Glossary: Socrates, Confucius, Laozi, Seneca, Marcus Aurelius, and Nietzsche.
4. IF a submitted `philosopherId` is not one of the six defined identifiers, THEN THE Séance_API SHALL reject the request before any Anthropic Messages API call.
5. THE Séance_API SHALL include, in the system prompt sent to the model, instructions to frame every reply as a product of imagination and to never claim to genuinely contact the dead or predict the future.
6. THE Séance_API SHALL include, in the system prompt sent to the model, instructions to decline requests for medical, legal, financial, or therapeutic advice and to redirect the visitor to reflection.

## Property-Based Testing Correctness Properties

These properties express the key invariants of the Séance_App as testable properties. The Usage_Store logic, DAILY_CALL_LIMIT parsing, worry validation, and worry sanitization are pure or in-memory functions whose behavior varies with input, which makes them suitable for property-based testing. The Anthropic Messages API itself is an external service; properties that touch it use a mock of the fetch call, and a single integration test covers end-to-end behavior.

1. **Fail-closed on invalid limit (Error condition):** FOR ALL values `v` in the set {unset, empty string, `"0"`, `"-1"`, `"abc"`, `"1.5"`}, when DAILY_CALL_LIMIT equals `v`, the Séance_API rejects every call with HTTP 429 and error code SPIRITS_RESTING and performs zero Anthropic Messages API calls.

2. **Limit never exceeded (Invariant):** FOR ALL positive integer limits `L` and sequences of accepted calls within one UTC day, the count of accepted calls never exceeds `L`; every call beyond `L` is rejected with SPIRITS_RESTING.

3. **Worry validation rejects invalid input (Error condition):** FOR ALL strings `s`, if the trimmed length of `s` is zero or the trimmed length of `s` exceeds five hundred, the Séance_API rejects the request with HTTP 400 and performs zero Anthropic Messages API calls.

4. **Worry sanitization is idempotent (Idempotence):** FOR ALL worry strings `s`, `sanitize(sanitize(s))` equals `sanitize(s)`.

5. **Philosopher allowlist is exhaustive (Invariant / membership):** FOR ALL `philosopherId` values `p`, the Séance_API accepts `p` if and only if `p` is one of the six defined identifiers.

6. **UTC day boundary resets the count (Metamorphic):** FOR ALL positive integer limits `L`, a call whose timestamp crosses UTC midnight is counted against the new UTC day, and the previous UTC day's count remains fixed at its terminal value.

7. **Valid request round-trip (Round trip):** FOR ALL valid `(philosopherId, worry)` pairs, the Séance_API returns a JSON object with a non-empty `answer` string (using a mocked fetch that returns a fixed model response).

8. **Fail-closed on missing API key (Error condition):** FOR ALL valid `(philosopherId, worry)` pairs, when ANTHROPIC_API_KEY is unset or empty, the Séance_API returns HTTP 503 and performs zero Anthropic Messages API calls.
