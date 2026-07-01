# ⚽ Quadra — Gerenciador de Futsal

App para sortear times equilibrados, cronometrar a partida, marcar gols, ver
artilharia e histórico. Os dados são salvos em um **banco de dados SQLite**
(`.db`) — localmente em arquivo, ou na nuvem com **Turso/libSQL** (para o Vercel).

## Como funciona a persistência

- O app é **offline-first**: toda mudança grava na hora no navegador
  (`localStorage`) e é enviada em segundo plano para o banco via `/api/state`.
- A bolinha ao lado do título mostra o status:
  🟢 salvo no banco · 🟡 salvando · 🟠 offline (salvo só no navegador).
  Toque nela para forçar a sincronização.

---

## 1) Rodar localmente (arquivo `quadra.db` no seu PC)

```bash
npm install
npm start
```

Abra **http://localhost:3000**. Um arquivo `quadra.db` (SQLite real) é criado
na pasta e guarda tudo. Dá para abri-lo em qualquer ferramenta SQLite.

---

## 2) Publicar no Vercel (com banco Turso na nuvem)

O Vercel é *serverless* e **não persiste arquivos gravados em disco**, então
usamos o Turso — que é SQLite de verdade, rodando na nuvem.

### a) Criar o banco no Turso (grátis)

1. Crie a conta em https://turso.tech e instale a CLI (ou use o painel web).
2. Crie um banco e pegue os dois valores:
   - **URL** (começa com `libsql://...`)
   - **Token** de autenticação

   Pela CLI:
   ```bash
   turso db create quadra
   turso db show quadra --url          # copie a URL
   turso db tokens create quadra       # copie o token
   ```

### b) Configurar no Vercel

No projeto do Vercel → **Settings → Environment Variables**, adicione:

| Nome                  | Valor                          |
| --------------------- | ------------------------------ |
| `TURSO_DATABASE_URL`  | a URL `libsql://...`           |
| `TURSO_AUTH_TOKEN`    | o token gerado                 |

### c) Deploy

```bash
npm i -g vercel
vercel        # segue o assistente
vercel --prod
```

Pronto — o app abre na URL do Vercel e salva tudo no Turso, acessível de
qualquer celular.

> **Testar o Turso localmente:** copie `.env.example` para `.env`, preencha as
> duas variáveis e rode `npm start`. Sem `.env`, ele usa o `quadra.db` local.

---

## Backup

Os dados ficam num único registro JSON dentro do SQLite. Para backup:
- **Local:** copie o arquivo `quadra.db`.
- **Turso:** `turso db shell quadra` ou baixe o dump pela CLI/painel.

## Estrutura

```
quadra-futsal.html   App (frontend) — sincroniza via /api/state
api/state.js         Função serverless do Vercel (GET carrega, POST salva)
server.js            Servidor local para desenvolvimento (mesma rota /api/state)
lib/state.js         Acesso ao banco SQLite (arquivo local ou Turso)
vercel.json          Faz "/" abrir o app
```
