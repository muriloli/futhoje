// Endpoint da enquete de habilidades.
// GET  → status público (rodada aberta? quantos votaram)
// POST → { action: "vote" } aberto | "open"/"close"/"results" exigem senha de editor
import { pollAction } from "../lib/poll.js";
import { isAdmin } from "../lib/auth.js";

export default async function handler(req, res) {
  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body;
    const result = await pollAction(req.method, body, isAdmin(req));
    if (req.method === "GET") res.setHeader("Cache-Control", "no-store");
    return res.status(result.status).json(result.body);
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
}
