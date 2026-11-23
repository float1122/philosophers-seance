// Stand-in for a Cloudflare D1 binding backed by real SQLite (node:sqlite), so
// the store's SQL actually runs. Each query waits a macrotask before executing
// to let concurrent callers interleave; the statement itself runs atomically,
// as it does on D1. Tests only.
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

const MIGRATIONS = ["0001_usage.sql", "0002_ip_usage.sql"].map(
  (name) => new URL(`../../migrations/${name}`, import.meta.url)
);
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

export function fakeD1({ failWith } = {}) {
  const db = new DatabaseSync(":memory:");
  for (const file of MIGRATIONS) db.exec(readFileSync(file, "utf8"));
  const queries = [];
  const prepare = (sql) => {
    const statement = (params) => ({
      bind: (...next) => statement(next),
      async first() {
        queries.push({ sql, params });
        await tick();
        if (failWith) throw failWith;
        return db.prepare(sql).get(...params) ?? null;
      },
      async run() {
        queries.push({ sql, params });
        await tick();
        if (failWith) throw failWith;
        db.prepare(sql).run(...params);
        return { success: true };
      },
    });
    return statement([]);
  };
  return {
    queries,
    prepare,
    count: (day) => db.prepare("SELECT n FROM usage WHERE day = ?").get(day)?.n ?? 0,
    ipRows: () => db.prepare("SELECT day, ip_hash, n FROM ip_usage").all(),
    dump: () => JSON.stringify({
      usage: db.prepare("SELECT * FROM usage").all(),
      ip_usage: db.prepare("SELECT * FROM ip_usage").all(),
    }),
  };
}
