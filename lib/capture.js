// Canal de captura de lance, compartilhado entre Vercel e servidor local.
//
// Nenhum vídeo passa por aqui. O celular-câmera grava num buffer circular na
// própria memória e só precisa saber "pediram um lance?". Como a captura é
// retroativa (salva o que JÁ passou), alguns segundos de atraso no aviso não
// perdem o lance — por isso polling simples resolve, sem WebRTC/WebSocket.
//
// GET                      → { req, ts, camSeen } (público; a câmera consulta)
// POST { action:"shot"  }  → editor pede um lance (novo req)
// POST { action:"alive" }  → câmera avisa que está viva (batimento)
import { readCapture, writeCapture } from "./state.js";

export async function captureAction(method, body, admin) {
  if (method === "GET") {
    return { status: 200, body: await readCapture() };
  }

  if (method === "POST") {
    const action = body && body.action;
    const cur = await readCapture();

    // Batimento da câmera: aberto, para o app saber que ela está de pé.
    if (action === "alive") {
      await writeCapture({ ...cur, camSeen: Date.now() });
      return { status: 200, body: { ok: true } };
    }

    // Pedido de lance: só o editor.
    if (action === "shot") {
      if (!admin) return { status: 403, body: { error: "sem permissão para gravar" } };
      const req = String(Date.now()) + Math.random().toString(36).slice(2, 7);
      await writeCapture({ ...cur, req, ts: Date.now() });
      return { status: 200, body: { ok: true, req } };
    }

    return { status: 400, body: { error: "ação inválida" } };
  }

  return { status: 405, body: { error: "método não suportado" } };
}
