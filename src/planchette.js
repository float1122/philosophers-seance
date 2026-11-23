// Planchette path and glide timing.
export const MAX_GLIDE_MS = 20000;
const STEP_MS = 650;

export function planchettePath(name) {
  return name.toUpperCase().replace(/[^A-Z]/g, "").split("");
}

export function glideSchedule(path, { reducedMotion = false } = {}) {
  if (path.length === 0) return [];
  if (reducedMotion) return [{ letter: path.at(-1), at: 0 }];
  const step = Math.min(STEP_MS, Math.floor(MAX_GLIDE_MS / path.length));
  return path.map((letter, i) => ({ letter, at: step * (i + 1) }));
}

// Move the planchette so its lens sits over the given letter node.
function moveTo(planchette, board, letterNode) {
  const b = board.getBoundingClientRect();
  const l = letterNode.getBoundingClientRect();
  // Convert screen coordinates back into the board's own (untransformed) space.
  const sx = board.offsetWidth / b.width || 1;
  const sy = board.offsetHeight / b.height || 1;
  const x = (l.left - b.left + l.width / 2) * sx;
  const y = (l.top - b.top + l.height / 2) * sy;
  const tilt = (x / board.offsetWidth - 0.5) * 24;
  planchette.style.transform = `translate(${x}px, ${y}px) translate(-50%, -38%) rotate(${tilt}deg)`;
}

export function glide(planchette, board, name, { reducedMotion = false, onLetter = () => {} } = {}) {
  const steps = glideSchedule(planchettePath(name), { reducedMotion });
  planchette.classList.toggle("is-instant", reducedMotion);
  const timers = [];
  const done = new Promise((resolve) => {
    if (steps.length === 0) return resolve();
    for (const [i, step] of steps.entries()) {
      timers.push(setTimeout(() => {
        const node = board.querySelector(`[data-letter="${step.letter}"]`);
        if (node) {
          moveTo(planchette, board, node);
          board.querySelectorAll(".is-lit").forEach((n) => n.classList.remove("is-lit"));
          node.classList.add("is-lit");
        }
        onLetter(step.letter, i);
        if (i === steps.length - 1) resolve();
      }, step.at));
    }
  });
  return { done, cancel: () => timers.forEach(clearTimeout) };
}
