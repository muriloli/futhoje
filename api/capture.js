// Endpoint do canal de captura de lance (só o aviso; vídeo nunca passa por aqui).
// GET  → { req, ts, camSeen } — a câmera consulta para saber se pediram um lance
// POST → { action: "shot" } exige senha de editor | "alive" é o batimento da câmera
import { captureAction } from "../lib/capture.js";
import { isAdmin } from "../lib/auth.js";

export default async function handler(req, res) {
  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body;
    const result = await captureAction(req.method, body, isAdmin(req));
    if (req.method === "GET") res.setHeader("Cache-Control", "no-store");
    return res.status(result.status).json(result.body);
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
}
