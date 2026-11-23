// Entry orchestrator: wires the board, picker, worry input and reveal.
import { renderBoard } from "./board.js";
import { renderPicker } from "./philosophers.js";
import { wireWorryInput, isTrimmedEmpty } from "./worry.js";
import { glide } from "./planchette.js";
import { reveal } from "./reveal.js";
import { createSummoner } from "./api-client.js";
import { watchReducedMotion } from "./reduced-motion.js";

const $ = (id) => document.getElementById(id);

const els = {
  seance: document.querySelector(".seance"),
  board: $("board"),
  picker: $("picker"),
  form: $("ask"),
  worry: $("worry"),
  count: $("worry-count"),
  summon: $("summon"),
  answer: $("answer"),
  waiting: $("waiting"),
  visible: $("answer-visible"),
  sign: $("answer-sign"),
  live: $("answer-live"),
};

const motion = watchReducedMotion(window);
const summon = createSummoner();
const state = { philosopher: null, worry: "", busy: false };
let stopReveal = () => {};
let stopGlide = () => {};

const { planchette } = renderBoard(els.board, document);

function refreshControls() {
  els.worry.disabled = !state.philosopher;
  els.worry.placeholder = state.philosopher
    ? `Tell ${state.philosopher.name} what troubles you…`
    : "First, choose a spirit to listen…";
  els.summon.disabled = !state.philosopher || isTrimmedEmpty(state.worry);
}

renderPicker(els.picker, document, (philosopher) => {
  state.philosopher = philosopher;
  els.summon.textContent = `Summon ${philosopher.name}`;
  refreshControls();
});

wireWorryInput(els.worry, els.count, (value) => {
  state.worry = value;
  refreshControls();
});

function showWaiting(philosopher) {
  stopReveal();
  els.answer.hidden = false;
  els.answer.classList.remove("is-resting");
  els.waiting.hidden = false;
  els.visible.textContent = "";
  els.sign.textContent = "";
  els.live.textContent = "";
  els.seance.classList.add("is-summoning");
  els.answer.querySelector(".answer__title").textContent = `${philosopher.name} stirs`;
}

function showAnswer(philosopher, text, { resting = false } = {}) {
  els.seance.classList.remove("is-summoning");
  els.waiting.hidden = true;
  els.answer.classList.toggle("is-resting", resting);
  els.answer.querySelector(".answer__title").textContent = resting
    ? "The board falls silent"
    : `${philosopher.name} speaks`;
  stopReveal = reveal(els.visible, els.live, text, { reducedMotion: motion.reduced });
  els.sign.textContent = resting ? "" : `— the spirit of ${philosopher.name}`;
}

els.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const philosopher = state.philosopher;
  if (!philosopher || isTrimmedEmpty(state.worry)) return;

  showWaiting(philosopher);
  stopGlide();
  const ride = glide(planchette, els.board, philosopher.name, { reducedMotion: motion.reduced });
  stopGlide = ride.cancel;

  const result = await summon({ philosopherId: philosopher.id, worry: state.worry });
  if (result.cancelled) return;
  await ride.done;
  if (result.ok) showAnswer(philosopher, result.answer);
  else showAnswer(philosopher, result.message, { resting: Boolean(result.resting) });
});

refreshControls();
