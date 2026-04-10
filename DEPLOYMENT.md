# Production deployment

This app is **production-ready** when you configure environment variables and (for uploads/email/AI) external services.

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

## Database: PostgreSQL (recommended for production)

1. Copy `backend/.env.production.example` and set `DATABASE_URL` to your Postgres URL.
2. From `backend/`:

```bash
npm run db:postgres:generate
npm run db:postgres:setup-prod
```

`setup-postgres-prod` runs `prisma db push` against `schema.postgres.prisma` (migrations can be added later with `prisma migrate dev`).

3. Seed or create users as needed (`npm run seed` only matches your **SQLite** dev flow; for Postgres use a script or admin UI).

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
