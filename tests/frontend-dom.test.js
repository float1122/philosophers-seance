// Feature: seance-core — board, picker and reveal DOM behaviour (via linkedom).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import { renderBoard } from "../src/board.js";
import { PHILOSOPHERS, renderPicker } from "../src/philosophers.js";
import { revealSchedule, MAX_REVEAL_MS } from "../src/reveal.js";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const fresh = () => parseHTML(html).document;

test("board renders A-Z with accessible names and decorative candles", () => {
  const doc = fresh();
  const board = doc.querySelector("#board");
  renderBoard(board, doc);
  const letters = [...board.querySelectorAll("[data-letter]")].map((n) => n.dataset.letter);
  assert.deepEqual(letters, "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""));
  assert.equal(board.getAttribute("role"), "img");
  assert.ok(board.getAttribute("aria-label").length > 0);
  const planchette = board.querySelector(".planchette");
  assert.ok(planchette.getAttribute("aria-label").length > 0);
  const candles = doc.querySelectorAll(".candle");
  assert.ok(candles.length > 0);
  for (const c of candles) assert.equal(c.getAttribute("aria-hidden"), "true");
});

test("picker offers exactly the six public-domain philosophers with personas", () => {
  assert.deepEqual(PHILOSOPHERS.map((p) => p.id), ["socrates", "confucius", "laozi", "seneca", "marcus-aurelius", "nietzsche"]);
  const doc = fresh();
  const list = doc.querySelector("#picker");
  const selected = [];
  renderPicker(list, doc, (p) => selected.push(p.id));
  const options = list.querySelectorAll("button[data-id]");
  assert.equal(options.length, 6);
  for (const p of PHILOSOPHERS) assert.ok(p.persona.length > 0);
});

test("selecting a philosopher marks it pressed and clears the previous one", () => {
  const doc = fresh();
  const list = doc.querySelector("#picker");
  const api = renderPicker(list, doc, () => {});
  api.select("laozi");
  api.select("seneca");
  const pressed = [...list.querySelectorAll('[aria-pressed="true"]')].map((b) => b.dataset.id);
  assert.deepEqual(pressed, ["seneca"]);
  assert.equal(api.select("plato"), false);
});

test("page starts with worry input and summon disabled, disclaimer visible, live region present", () => {
  const doc = fresh();
  assert.ok(doc.querySelector("#worry").hasAttribute("disabled"));
  assert.ok(doc.querySelector("#summon").hasAttribute("disabled"));
  assert.match(doc.querySelector("#disclaimer").textContent, /imagination/i);
  assert.match(doc.querySelector("#disclaimer").textContent, /medical, legal, financial/i);
  assert.equal(doc.querySelector("#answer-live").getAttribute("aria-live"), "polite");
});

test("reveal schedule finishes within five seconds and is instant with reduced motion", () => {
  const long = "x".repeat(2000);
  const steps = revealSchedule(long);
  assert.ok(steps.at(-1).at <= MAX_REVEAL_MS);
  assert.equal(steps.at(-1).text, long);
  assert.deepEqual(revealSchedule("hi", { reducedMotion: true }), [{ text: "hi", at: 0 }]);
});
