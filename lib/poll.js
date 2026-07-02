// Lógica da enquete de habilidades, compartilhada entre Vercel e servidor local.
// Voto é aberto (só precisa de um código válido); abrir/fechar/resultados exigem admin.
import { readPoll, writePoll } from "./state.js";

export async function pollAction(method, body, admin) {
  if (method === "GET") {
    const poll = await readPoll();
    if (!poll || !poll.active) return { status: 200, body: { active: false } };
    const codes = poll.codes || {};
    const total = Object.keys(codes).length;
    const used = Object.values(codes).filter(Boolean).length;
    return { status: 200, body: { active: true, season: poll.season, total, used } };
  }

  if (method === "POST") {
    const action = body && body.action;

    // ---- Checa o código antes de votar (não consome) ----
    if (action === "check") {
      const poll = await readPoll();
      if (!poll || !poll.active) return { status: 200, body: { valid: false, reason: "closed" } };
      const code = String((body && body.code) || "").trim().toUpperCase();
      const codes = poll.codes || {};
      if (!(code in codes)) return { status: 200, body: { valid: false, reason: "invalid" } };
      if (codes[code]) return { status: 200, body: { valid: false, reason: "used" } };
      return { status: 200, body: { valid: true } };
    }

    // ---- Voto (aberto, protegido por código) ----
    if (action === "vote") {
      const poll = await readPoll();
      if (!poll || !poll.active) return { status: 409, body: { error: "Nenhuma votação aberta." } };
      const code = String((body && body.code) || "").trim().toUpperCase();
      const codes = poll.codes || {};
      if (!(code in codes)) return { status: 400, body: { error: "Código inválido." } };
      if (codes[code]) return { status: 409, body: { error: "Este código já foi usado." } };
      if (!body.ratings || typeof body.ratings !== "object")
        return { status: 400, body: { error: "Voto inválido." } };
      codes[code] = true;
      poll.codes = codes;
      poll.ballots = poll.ballots || [];
      poll.ballots.push({ ratings: body.ratings });   // sem vínculo com o código = anônimo
      await writePoll(poll);
      return { status: 200, body: { ok: true } };
    }

    // ---- Ações administrativas ----
    if (!admin) return { status: 403, body: { error: "sem permissão" } };

    if (action === "open") {
      const codes = {};
      (body.codes || []).forEach((c) => { codes[String(c).toUpperCase()] = false; });
      const poll = { active: true, season: body.season, createdAt: new Date().toISOString(), codes, ballots: [] };
      await writePoll(poll);
      return { status: 200, body: { ok: true } };
    }
    if (action === "close") {
      const poll = (await readPoll()) || {};
      poll.active = false;
      await writePoll(poll);
      return { status: 200, body: { ok: true } };
    }
    if (action === "results") {
      const poll = await readPoll();
      return { status: 200, body: { poll: poll || null } };
    }
    return { status: 400, body: { error: "ação desconhecida" } };
  }

  return { status: 405, body: { error: "método não permitido" } };
}
