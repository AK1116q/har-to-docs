import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, extname, sep } from "node:path";
const root = fileURLToPath(new URL("../dist/", import.meta.url));
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".mjs": "text/javascript",
  ".json": "application/json",
  ".har": "application/json",
  ".svg": "image/svg+xml",
};
const server = createServer(async (req, res) => {
  try {
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405).end();
      return;
    }
    const path = resolve(
      root,
      "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname),
    );
    if (path !== resolve(root) && !path.startsWith(resolve(root) + sep)) {
      res.writeHead(403).end();
      return;
    }
    const target = path === resolve(root) ? resolve(root, "index.html") : path;
    const content = await readFile(target);
    res.writeHead(200, {
      "Content-Type": types[extname(target)] ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
      "Content-Security-Policy":
        "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'",
    });
    res.end(req.method === "HEAD" ? undefined : content);
  } catch {
    res.writeHead(404).end("Not found");
  }
});
server.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
server.listen(Number(process.env.PORT || 4173), "127.0.0.1", () =>
  console.log(`Local: http://127.0.0.1:${server.address().port}`),
);
