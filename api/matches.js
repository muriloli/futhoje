// Histórico de partidas (tabela própria).
// GET  → { matches: [...] } (público, leitura)
// POST → { action:"add", match } | { action:"delete", id } | { action:"clear" }  (exige senha)
import { readMatches, writeMatch, deleteMatch, clearMatches } from "../lib/state.js";
import { isAdmin } from "../lib/auth.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const matches = await readMatches();
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ matches });
    }
    if (req.method === "POST") {
      if (!isAdmin(req)) return res.status(403).json({ error: "sem permissão para editar" });
      const body =
        typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body;
      const action = body && body.action;
      if (action === "add") {
        if (!body.match || typeof body.match !== "object")
          return res.status(400).json({ error: "match inválido" });
        const r = await writeMatch(body.match);
        return res.status(200).json(r);
      }
      if (action === "delete") {
        if (!body.id) return res.status(400).json({ error: "id obrigatório" });
        await deleteMatch(body.id);
        return res.status(200).json({ ok: true });
      }
      if (action === "clear") {
        await clearMatches();
        return res.status(200).json({ ok: true });
      }
      return res.status(400).json({ error: "ação desconhecida" });
    }
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "método não permitido" });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
}
