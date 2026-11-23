// Client-side philosopher data and picker. Personas are our own words.
export const PHILOSOPHERS = Object.freeze([
  { id: "socrates", name: "Socrates", origin: "Athens", persona: "Answers your worry with a question you cannot stop thinking about." },
  { id: "confucius", name: "Confucius", origin: "Lu", persona: "Finds the way through small courtesies and the people who need you." },
  { id: "laozi", name: "Laozi", origin: "Zhou", persona: "Speaks of water, emptiness, and the strength in letting go." },
  { id: "seneca", name: "Seneca", origin: "Rome", persona: "Writes to you like an old friend about fear, time, and calm." },
  { id: "marcus-aurelius", name: "Marcus Aurelius", origin: "Rome", persona: "Reads you a lamplit note about patience, duty, and endings." },
  { id: "nietzsche", name: "Nietzsche", origin: "Sils Maria", persona: "Dares you to love your life enough to live it all again." },
]);

export const findPhilosopher = (id) => PHILOSOPHERS.find((p) => p.id === id) ?? null;

export function renderPicker(list, doc, onSelect) {
  list.textContent = "";
  for (const p of PHILOSOPHERS) {
    const item = doc.createElement("li");
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "spirit";
    button.dataset.id = p.id;
    button.setAttribute("aria-pressed", "false");

    const name = doc.createElement("span");
    name.className = "spirit__name";
    name.textContent = p.name;
    const origin = doc.createElement("span");
    origin.className = "spirit__origin";
    origin.textContent = p.origin;
    const persona = doc.createElement("span");
    persona.className = "spirit__persona";
    persona.textContent = p.persona;

    button.append(name, origin, persona);
    button.addEventListener("click", () => select(p.id));
    item.append(button);
    list.append(item);
  }

  function select(id) {
    const philosopher = findPhilosopher(id);
    if (!philosopher) return false;
    for (const b of list.querySelectorAll("button[data-id]")) {
      b.setAttribute("aria-pressed", String(b.dataset.id === id));
    }
    onSelect(philosopher);
    return true;
  }

  return { select };
}
