// Servidor local para desenvolvimento/uso sem o Vercel.
// Serve o HTML e expõe a MESMA rota /api/state que roda no Vercel,
// reaproveitando lib/state.js. Rode com:  npm start
import http from "node:http";
import { readFile } from "node:fs/promises";
import { readState, writeState } from "./lib/state.js";

const PORT = process.env.PORT || 3000;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function contentType(f) {
  if (f.endsWith(".html")) return "text/html; charset=utf-8";
  if (f.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (f.endsWith(".css")) return "text/css; charset=utf-8";
  if (f.endsWith(".json")) return "application/json; charset=utf-8";
  return "application/octet-stream";
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    if (url.pathname === "/api/state") {
      if (req.method === "GET") {
        const data = await readState();
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        });
        return res.end(JSON.stringify({ data }));
      }
      if (req.method === "POST" || req.method === "PUT") {
        const parsed = JSON.parse((await readBody(req)) || "{}");
        const result = await writeState(parsed);
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        return res.end(JSON.stringify(result));
      }
      res.writeHead(405);
      return res.end();
    }

    // Arquivos estáticos (o "/" abre o app).
    let file = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    if (file.includes("..")) {
      res.writeHead(403);
      return res.end("Proibido");
    }
    try {
      const content = await readFile(file);
      res.writeHead(200, { "Content-Type": contentType(file) });
      return res.end(content);
    } catch {
      res.writeHead(404);
      return res.end("Não encontrado");
    }
  } catch (e) {
    res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: String((e && e.message) || e) }));
  }
});

server.listen(PORT, () =>
  console.log(`⚽ Quadra rodando em http://localhost:${PORT}`)
);
