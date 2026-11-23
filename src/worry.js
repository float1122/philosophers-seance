// Worry input helpers. Characters are Unicode code points.
export const MAX_WORRY = 500;

export const countCodePoints = (str) => [...str].length;

export function truncateToCodePoints(str, max = MAX_WORRY) {
  const points = [...str];
  return points.length <= max ? str : points.slice(0, max).join("");
}

export const remainingCount = (str, max = MAX_WORRY) => Math.max(0, max - countCodePoints(str));

export const isTrimmedEmpty = (str) => str.trim().length === 0;

// Thin DOM wiring: enforce the bound on every edit and keep the counter live.
export function wireWorryInput(textarea, counter, onChange) {
  const update = () => {
    const bounded = truncateToCodePoints(textarea.value);
    if (bounded !== textarea.value) textarea.value = bounded;
    const left = remainingCount(textarea.value);
    counter.textContent = `${left} characters left`;
    onChange(textarea.value);
  };
  textarea.addEventListener("beforeinput", (event) => {
    const adding = event.data ?? "";
    const selected = textarea.selectionEnd - textarea.selectionStart;
    if (adding && countCodePoints(textarea.value) - selected + countCodePoints(adding) > MAX_WORRY) {
      if (event.inputType === "insertText") event.preventDefault();
    }
  });
  textarea.addEventListener("input", update);
  update();
}
