# app (team's own chat app, early MVP)

First cut of the team's own chat app (D-08: Python/FastAPI backend, React frontend), replacing
`../demo-app/` in a later stage. This version intentionally has **no authentication**: a username
is just free text the frontend remembers, there is no password, no session. Channels and messages
are stored in PostgreSQL (D-08), matching `../demo-app/`; the goal here is only a working 1:1
send/receive loop to build on, not a secure app yet (no encryption, no auth).

- `backend/`: FastAPI, PostgreSQL storage via SQLAlchemy, REST endpoints plus a WebSocket for live
  delivery. WebSocket connections themselves stay in-memory (process-local, nothing to persist).
- `frontend/`: React + TypeScript + Vite, using [chatcn](https://github.com/leonickson1/chatcn)
  (MIT, copied into `frontend/src/components/ui/chat/`, not an npm dependency) for the chat UI.
  Unused chatcn features (reactions, replies, edit/delete, pin, attachments, header call/search,
  sidebar search/new-conversation) are switched off via feature-flag props rather than deleted,
  since the components aren't wired to a backend for them yet.

## Ports

| What | Port | Notes |
|---|---|---|
| Backend (uvicorn, REST + WebSocket) | 8123 | Set in `backend/Dockerfile`'s `ENTRYPOINT` and the `uvicorn` command below. `frontend/.env`'s `VITE_API_BASE_URL` must point here. |
| Frontend (Vite dev server) | 5173 | Vite's own default, not set explicitly in `vite.config.ts`. Printed by `npm run dev` on start; use that URL, not an assumed one, since Vite picks the next free port if 5173 is taken. |
| PostgreSQL (dev) | 5432 | `docker run ... -p 5432:5432` below. `DATABASE_URL` in `backend/app/db.py` defaults to this port. |
| PostgreSQL (backend tests) | 5432 | `backend/docker-compose.test.yml`. Same port as the dev database above: stop the dev container first, or the test one will fail to bind. See "Running the tests". |

## Running locally

Database (one off, keeps running in the background):

```bash
docker run -d --name chat-db -p 5432:5432 \
  -e POSTGRES_DB=chat -e POSTGRES_USER=chat -e POSTGRES_PASSWORD=chat \
  postgres:17
```

Backend:

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload --port 8123
```

`DATABASE_URL` defaults to `postgresql+psycopg://chat:chat@localhost:5432/chat`, matching the
`docker run` command above. Override it if your local Postgres differs. Tables are created
automatically on startup (`init_db()` in `app/db.py`); there is no migration tool yet since the
schema is still changing freely at this stage.

Frontend:

```bash
cd frontend
npm install
cp .env.example .env   # VITE_API_BASE_URL defaults to http://localhost:8123
npm run dev
```

Open the URL Vite prints (defaults to `http://localhost:5173`, see Ports above). Enter a
username, then a target username, and send messages between two browser tabs (or two machines on
the same network, pointing `VITE_API_BASE_URL` and Vite's `--host` at a shared IP).

## Running the tests

Backend (pytest, against a real PostgreSQL, not mocked):

```bash
cd backend
docker compose -f docker-compose.test.yml up -d   # throwaway Postgres on 5432
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
.venv/bin/pytest
docker compose -f docker-compose.test.yml down -v  # when done
```

`docker-compose.test.yml` binds Postgres to the same port (5432) as the "Running locally" database
above. Stop the dev `chat-db` container first (`docker stop chat-db`) if both would run at once, or
point one of them at a different host port.

Frontend (Vitest + React Testing Library):

```bash
cd frontend
npm install
npm test          # one-off run (vitest run)
npx vitest        # watch mode
npm run lint      # oxlint
npm run build     # tsc -b && vite build, also catches type errors tests don't
```

## Notes

- `frontend/package.json` pins `braces` to an unmerged upstream commit
  (`github:micromatch/braces#28d440b5d...`) via `overrides`, fixing a stack-exhaustion DoS
  (GHSA-vfj7-8cjw-p6xm) in a transitive dev-only dependency (`shadcn` CLI → `fast-glob` →
  `micromatch`) that has no patched release yet. Verified locally: the patched commit's own test
  suite passes (904/904) and the known PoC payload is rejected before and after the override.
  Revert to a normal `braces` version once upstream ships a real fix.
