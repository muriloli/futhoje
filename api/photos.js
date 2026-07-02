// Função serverless do Vercel para as fotos dos jogadores.
// GET  /api/photos            → { photos: { [playerId]: dataUri } }
// POST /api/photos            → body { playerId, data }  (data=null remove)
import { readPhotos, writePhoto, deletePhoto } from "../lib/state.js";
import { isAdmin } from "../lib/auth.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const photos = await readPhotos();
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ photos });
    }

    if (req.method === "POST" || req.method === "PUT") {
      if (!isAdmin(req)) return res.status(403).json({ error: "sem permissão para editar" });
      const body =
        typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body;
      const playerId = body && body.playerId;
      const data = body && body.data;
      if (!playerId) return res.status(400).json({ error: "playerId obrigatório" });

      if (data == null || data === "") {
        await deletePhoto(playerId);
        return res.status(200).json({ ok: true, deleted: true });
      }
      if (typeof data !== "string" || data.length > 900000) {
        return res.status(400).json({ error: "imagem inválida ou muito grande" });
      }
      await writePhoto(playerId, data);
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "método não permitido" });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
}
