# Demo video script: Philosophers' Séance

- Target length: **2:40** (hard limit: under 3:00, per the Kiroween rules)
- Upload: YouTube, public
- Audio: narration only. No copyrighted music; if a bed is used, it must be original or properly licensed. No third-party trademarks on screen beyond the tools the app is built with.
- Live app: https://philosophers-seance.pages.dev
- Scenes marked **[capture after key]** need a real AI answer, so they are filmed only after the API key is set on the deployment. Everything else can be filmed now.

| # | Time | On screen | Narration |
|---|---|---|---|
| 1 | 0:00 – 0:12 | Dark screen. Candles fade in around the spirit board. Masthead: "A séance for restless minds / Philosophers' Séance". Smoke drifts. | "It's late. Something is keeping you awake. What if you could ask someone who thought about it for a whole lifetime, centuries ago?" |
| 2 | 0:12 – 0:22 | Slow pan across the board: the alphabet, the planchette, three flickering candles. | "This is Philosophers' Séance. Light the candles, choose a spirit, and whisper what keeps you awake." |
| 3 | 0:22 – 0:38 | Section "I Choose a spirit". Cursor moves over the picker: Socrates, Confucius, Laozi, Seneca, Marcus Aurelius, Nietzsche. Each card shows its short line. Click **Seneca**; the card lights up and the button changes to "Summon Seneca". | "Only public-domain thinkers answer the call. Each one keeps a voice of their own. Socrates answers with a question. Laozi speaks of water. Seneca writes to you like an old friend." |
| 4 | 0:38 – 0:52 | Section "II Whisper your worry". Placeholder reads "Tell Seneca what troubles you…". Type a worry, for example: "I keep putting off a hard conversation with my brother." The remaining-characters counter ticks down. | "You don't need the right words. Just say what's on your mind. The board keeps your worry short, and it never stores it." |
| 5 | 0:52 – 1:10 | Click "Summon Seneca". The planchette glides letter by letter: S, E, N, E, C, A, each letter glowing as it passes. The candles gutter. Text: "The candles gutter. Something stirs beyond the veil…" Title: "Seneca stirs". | "Then the summoning. The planchette spells the name of the spirit you called, and the candles gutter while the spirit thinks. The costume is the interface: every spooky effect tells you what the app is doing." |
| 6 | 1:10 – 1:35 | **[capture after key]** Title changes to "Seneca speaks". The answer appears as spirit writing on parchment, character by character. Signature line: "— the spirit of Seneca". Hold long enough to read part of the answer. | "And the answer arrives as spirit writing, in Seneca's own calm, practical voice, written for your worry and nobody else's." |
| 7 | 1:35 – 1:48 | **[capture after key]** Quick second séance: pick Socrates, type a short worry, cut straight to the answer being written. | "Ask Socrates instead, and you'll get a question back, the kind you keep thinking about on the walk home." |
| 8 | 1:48 – 1:58 | Footer disclaimer in focus: "A séance of the imagination. It does not contact the dead or predict the future, and it is not medical, legal, financial, or therapeutic advice." Then a short clip with reduced motion turned on: the planchette jumps straight to the last letter and the answer appears at once. | "It's a séance of the imagination, and it says so on every screen. With reduced motion on, the board stays still and the answer appears at once." |
| 9 | 1:58 – 2:10 | Summon a spirit after the day's limit is reached. The planchette still glides, then the title reads "The board falls silent" and the message: "The spirits are resting now. The candles have burned low for today; return after the next midnight." (This screen can be filmed now: the live site shows the same message today because no key is set.) | "The spirits are free to visit, so the board has a daily limit. When it's reached, or if anything is misconfigured, the séance fails closed. No call goes out, and the board simply tells you the spirits are resting." |
| 10 | 2:10 – 2:30 | Kiro screen recording, fast cuts: `.kiro/steering/` (`product.md`, `tech.md`, `tone.md`), then `.kiro/specs/seance-core/requirements.md` scrolled to an EARS criterion ("IF the DAILY_CALL_LIMIT … THEN THE Séance_API SHALL reject every call…"), then `design.md` "Correctness Properties", then `tasks.md` with checked boxes, then `.kiro/hooks/run-tests-on-save.json`, then a terminal running `npm test` with all tests passing. | "We built it spec-first with Kiro. Steering docs set the stack, the security rules and the voice of the spirits. Kiro turned them into EARS requirements, a design with correctness properties, and a test-first task list. A hook runs the tests on every save, and the properties are checked with property-based tests." |
| 11 | 2:30 – 2:40 | End card on the candlelit board: "Philosophers' Séance", the live URL, the GitHub URL, "Built with Kiro", "FLOAT Co., Ltd." | "Philosophers' Séance. Bring your worry, and see who answers." |

**Total runtime: 2:40**

## Capture notes

- Record at desktop width (the layout in `docs/screenshots/seance-1440.png`). An optional phone-width cutaway can replace part of scene 2 (`seance-390.png` layout).
- Scenes 6 and 7 depend on a live key. Re-time scene 6 to the real answer length; if the answer is long, cut away while it is still writing rather than extending past 1:35.
- Scene 9: the same in-character "resting" screen appears whether the daily limit is reached or the deployment has no usable limit. Film it from the live site now, or after the key goes in by reaching the limit.
- Do not show the Cloudflare dashboard, environment variables, keys or account pages anywhere in the recording.
- Kiro scene: use the files as they are in the public repo so what judges see in the video matches the repository.
