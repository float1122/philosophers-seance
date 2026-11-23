# Devpost submission copy: Philosophers' Séance

## Where the fields come from

The official rules (https://kiroween.devpost.com/rules, "Submission Requirements" and "How To Enter") and the FAQ (https://kiroween.devpost.com/details/faqs) require:

| Required by the rules / FAQ | What we enter |
|---|---|
| URL to the functional application | https://philosophers-seance.pages.dev |
| Text description of features and functionality | The project story below |
| Demonstration video: under three minutes, public on YouTube, no copyrighted music or third-party trademarks without permission | YouTube link (to be uploaded; script in `video-script.md`) |
| Public GitHub repository with an open source license visible in the About section, `/.kiro` at the root | https://github.com/float1122/philosophers-seance (MIT) |
| Category and bonus category | Costume Contest; Best Startup Project bonus (see below) |
| Write-up on how Kiro was used | `kiro-writeup.md` (paste into the Kiro field, or link to it in the repo) |
| Best Startup Project only: confirm you are a founder, LinkedIn profile, startup website | See "Best Startup Project" below |
| Login credentials / testing instructions, only if needed | Not needed: no login. Testing note below |
| Disclosure of pre-existing code (rule "New Projects Only") | See "Pre-existing code" below |
| English materials | Everything here is in English |

The project story headings (Inspiration, What it does, How we built it, Challenges we ran into, Accomplishments that we're proud of, What we learned, What's next) and the "Built with" tag list are **Devpost's standard project form**, not something the Kiroween rules or FAQ spell out. They are written below in that order.

---

## Project name

Philosophers' Séance

## Tagline

Light the candles, choose a spirit, and whisper what keeps you awake.

## Inspiration

Everyone has a worry they turn over at night. People have always asked the dead for advice at séances. Philosophers spent their lives on the questions behind most of those worries: fear, time, duty, letting go. We wanted to bring the two together in the spirit of Kiroween. Dress a chatbot up as a séance, and make the costume do real work, so the eerie atmosphere slows you down and the answer that comes back is grounded in a real thinker's way of seeing the world, not random spooky noise.

## What it does

Philosophers' Séance is a candlelit Ouija board in the browser.

- **Choose a spirit.** You pick one of the public-domain thinkers who can be summoned: Socrates, Confucius, Laozi, Seneca, Marcus Aurelius or Nietzsche. Each has a short line that hints at their voice.
- **Whisper your worry.** You type what's on your mind. A counter shows how much room is left.
- **Summon.** The planchette glides across the board and spells the spirit's name letter by letter while the candles gutter.
- **The spirit speaks.** The answer arrives as spirit writing on parchment, in that philosopher's voice: Socrates answers with a question, Laozi speaks of water and letting go, Seneca writes like an old friend.
- **The spirits rest.** The demo is free for everyone, so it has a daily limit. When the limit is reached, or if anything is misconfigured, the board falls silent and tells you the spirits are resting. No call goes out.

Every spooky element carries information. The planchette confirms who you summoned, the guttering candles mean the spirit is thinking, the spirit writing is the answer itself, and the "resting" screen is the limit. A disclaimer stays visible the whole time: this is a séance of the imagination. It does not contact the dead or predict the future, and it is not medical, legal, financial or therapeutic advice.

It is also built to be usable by everyone: full keyboard operation, accessible names on the board and planchette, a live region that gives screen readers the full answer at once, and a reduced-motion mode where the candles stop flickering, the planchette jumps straight to the last letter and the answer appears instantly.

## How we built it

We built it spec-first with **Kiro**.

- **Steering** docs set the product scope, the stack and security rules, and the voice of the spirits and content guardrails, including "public-domain thinkers only, never quote a modern copyrighted translation".
- A **spec** generated in Kiro gave us EARS acceptance criteria, a design with correctness properties, and a test-first task list.
- An **agent hook** runs the test suite whenever a source or test file is saved.
- The correctness properties are checked with **property-based tests** (`fast-check`), alongside `node:test` example tests and DOM tests with `linkedom`.

The front end is plain HTML, CSS and vanilla JavaScript modules with no framework and no build step. Typography uses Cinzel and IM Fell English from Google Fonts. The back end is a single serverless function on **Cloudflare Pages Functions** that validates the request, checks the daily limit, and calls the **Anthropic Messages API** (a Claude Haiku model) with a persona prompt written from scratch for each philosopher. The daily count lives in **Cloudflare D1** and is checked and incremented in one atomic statement.

The full Kiro story is in our Kiro write-up and in the `/.kiro` folder of the repo.

## Challenges we ran into

- **Our Kiro credits ran out mid-build.** Kiro generated the steering, hook, requirements, design and tasks, completed the setup task and wrote the first batch of failing tests. Then the free-tier credits ran out. We finished the rest outside Kiro, by hand, working through `tasks.md` in order and staying test-first. Having the spec already written is what made that possible.
- **Keeping a free AI demo safe.** A public demo that calls a paid model has to be impossible to run away with. Our first durable counter could be raced by simultaneous requests, so we moved it to an atomic database upsert. The function now refuses to run at all without a durable store, a valid limit or a key.
- **Spooky without being cruel.** The spirits had to feel eerie but stay kind, never mocking and never pretending to be a therapist or an oracle. We put that voice in a steering doc so it held across every prompt.
- **Not putting words in dead mouths.** We wrote every persona ourselves instead of quoting modern translations, which may still be under copyright.

## Accomplishments that we're proud of

- A haunting interface where the costume *is* the function: name-spelling planchette, guttering candles, spirit writing, a silent board at the limit.
- The whole backend fails closed. A missing key, a missing or invalid limit, a missing store or a store error all lead to the same calm, in-character "resting" message, never a leaked error.
- Accessibility kept intact under the costume: keyboard flow, screen-reader live region and a real reduced-motion mode.
- A spec in the repo that still matches the code, including the security revisions we made after the Kiro credits ran out.

## What we learned

- Putting rules in **steering** instead of prompts makes them stick. "Fail closed" and "public-domain only" showed up in every requirement and task without being repeated.
- **EARS** forces you to decide the unhappy paths early. Most of our real design decisions were made while writing "IF … THEN … SHALL" sentences, not while coding.
- **Property-based tests** fit trust-boundary code well: sanitization, length counting in Unicode code points, and a limit parser that must reject every malformed value.
- A good spec outlives the tool that wrote it. When we lost Kiro mid-build, the plan kept us on track.

## What's next

- Let more than one spirit answer the same worry, so the thinkers can respond to each other at one séance.
- Ground answers in public-domain source texts, so a spirit can point you to the passage behind its advice.
- Carry a séance forward into a longer conversation with the same spirit.
- Bring the séance into our company's other products (see "Best Startup Project").

## Built with

`javascript` · `html` · `css` · `node.js` · `cloudflare-pages` · `cloudflare-pages-functions` · `cloudflare-d1` · `sqlite` · `anthropic-claude` · `claude-haiku` · `kiro` · `node-test` · `fast-check` · `linkedom` · `google-fonts`

## Category: Costume Contest, and why

The rules describe Costume Contest as: "Build any app but show us a haunting user interface that's polished and unforgettable. Bring in spooky design elements that enhance your app's function."

Philosophers' Séance fits that description closely. Under the costume it is an ordinary AI question-and-answer app, and the séance is what makes it work:

- the **planchette** spelling the name is the confirmation of whom you summoned;
- the **guttering candles** are the loading state;
- the **spirit writing** is the answer reveal;
- the **silent board** ("the spirits are resting") is the limit and error state.

Each spooky element replaces a plain UI pattern with one that does the same job and adds to the atmosphere. We kept it accessible too: keyboard, screen readers and reduced motion all work under the costume.

## Best Startup Project

**Founder confirmation:** [to be confirmed by the submitting founder]
**LinkedIn profile:** [founder LinkedIn URL]
**Startup website:** [FLOAT Co., Ltd. website URL]

**About the startup.** Philosophers' Séance was built by FLOAT Co., Ltd. The séance is a playful, English-language take on a simple need: people who want to think a personal question through with a great thinker's voice instead of a generic assistant.

It connects naturally to two of our existing services:

- **INTA**, where the same idea can continue as an ongoing philosopher chat rather than a single séance;
- **HRUM**, our AI API platform, whose philosopher AI could let other sites and apps add a philosopher voice of their own.

The séance can work as a memorable, shareable front door to both: a visitor meets a spirit here, and can keep the conversation going in INTA or build it into their own product with HRUM.

## Testing instructions (for judges)

No login is needed. Open https://philosophers-seance.pages.dev, choose a spirit, type a worry and press "Summon". If the day's limit has been reached, the board shows "The spirits are resting now"; this is the intended fail-closed behaviour, and the limit resets at the next UTC midnight. The demo video shows the full flow end to end.

## Pre-existing code

None. The project was created in a new repository during the Submission Period. Third-party pieces are open-source libraries used under their licenses (`fast-check` and `linkedom`, development only), Google Fonts, and the Anthropic Messages API.
