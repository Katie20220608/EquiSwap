# EquiSwap Codebase

## Current implementation status

- Backend scaffold is implemented in `backend/app`.
- SQL schema aligned with ERD is in `backend/database_create.sql`.
- Initial backend tests are in `backend/tests`.
- Frontend folder exists but is not implemented yet.

## Backend quick links

- Setup and run guide: `backend/README.md`
- FastAPI app entry: `backend/app/main.py`
- SQL schema: `backend/database_create.sql`
- Initial tests: `backend/tests/test_crud.py`

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
