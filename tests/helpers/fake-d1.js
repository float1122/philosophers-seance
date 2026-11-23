// Stand-in for a Cloudflare D1 binding backed by real SQLite (node:sqlite), so
// the store's SQL actually runs. Each query waits a macrotask before executing
// to let concurrent callers interleave; the statement itself runs atomically,
// as it does on D1. Tests only.
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

const MIGRATION = new URL("../../migrations/0001_usage.sql", import.meta.url);
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

export function fakeD1({ failWith } = {}) {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(MIGRATION, "utf8"));
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
    });
    return statement([]);
  };
  return {
    queries,
    prepare,
    count: (day) => db.prepare("SELECT n FROM usage WHERE day = ?").get(day)?.n ?? 0,
  };
}
