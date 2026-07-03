// Serve a foto de UM jogador como imagem (com cache do navegador).
// GET /api/photo?id=<playerId>  → bytes da imagem (png/jpeg)
import { readPhotoOne } from "../lib/state.js";

export default async function handler(req, res) {
  try {
    const id = req.query && req.query.id;
    if (!id) return res.status(400).json({ error: "id obrigatório" });
    const data = await readPhotoOne(String(id));
    if (!data) return res.status(404).json({ error: "sem foto" });
    const m = /^data:([^;]+);base64,(.*)$/s.exec(data);
    if (!m) return res.status(500).json({ error: "formato inválido" });
    const buf = Buffer.from(m[2], "base64");
    res.setHeader("Content-Type", m[1]);
    // versionado pela query ?v=; pode cachear forte
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return res.status(200).send(buf);
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
}
