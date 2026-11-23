// Minimal in-memory stand-in for a Cloudflare KV binding (tests only).
export function fakeKv() {
  const data = new Map();
  const puts = [];
  return {
    data,
    puts,
    async get(key) { return data.has(key) ? data.get(key) : null; },
    async put(key, value, options) { puts.push({ key, value, options }); data.set(key, value); },
  };
}
