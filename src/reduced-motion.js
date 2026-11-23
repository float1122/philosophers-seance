// Tracks the prefers-reduced-motion preference and notifies listeners.
const QUERY = "(prefers-reduced-motion: reduce)";

export function watchReducedMotion(win, onChange = () => {}) {
  const mql = win.matchMedia ? win.matchMedia(QUERY) : null;
  const state = { reduced: Boolean(mql?.matches) };
  mql?.addEventListener?.("change", (event) => {
    state.reduced = event.matches;
    onChange(state.reduced);
  });
  return state;
}
