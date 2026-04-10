# Unified College Connect & Career Acceleration Ecosystem

Full-stack monorepo with:
- `backend/`: Node.js + Express + Prisma + SQLite dev DB + Socket.IO + JWT auth
- `frontend/`: React + TailwindCSS + React Query + Zustand + modular UI components
- Dockerized setup for backend and frontend

## Implemented Modules

### 1) Authentication & Roles
- Email signup/login (`/auth/register`, `/auth/login`)
- JWT auth middleware
- Roles: `STUDENT`, `ALUMNI`, `FACULTY`, `ADMIN`
- Admin alumni verification (`/admin/verify-alumni`)
- Cloudinary uploads for profile/event/post images

### 2) User Profile System
- Profile fields: name, role, department, batch, year, skills, bio, social links
- `isVerifiedAlumni` badge support
- mentorship availability toggle
- profile update endpoint: `PUT /users/me`

### 3) Alumni Directory
- `GET /alumni` with filters + pagination
- `GET /alumni/:id` public alumni profile
- `PUT /alumni/:id` alumni/admin updates

### 4) Mentorship + Chat
- Mentorship requests: `POST /mentorship/request`
- Mentor request view: `GET /mentorship/:mentorId`
- Approvals create chat room: `POST /mentorship/:requestId/approve`
- 1-on-1 real-time chat via Socket.IO + persisted message history

### 5) Posts & Announcement Feed
- Create post: `POST /posts` (role constrained)
- Feed list: `GET /posts` (paginated)
- Like/comment: `POST /posts/:id/like`, `POST /posts/:id/comment`

### 6) Events & Registrations
- Create/list events: `POST /events`, `GET /events`
- Student registration: `POST /events/:eventId/register`
- SMTP notification trigger on new events
- QR attendance scaffolded in schema (`qrAttendanceOn`)

### 7) AI Tools
- Resume Analyzer: `POST /ai/resume-analyzer` (PDF/DOCX parsing + heuristics; optional **Ollama** or **OpenAI** when `OLLAMA_BASE_URL` or `OPENAI_API_KEY` is set)
- Skill Matcher: `POST /ai/skill-matcher` (mentor matching by skill overlap)

### 8) Admin Operations (Phase 2)
- Admin stats: `GET /admin/stats`
- Admin users list: `GET /admin/users`
- Alumni verification: `PUT /admin/verify-alumni`
- User moderation: `DELETE /admin/remove-user`
- Audit logs: `GET /admin/audit-logs`
- Audit logs CSV export: `GET /admin/audit-logs/export`
- Audit logs support filters: `action`, `actorEmail`, `from`, `to`, `preset`
- Audit logs endpoint supports server-side pagination: `page`, `limit`
- Audit logs endpoint supports sorting: `sortBy` (`createdAt`, `actorEmail`, `action`, `targetRole`) + `sortOrder` (`asc`, `desc`)
- Date range presets available in admin UI: `today`, `7d`, `30d`, `custom`
- Admin UI supports direct page jump and sortable audit table columns
- Admin UI supports saved filter presets (stored locally) and one-click apply/delete
- Admin audit text filters are debounced to reduce API call frequency
- Admin UI supports column visibility toggles for the audit table
- Admin UI includes table layout + action confirmation modals

## Tech Stack

### Backend
- Node.js, Express, Prisma ORM, SQLite (dev)
- PostgreSQL-ready alternate schema: `backend/prisma/schema.postgres.prisma`
- JWT, Zod validation, Socket.IO, Cloudinary, Nodemailer (SMTP)

### Frontend
- React (Vite + TypeScript)
- TailwindCSS
- shadcn-style UI setup (`components.json` + reusable components)
- React Query
- Zustand
- Router-based pages with role-based dashboard UX

## Run Locally

### 1) Backend
```bash
cd backend
cp .env.example .env
npx prisma generate
npx prisma db push
npm run seed
npm run dev
```

Backend runs on `http://localhost:5000`

### 2) Frontend
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`

### Release readiness helpers

- Reset and reseed database:
  - `npm run backend:reset:seed`
- Backend smoke test (requires backend running + seed users):
  - `npm run backend:smoke`
- Backend enforces startup env validation via `backend/src/config/env.js`

## PostgreSQL Production Switch

For production, use the PostgreSQL schema and setup script:

```bash
cd backend
cp .env.production.example .env
# set DATABASE_URL to your postgres connection string
npm run db:postgres:setup-prod
```

Available helper commands:
- `npm run db:postgres:generate`
- `npm run db:postgres:push`

## Demo Seed Users
- Admin: `admin@college.edu / Password@123`
- Faculty: `faculty@college.edu / Password@123`
- Alumni: `alumni@college.edu / Password@123`
- Student: `student@college.edu / Password@123`

## Docker

**Development (SQLite, hot paths may be mounted):**

```bash
docker compose up --build
```

- Frontend: `http://localhost:5173` (or port mapped in compose)
- Backend: `http://localhost:5000`

**Production (PostgreSQL + strict env):** see **[DEPLOYMENT.md](./DEPLOYMENT.md)** and `docker-compose.prod.yml`.

## Main Frontend Routes
- `/login`
- `/register`
- `/dashboard`
- `/feed`
- `/alumni`
- `/profile`
- `/mentorship`
- `/events`
- `/ai-tools`
- `/admin` (admin-only)
