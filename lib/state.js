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
