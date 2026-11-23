// Usage store contract used by the handler:
//   durable: boolean                     true only for shared, persistent stores
//   tryConsume(utcDay, limit, ttlSeconds) -> Promise<boolean>
//     Count one accepted call for utcDay if fewer than `limit` were counted;
//     stores may use ttlSeconds to expire old days (D1 keeps one row per day).
// The deployed function only accepts durable stores. InMemoryUsageStore is for
// local development and tests (it is per-process and resets on restart).

// Keep a day's counter a little past its UTC day so late requests still see it.
export const DAY_TTL_SECONDS = 2 * 24 * 60 * 60;

export function utcDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export class InMemoryUsageStore {
  durable = false;
  #counts = new Map();

  getCurrentCount(utcDay) {
    return this.#counts.get(utcDay) ?? 0;
  }

  getAndIncrement(utcDay) {
    const next = this.getCurrentCount(utcDay) + 1;
    this.#counts.set(utcDay, next);
    return next;
  }

  // Synchronous check-and-increment, so it is atomic within one process.
  async tryConsume(utcDay, limit) {
    if (this.getCurrentCount(utcDay) >= limit) return false;
    this.getAndIncrement(utcDay);
    return true;
  }
}
