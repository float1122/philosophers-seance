// Usage_Store interface:
//   getCurrentCount(utcDay: string) -> number
//   getAndIncrement(utcDay: string) -> number (the new count)
// The handler depends only on this shape, so a durable store can be injected.

export function utcDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export class InMemoryUsageStore {
  #counts = new Map();

  getCurrentCount(utcDay) {
    return this.#counts.get(utcDay) ?? 0;
  }

  getAndIncrement(utcDay) {
    const next = this.getCurrentCount(utcDay) + 1;
    this.#counts.set(utcDay, next);
    return next;
  }
}
