// Função serverless do Vercel: GET carrega o estado, POST salva.
// Rota pública: /api/state
import { readState, writeState } from "../lib/state.js";
import { isAdmin } from "../lib/auth.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const data = await readState();
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ data });
    }

    if (req.method === "POST" || req.method === "PUT") {
      if (!isAdmin(req)) return res.status(403).json({ error: "sem permissão para editar" });
      const body =
        typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body;
      if (!body || typeof body !== "object") {
        return res.status(400).json({ error: "corpo inválido" });
      }
      const result = await writeState(body);
      return res.status(200).json(result);
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "método não permitido" });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
}
