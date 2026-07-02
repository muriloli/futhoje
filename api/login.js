// Valida a senha de editor. POST { password } → 200 {ok:true} ou 401.
import { checkPassword } from "../lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "método não permitido" });
  }
  const body =
    typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body;
  if (checkPassword(body && body.password)) {
    return res.status(200).json({ ok: true });
  }
  return res.status(401).json({ ok: false, error: "senha incorreta" });
}
