// Núcleo de acesso ao banco de dados (SQLite via @libsql/client).
// Funciona em dois modos, escolhidos pelas variáveis de ambiente:
//   - Local:  sem env → usa o arquivo "file:quadra.db" no disco.
//   - Vercel: com TURSO_DATABASE_URL (+ TURSO_AUTH_TOKEN) → usa o Turso na nuvem.
// Toda a aplicação é guardada como um único registro JSON na tabela app_state.
// É SQLite de verdade: dá para baixar o arquivo .db do Turso e abrir em qualquer
// ferramenta SQLite quando quiser um backup.

import { createClient } from "@libsql/client";

const STATE_ID = "quadra";

let client = null;
let initialized = false;

function getClient() {
  if (client) return client;
  const url = process.env.TURSO_DATABASE_URL || "file:quadra.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;
  client = createClient(authToken ? { url, authToken } : { url });
  return client;
}

async function init() {
  if (initialized) return;
  const db = getClient();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS app_state (
      id         TEXT PRIMARY KEY,
      data       TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  // Fotos dos jogadores em tabela própria (base64/data URI). Ficam fora do
  // JSON do estado para não incharem o documento principal.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS player_photos (
      player_id  TEXT PRIMARY KEY,
      data       TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  // Enquete de habilidades (votação anônima). Uma rodada por vez.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS poll (
      id         TEXT PRIMARY KEY,
      data       TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  // Histórico de partidas em tabela própria (fora do JSON do estado, que crescia demais).
  await db.execute(`
    CREATE TABLE IF NOT EXISTS matches (
      id    TEXT PRIMARY KEY,
      date  TEXT NOT NULL,
      data  TEXT NOT NULL
    )
  `);
  // Sinal de captura de lance (uma linha só). O celular-câmera lê "req" de tempos
  // em tempos; quando o valor muda, ele salva o buffer dos últimos segundos.
  // Nenhum vídeo passa por aqui — só o aviso de "salva agora".
  await db.execute(`
    CREATE TABLE IF NOT EXISTS capture (
      id         TEXT PRIMARY KEY,
      data       TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  initialized = true;
}

// Lê o estado salvo. Retorna o objeto do app ou null se ainda não houver nada.
export async function readState() {
  await init();
  const db = getClient();
  const rs = await db.execute({
    sql: "SELECT data FROM app_state WHERE id = ?",
    args: [STATE_ID],
  });
  if (!rs.rows.length) return null;
  try {
    return JSON.parse(rs.rows[0].data);
  } catch {
    return null;
  }
}

// Salva (insere ou atualiza) o estado do app.
export async function writeState(data) {
  await init();
  const db = getClient();
  const json = JSON.stringify(data);
  const updatedAt =
    (data && typeof data.updatedAt === "string" && data.updatedAt) ||
    new Date().toISOString();
  await db.execute({
    sql: `
      INSERT INTO app_state (id, data, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        data = excluded.data,
        updated_at = excluded.updated_at
    `,
    args: [STATE_ID, json, updatedAt],
  });
  return { ok: true, updatedAt };
}

// ---------- Fotos dos jogadores ----------

// Lê todas as fotos como um mapa { playerId: dataUri }. (uso legado)
export async function readPhotos() {
  await init();
  const db = getClient();
  const rs = await db.execute("SELECT player_id, data FROM player_photos");
  const out = {};
  for (const row of rs.rows) out[row.player_id] = row.data;
  return out;
}

// Meta leve: { playerId: updated_at } — diz QUEM tem foto (para cache-busting).
export async function readPhotoMeta() {
  await init();
  const db = getClient();
  const rs = await db.execute("SELECT player_id, updated_at FROM player_photos");
  const out = {};
  for (const row of rs.rows) out[row.player_id] = row.updated_at;
  return out;
}

// Lê a foto (data URI) de um jogador, ou null.
export async function readPhotoOne(playerId) {
  await init();
  const db = getClient();
  const rs = await db.execute({
    sql: "SELECT data FROM player_photos WHERE player_id = ?",
    args: [playerId],
  });
  return rs.rows.length ? rs.rows[0].data : null;
}

// Salva (insere ou atualiza) a foto de um jogador.
export async function writePhoto(playerId, data) {
  await init();
  const db = getClient();
  await db.execute({
    sql: `
      INSERT INTO player_photos (player_id, data, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(player_id) DO UPDATE SET
        data = excluded.data,
        updated_at = excluded.updated_at
    `,
    args: [playerId, data, new Date().toISOString()],
  });
  return { ok: true };
}

// Remove a foto de um jogador.
export async function deletePhoto(playerId) {
  await init();
  const db = getClient();
  await db.execute({
    sql: "DELETE FROM player_photos WHERE player_id = ?",
    args: [playerId],
  });
  return { ok: true };
}

// ---------- Enquete (poll) ----------
const POLL_ID = "current";

export async function readPoll() {
  await init();
  const db = getClient();
  const rs = await db.execute({
    sql: "SELECT data FROM poll WHERE id = ?",
    args: [POLL_ID],
  });
  if (!rs.rows.length) return null;
  try { return JSON.parse(rs.rows[0].data); } catch { return null; }
}

export async function writePoll(data) {
  await init();
  const db = getClient();
  await db.execute({
    sql: `
      INSERT INTO poll (id, data, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        data = excluded.data,
        updated_at = excluded.updated_at
    `,
    args: [POLL_ID, JSON.stringify(data), new Date().toISOString()],
  });
  return { ok: true };
}

// ---------- Histórico de partidas ----------
export async function readMatches() {
  await init();
  const db = getClient();
  const rs = await db.execute("SELECT data FROM matches ORDER BY date DESC");
  const out = [];
  for (const row of rs.rows) { try { out.push(JSON.parse(row.data)); } catch {} }
  return out;
}

export async function writeMatch(match) {
  await init();
  const db = getClient();
  const id = String(match.id || Date.now());
  const date = String(match.date || new Date().toISOString());
  await db.execute({
    sql: `
      INSERT INTO matches (id, date, data) VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET date = excluded.date, data = excluded.data
    `,
    args: [id, date, JSON.stringify(match)],
  });
  return { ok: true, id };
}

export async function deleteMatch(id) {
  await init();
  const db = getClient();
  await db.execute({ sql: "DELETE FROM matches WHERE id = ?", args: [String(id)] });
  return { ok: true };
}

export async function clearMatches() {
  await init();
  const db = getClient();
  await db.execute("DELETE FROM matches");
  return { ok: true };
}

// ---------- Sinal de captura de lance ----------
// Uma linha só: { req, ts, camSeen }. "req" muda a cada pedido do editor.
const CAPTURE_ID = "capture";

export async function readCapture() {
  await init();
  const db = getClient();
  const rs = await db.execute({
    sql: "SELECT data FROM capture WHERE id = ?",
    args: [CAPTURE_ID],
  });
  if (!rs.rows.length) return { req: null, ts: 0, camSeen: 0 };
  try { return JSON.parse(rs.rows[0].data); } catch { return { req: null, ts: 0, camSeen: 0 }; }
}

export async function writeCapture(data) {
  await init();
  const db = getClient();
  await db.execute({
    sql: `
      INSERT INTO capture (id, data, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        data = excluded.data,
        updated_at = excluded.updated_at
    `,
    args: [CAPTURE_ID, JSON.stringify(data), new Date().toISOString()],
  });
  return { ok: true };
}
