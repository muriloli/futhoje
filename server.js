// Servidor local para desenvolvimento/uso sem o Vercel.
// Serve o HTML e expõe a MESMA rota /api/state que roda no Vercel,
// reaproveitando lib/state.js. Rode com:  npm start
import http from "node:http";
import { readFile } from "node:fs/promises";
import { readState, writeState, readPhotoMeta, readPhotoOne, writePhoto, deletePhoto, readMatches, writeMatch, deleteMatch, clearMatches } from "./lib/state.js";
import { isAdmin, checkPassword } from "./lib/auth.js";
import { pollAction } from "./lib/poll.js";

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

    if (url.pathname === "/api/login") {
      if (req.method === "POST") {
        const body = JSON.parse((await readBody(req)) || "{}");
        const ok = checkPassword(body.password);
        res.writeHead(ok ? 200 : 401, { "Content-Type": "application/json; charset=utf-8" });
        return res.end(JSON.stringify({ ok }));
      }
      res.writeHead(405);
      return res.end();
    }

    if (url.pathname === "/api/poll") {
      const body = req.method === "POST" ? JSON.parse((await readBody(req)) || "{}") : null;
      const result = await pollAction(req.method, body, isAdmin(req));
      res.writeHead(result.status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
      return res.end(JSON.stringify(result.body));
    }

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
        if (!isAdmin(req)) {
          res.writeHead(403, { "Content-Type": "application/json; charset=utf-8" });
          return res.end(JSON.stringify({ error: "sem permissão para editar" }));
        }
        const parsed = JSON.parse((await readBody(req)) || "{}");
        const result = await writeState(parsed);
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        return res.end(JSON.stringify(result));
      }
      res.writeHead(405);
      return res.end();
    }

    if (url.pathname === "/api/matches") {
      if (req.method === "GET") {
        const matches = await readMatches();
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
        return res.end(JSON.stringify({ matches }));
      }
      if (req.method === "POST") {
        if (!isAdmin(req)) { res.writeHead(403, { "Content-Type": "application/json; charset=utf-8" }); return res.end(JSON.stringify({ error: "sem permissão para editar" })); }
        const body = JSON.parse((await readBody(req)) || "{}");
        let r = { ok: true };
        if (body.action === "add" && body.match) r = await writeMatch(body.match);
        else if (body.action === "delete" && body.id) await deleteMatch(body.id);
        else if (body.action === "clear") await clearMatches();
        else { res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" }); return res.end(JSON.stringify({ error: "ação inválida" })); }
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        return res.end(JSON.stringify(r));
      }
      res.writeHead(405);
      return res.end();
    }

    if (url.pathname === "/api/photo") {
      const id = url.searchParams.get("id");
      if (!id) { res.writeHead(400); return res.end("id obrigatório"); }
      const data = await readPhotoOne(id);
      if (!data) { res.writeHead(404); return res.end("sem foto"); }
      const m = /^data:([^;]+);base64,(.*)$/s.exec(data);
      if (!m) { res.writeHead(500); return res.end("formato inválido"); }
      res.writeHead(200, { "Content-Type": m[1], "Cache-Control": "public, max-age=31536000, immutable" });
      return res.end(Buffer.from(m[2], "base64"));
    }

    if (url.pathname === "/api/photos") {
      if (req.method === "GET") {
        const photos = await readPhotoMeta();
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        });
        return res.end(JSON.stringify({ photos }));
      }
      if (req.method === "POST" || req.method === "PUT") {
        if (!isAdmin(req)) {
          res.writeHead(403, { "Content-Type": "application/json; charset=utf-8" });
          return res.end(JSON.stringify({ error: "sem permissão para editar" }));
        }
        const body = JSON.parse((await readBody(req)) || "{}");
        if (!body.playerId) {
          res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
          return res.end(JSON.stringify({ error: "playerId obrigatório" }));
        }
        if (body.data == null || body.data === "") await deletePhoto(body.playerId);
        else await writePhoto(body.playerId, body.data);
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        return res.end(JSON.stringify({ ok: true }));
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
