# Production deployment

This app is **production-ready** when you configure environment variables and (for uploads/email/AI) external services.

## Deployment checklist (do these in order)

1. **PostgreSQL** — Create a database (Neon, RDS, Docker on a VPS, etc.) and obtain a **`DATABASE_URL`** with `?schema=public` (and `sslmode=require` for managed hosts).
2. **Apply schema** — From `backend/` with `DATABASE_URL` set: `node scripts/setup-postgres-prod.js` (or `npm run db:postgres:setup-prod`). If Neon’s sample table blocks the push, run once with `PRISMA_ACCEPT_DATA_LOSS=1` (see **Database: PostgreSQL (Neon or other managed)** below).
3. **Backend secrets** — On the API host, set **`NODE_ENV=production`**, **`JWT_SECRET`**, **`CLIENT_URL`** (exact frontend origins), and **`DATABASE_URL`**. Optional: Cloudinary, SMTP, OpenAI/Ollama.
4. **Deploy the API** — Start with `node src/server.js` (or your Docker image). Confirm **`GET /health`** on the public API URL.
5. **Frontend build** — Build with **`VITE_API_URL`** equal to that **public API base URL** (no trailing slash), e.g. `VITE_API_URL=https://api.yourapp.com npm run build` in `frontend/`.
6. **Deploy static files** — Serve `frontend/dist` behind HTTPS (Vercel, Netlify, S3+CloudFront, nginx, etc.).
7. **Smoke-test** — Log in, open chat; real-time features need **WebSocket** support to the API (see [Socket.IO](#socketio-and-reverse-proxies)).

## What is “real” vs optional

| Feature | Required for production | Configure |
|--------|-------------------------|-----------|
| Auth, REST API, DB, chat history | Yes | `DATABASE_URL`, `JWT_SECRET`, `CLIENT_URL` |
| Real-time chat (Socket.IO) | Yes | Same as API — browser must reach API URL; `CLIENT_URL` must list your frontend origin |
| Profile / post / event **images** | For uploads | [Cloudinary](https://cloudinary.com): `CLOUDINARY_*` |
| Event notification **email** | Optional | SMTP: `SMTP_*` |
| **LLM** (resume tips, AI chat, etc.) | Optional | **`OLLAMA_BASE_URL`** + **`OLLAMA_MODEL`** (local Ollama), or **`OPENAI_API_KEY`** + **`OPENAI_MODEL`** — Ollama is used first when `OLLAMA_BASE_URL` is set |

Without Cloudinary, image uploads return **503** with a clear message until you add keys.

## Environment variables

### Backend (`backend/.env` or host secrets)

- **`NODE_ENV`**: `production`
- **`PORT`**: e.g. `5000`
- **`CLIENT_URL`**: **Required in production.** Comma-separated allowed browser origins, e.g. `https://yourapp.com,https://www.yourapp.com`. Used for **CORS** and **Socket.IO**.
- **`JWT_SECRET`**: long random string (≥10 characters)
- **`JWT_EXPIRES_IN`**: e.g. `7d`
- **`DATABASE_URL`**: PostgreSQL connection string in production (see below)

Optional:

- **`CLOUDINARY_CLOUD_NAME`**, **`CLOUDINARY_API_KEY`**, **`CLOUDINARY_API_SECRET`**
- **`SMTP_HOST`**, **`SMTP_PORT`**, **`SMTP_SECURE`**, **`SMTP_USER`**, **`SMTP_PASS`**, **`SMTP_FROM`**
- **`OLLAMA_BASE_URL`** — e.g. `http://127.0.0.1:11434` (local) or `http://ollama:11434` (same Docker network as the API)
- **`OLLAMA_MODEL`** — e.g. `llama3.2` (run `ollama pull <name>` on that host)
- **`OPENAI_API_KEY`**, **`OPENAI_MODEL`** — used when **`OLLAMA_BASE_URL`** is **not** set (there is no automatic fallback from Ollama to OpenAI if the local server fails)

### Frontend (build-time)

Vite bakes the API URL into the static bundle:

- **`VITE_API_URL`**: Public base URL of the API (no trailing slash), e.g. `https://api.yourapp.com`

Set it when building:

```bash
cd frontend
VITE_API_URL=https://api.yourapp.com npm run build
```

Docker: the `frontend/Dockerfile` accepts `ARG VITE_API_URL` (see `docker-compose.prod.yml`).

## Local LLM (Ollama)

1. Install [Ollama](https://ollama.com) on the machine that runs the API (or use a reachable host on your network).
2. Pull a model: `ollama pull llama3.2` (or set **`OLLAMA_MODEL`** to another tag you pulled).
3. In **`backend/.env`**, set:
   - **`OLLAMA_BASE_URL=http://127.0.0.1:11434`**
   - **`OLLAMA_MODEL=llama3.2`** (optional; defaults to `llama3.2` in code if unset)
4. Restart the API. Resume analyzer and **`POST /ai/chat`** will call Ollama’s **`/api/chat`** endpoint.

**Docker:** you can run the official image `ollama/ollama` and map port **11434**, then point **`OLLAMA_BASE_URL`** at that container from the backend (e.g. `http://ollama:11434` on the same Docker network). Pull models inside the container: `docker exec -it <ollama-container> ollama pull llama3.2`.

**Production:** the API server must reach Ollama over HTTP; do not expose Ollama to the public internet without authentication — keep it on a private network or localhost behind your API.

## Database: PostgreSQL (Neon or other managed)

1. In Neon (or your provider), create a project and copy the **connection string**. Ensure Prisma can connect:
   - Append **`&schema=public`** if it is not already in the URL (Prisma expects the `public` schema).
   - Keep **`sslmode=require`** (Neon default).

2. Copy `backend/.env.production.example` to a **private** env file or paste variables into your host’s dashboard. Set **`DATABASE_URL`** to that string (never commit real URLs to git).

3. From `backend/` (or in CI with secrets):

```bash
npm run db:postgres:generate
npm run db:postgres:setup-prod
```

`setup-postgres-prod` loads `backend/.env` with override so it wins over a stray shell `DATABASE_URL`; on the server, set env vars in the platform UI instead.

If `db push` warns about dropping Neon’s sample **`playing_with_neon`** table, run **once**:

```bash
PRISMA_ACCEPT_DATA_LOSS=1 node scripts/setup-postgres-prod.js
```

4. **Seeding** — `npm run seed` is wired for the default **SQLite** dev schema path. For production Postgres, create users via registration or a one-off script; do not point production at a dev-only seed without reviewing it.

5. **Ongoing deploys** — After schema changes, run `db push` or migrations against production `DATABASE_URL` before or as part of release (see your host’s “release command” / CI).

## Database: PostgreSQL via Docker Compose (own VPS)

If you use **`docker-compose.prod.yml`** instead of Neon, Postgres is created by Compose; set **`POSTGRES_PASSWORD`** in `.env.prod`. You do **not** set `DATABASE_URL` in `.env.prod` for that file—the backend service injects it. See [Docker](#docker-production-compose) below.

## Split hosting (Neon + API + static site)

Typical layout:

| Piece | Where | What to configure |
|-------|--------|-------------------|
| DB | Neon | Connection string → **`DATABASE_URL`** on API only |
| API | Railway, Render, Fly.io, VPS, etc. | **`NODE_ENV`**, **`PORT`**, **`JWT_SECRET`**, **`CLIENT_URL`**, **`DATABASE_URL`**, start: `node src/server.js` |
| Frontend | Vercel, Netlify, nginx | Build arg **`VITE_API_URL`** = public API URL |

**Build frontend for production:**

```bash
cd frontend
VITE_API_URL=https://api.yourdomain.com npm run build
```

The API process must be reachable at exactly that origin for REST and Socket.IO.

## Socket.IO and reverse proxies

Chat uses **Socket.IO** (WebSockets with HTTP fallback). Your API host and any reverse proxy must allow **WebSocket upgrades** to the same public URL as `VITE_API_URL`. If chat fails only in production, check the platform’s WebSocket docs and that **`CLIENT_URL`** lists every frontend origin (including `www` and preview URLs if used).

## Docker (production compose)

Example file: **`docker-compose.prod.yml`** (Postgres + API + nginx frontend).

1. Create `.env.prod` in the repo root (or pass env). Minimum:

   - `CLIENT_URL` — frontend URL(s)
   - `JWT_SECRET`
   - `POSTGRES_PASSWORD`
   - `VITE_API_URL` — must be reachable from the **browser** (often `http://localhost:5000` only works locally; use your public API URL in real deploys)

2. Run:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up --build
```

Frontend mapped to **`${FRONTEND_PORT:-8080}`**, backend to **`${BACKEND_PORT:-5000}`**.

The production backend image builds Prisma with **`prisma/schema.postgres.prisma`**. Local/dev `docker compose` without the prod file still uses SQLite as before.

## Render.com (Blueprint)

The repo includes **`render.yaml`** with two services:

| Service | Purpose |
|--------|---------|
| **`ucc-api`** | Node API (`backend/`) — build runs Prisma generate + `db push` against **`DATABASE_URL`**. |
| **`ucc-web`** | Static SPA (`frontend/`) — **`VITE_API_URL`** must be set at **build** time. |

**Setup**

1. Push the repo to GitHub/GitLab/Bitbucket and open [Render](https://render.com) → **New** → **Blueprint** → connect the repo and select `render.yaml`.
2. When prompted, set **secret env vars**:
   - **API:** `DATABASE_URL` (Neon), `JWT_SECRET`, `CLIENT_URL` (comma-separated HTTPS origins of the **static site**, e.g. `https://ucc-web.onrender.com`).
   - Optional: Cloudinary, SMTP, OpenAI, etc.
3. Deploy **only the API** first (or deploy both, then fix the web service in step 5). Copy the API’s public URL (e.g. `https://ucc-api.onrender.com`).
4. In the **static site** service, set **`VITE_API_URL`** to that API URL (no trailing slash). **Clear build cache** and **redeploy** the static site so Vite embeds the correct API origin.
5. Update **`CLIENT_URL`** on the API if your frontend URL changed, and redeploy the API if needed.

**Notes**

- **Free** web services **spin down** after idle time; the first request can take ~1 minute, and **Socket.IO** connections drop until the service is awake—expected on the free tier.
- Neon must allow connections from Render (Neon’s default network settings usually work; if you use IP allowlists, add Render’s [outbound IPs](https://render.com/docs/outbound-ip-addresses) or allow the right ranges).
- Service names (`ucc-api`, `ucc-web`) must be unique in your Render account—rename them in `render.yaml` if there is a conflict.

## TLS and reverse proxy

Terminate HTTPS at your load balancer or nginx, then:

- Forward `https://api.example.com` → Node (port 5000)
- Serve the SPA from `https://app.example.com` with the **frontend build** using `VITE_API_URL=https://api.example.com`

Ensure **`CLIENT_URL`** includes `https://app.example.com`.

## Health check

`GET /health` → `{ "ok": true }` — use for load balancer health checks.

## Security checklist

- [ ] Strong `JWT_SECRET`, not committed to git
- [ ] `CLIENT_URL` matches real frontend origins only
- [ ] PostgreSQL credentials only in secrets / env
- [ ] Cloudinary and SMTP keys in secrets
- [ ] Enable HTTPS in production
