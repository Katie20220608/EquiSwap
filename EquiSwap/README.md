# EquiSwap Codebase

EquiSwap is a family-focused platform for swapping children's toys, books, and learning resources through wishlist-driven, multi-user swap cycles.

## Current implementation status

- Backend (FastAPI, SQLAlchemy) is implemented in `backend/app`: authentication, items, wishlists, cycle detection (Tarjan SCC), swap proposals, trust scores, notifications, group chat, preferences, and admin endpoints.
- SQL schema aligned with the ERD is in `backend/database_create.sql`; migration scripts for existing databases are in `backend/database_migrate_*.sql`.
- Frontend (React, Vite, TypeScript) is implemented in `frontend/src`.
- Backend tests are in `backend/tests`; frontend unit tests sit beside the source files.
- Playwright E2E tests are in `frontend/e2e` (run with `frontend/scripts/run-e2e.sh`; see `frontend/README.MD`).
- CI and deployment are defined in `../.github/workflows/deploy-to-render.yml` (backend on Render, frontend on Vercel).

## Quick links

- Backend setup, API workflow, and deployment: `backend/README.md`
- Frontend setup, tests, and deployment: `frontend/README.MD`
- FastAPI app entry: `backend/app/main.py`
- SQL schema: `backend/database_create.sql`
- Architecture and ERD diagrams: `../Deliverables/README.md`

## Start API

Run from project root:

```bash
cd EquiSwap/backend
uvicorn app.main:app --reload
```

Health check in browser:

- http://127.0.0.1:8000/health

API docs:

- http://127.0.0.1:8000/docs

## Start frontend

In a second terminal, with the API running:

```bash
cd EquiSwap/frontend
npm install
npm run dev
```

Open http://localhost:5173.

## Run tests

```bash
cd EquiSwap/backend && pytest -q
cd EquiSwap/frontend && npm test
```
