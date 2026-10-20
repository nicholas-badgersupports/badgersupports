/* The local rig: the built site from dist/ with its _headers and _redirects applied as Netlify
 * would, and /api/* dispatched straight into the real function against PGlite.
 *
 *   node ops/dev-server.mjs                 # build, then serve on PORT (default 8899)
 *   node ops/dev-server.mjs --no-build      # serve the last build
 *   node ops/dev-server.mjs --today=2026-10-20
 *
 * Nothing here talks to the network: no Netlify, no Connect, no email.
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

process.env.LOCAL_DB ||= "pglite";
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml", ".ics": "text/calendar; charset=utf-8",
};

function parseHeaders() {
  const file = path.join(DIST, "_headers");
  if (!fs.existsSync(file)) return [];
  const rules = [];
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    if (!/^\s/.test(line)) rules.push({ pattern: line.trim(), headers: [] });
    else { const i = line.indexOf(":"); rules.at(-1).headers.push([line.slice(0, i).trim(), line.slice(i + 1).trim()]); }
  }
  return rules;
}

function parseRedirects() {
  const file = path.join(DIST, "_redirects");
  if (!fs.existsSync(file)) return new Map();
  return new Map(fs.readFileSync(file, "utf8").split("\n").filter((l) => l.trim()).map((l) => l.trim().split(/\s+/)).map(([from, to, status]) => [decodeURI(from), { to, status: Number(status) || 301 }]));
}

const matches = (pattern, p) => (pattern.endsWith("*") ? p.startsWith(pattern.slice(0, -1)) : p === pattern);

export async function startServer({ port = Number(process.env.PORT) || 8899 } = {}) {
  const { handle } = await import("../netlify/lib/router.mjs");
  const headerRules = parseHeaders();
  const redirects = parseRedirects();

  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, `http://${req.headers.host}`);
    try {
      if (u.pathname.startsWith("/api/")) {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const request = new Request(u, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks) });
        const response = await handle(request, { ip: req.socket.remoteAddress });
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(Buffer.from(await response.arrayBuffer()));
        return;
      }
      const pathname = decodeURIComponent(u.pathname);
      const r = redirects.get(pathname) || redirects.get(pathname.replace(/\/$/, ""));
      if (r) { res.writeHead(r.status, { location: r.to }); res.end(); return; }
      let file = path.join(DIST, pathname);
      if (!file.startsWith(DIST)) { res.writeHead(400); res.end(); return; }
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
      let status = 200;
      if (!fs.existsSync(file)) {
        const asDir = path.join(DIST, pathname, "index.html");
        if (fs.existsSync(asDir)) file = asDir;
        else { file = path.join(DIST, "404.html"); status = 404; }
      }
      const headers = { "content-type": TYPES[path.extname(file)] || "application/octet-stream" };
      for (const rule of headerRules) if (matches(rule.pattern, pathname)) for (const [k, v] of rule.headers) headers[k.toLowerCase()] = v;
      res.writeHead(status, headers);
      res.end(fs.readFileSync(file));
    } catch (e) {
      console.error(e);
      res.writeHead(500); res.end();
    }
  });
  await new Promise((ok) => server.listen(port, "127.0.0.1", ok));
  return server;
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  if (!process.argv.includes("--no-build")) {
    const { build } = await import("./build.mjs");
    const today = process.argv.find((a) => a.startsWith("--today="))?.split("=")[1];
    const r = await build({ today });
    console.log(`built ${r.pages.length} pages for ${r.today}`);
  }
  const port = Number(process.env.PORT) || 8899;
  await startServer({ port });
  console.log(`http://127.0.0.1:${port}/  (database: PGlite in memory; nothing leaves this machine)`);
}
