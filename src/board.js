// Ouija board markup: two arcs of letters, a numberless rim, and the planchette.
const ROW_ONE = "ABCDEFGHIJKLM".split("");
const ROW_TWO = "NOPQRSTUVWXYZ".split("");

function arcRow(doc, letters, rowClass) {
  const row = doc.createElement("div");
  row.className = `board__row ${rowClass}`;
  letters.forEach((letter, i) => {
    const span = doc.createElement("span");
    span.className = "board__letter";
    span.dataset.letter = letter;
    span.textContent = letter;
    // Position along a gentle arc via CSS custom properties.
    const t = letters.length === 1 ? 0 : i / (letters.length - 1) - 0.5;
    span.style.setProperty("--t", String(t));
    row.append(span);
  });
  return row;
}

export function renderBoard(board, doc) {
  board.textContent = "";
  board.setAttribute("role", "img");
  board.setAttribute("aria-label", "A candlelit spirit board with the letters A to Z, YES, NO and GOODBYE");

  const corners = doc.createElement("div");
  corners.className = "board__corners";
  corners.setAttribute("aria-hidden", "true");
  for (const [cls, text] of [["yes", "YES"], ["no", "NO"]]) {
    const el = doc.createElement("span");
    el.className = `board__word board__word--${cls}`;
    el.textContent = text;
    corners.append(el);
  }

  const sun = doc.createElement("span");
  sun.className = "board__glyph board__glyph--sun";
  sun.setAttribute("aria-hidden", "true");
  sun.textContent = "☉";
  const moon = doc.createElement("span");
  moon.className = "board__glyph board__glyph--moon";
  moon.setAttribute("aria-hidden", "true");
  moon.textContent = "☾";

  const goodbye = doc.createElement("span");
  goodbye.className = "board__goodbye";
  goodbye.setAttribute("aria-hidden", "true");
  goodbye.textContent = "GOODBYE";

  const planchette = doc.createElement("div");
  planchette.className = "planchette";
  planchette.setAttribute("role", "img");
  planchette.setAttribute("aria-label", "Planchette");
  const lens = doc.createElement("span");
  lens.className = "planchette__lens";
  planchette.append(lens);

  board.append(
    corners,
    sun,
    moon,
    arcRow(doc, ROW_ONE, "board__row--one"),
    arcRow(doc, ROW_TWO, "board__row--two"),
    goodbye,
    planchette
  );
  return { planchette };
}
