// Autenticação simples por senha de editor (admin).
// A senha fica na variável de ambiente ADMIN_PASSWORD (nunca no código do cliente).
// Leitura (GET) é livre; gravação (POST/PUT) exige o header x-admin-password correto.

export function checkPassword(pw) {
  const secret = process.env.ADMIN_PASSWORD;
  return !!secret && typeof pw === "string" && pw === secret;
}

export function isAdmin(req) {
  const provided = req.headers && req.headers["x-admin-password"];
  return checkPassword(provided);
}
