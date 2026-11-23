// Local development server only (not a deployment target).
// Serves the static front end and routes POST /api/seance to the handler.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createHandler } from "./api/seance.js";
import { InMemoryUsageStore } from "./api/usage-store.js";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const MAX_BODY_BYTES = 16 * 1024;
const PUBLIC = [/^\/index\.html$/, /^\/style\.css$/, /^\/src\/[\w-]+\.js$/];
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error("body too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function serveApi(req, res, handler) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    res.writeHead(413).end();
    return;
  }
  const request = new Request(`http://localhost${req.url}`, {
    method: req.method,
    headers: { "content-type": req.headers["content-type"] ?? "" },
    body: req.method === "POST" ? body : undefined,
  });
  const response = await handler(request);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}

async function serveStatic(req, res) {
  let path;
  try {
    path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    path = "";
  }
  if (path === "/") path = "/index.html";
  const safe = normalize(path);
  if (!PUBLIC.some((re) => re.test(safe)) || safe.split(sep).includes("..")) {
    res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
    return;
  }
  try {
    const data = await readFile(join(ROOT, safe));
    res.writeHead(200, { "content-type": TYPES[extname(safe)] ?? "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
  }
}

export function startServer({ port = 3000, host = "127.0.0.1", env = process.env } = {}) {
  // Dev only: an in-memory counter, explicitly allowed for local runs.
  const handler = createHandler({ env, store: new InMemoryUsageStore(), allowEphemeralStore: true });
  const server = createServer((req, res) => {
    const isApi = new URL(req.url, "http://localhost").pathname === "/api/seance";
    const work = isApi ? serveApi(req, res, handler) : serveStatic(req, res);
    work.catch(() => {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });
  return new Promise((resolve) => server.listen(port, host, () => resolve(server)));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const server = await startServer({ port: Number(process.env.PORT) || 3000 });
  const { port } = server.address();
  console.log(`Séance open at http://127.0.0.1:${port}`);
}
