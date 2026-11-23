// Spirit-writing reveal: characters appear in sequence within five seconds.
export const MAX_REVEAL_MS = 5000;
const CHAR_MS = 28;
const MAX_STEPS = 160;

export function revealSchedule(text, { reducedMotion = false } = {}) {
  const chars = [...text];
  if (reducedMotion || chars.length === 0) return [{ text, at: 0 }];
  const steps = Math.min(chars.length, MAX_STEPS);
  const total = Math.min(MAX_REVEAL_MS, chars.length * CHAR_MS);
  const out = [];
  for (let i = 1; i <= steps; i += 1) {
    const end = Math.round((chars.length * i) / steps);
    out.push({ text: chars.slice(0, end).join(""), at: Math.round((total * i) / steps) });
  }
  return out;
}

// Visible text animates; the live region gets the full text at once so
// assistive technology always has the complete answer.
export function reveal(visibleEl, liveEl, text, { reducedMotion = false } = {}) {
  liveEl.textContent = text;
  const timers = revealSchedule(text, { reducedMotion }).map((step) =>
    setTimeout(() => { visibleEl.textContent = step.text; }, step.at)
  );
  return () => timers.forEach(clearTimeout);
}
