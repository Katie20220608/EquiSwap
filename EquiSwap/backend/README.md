# EquiSwap Backend

This backend implements the core EquiSwap functionality for user authentication, item/wishlist management, graph-based cycle detection, and swap lifecycle handling.

## Current milestone status

The backend has progressed through the main implementation milestones and now includes:

- Task 1.4: FastAPI project with SQLAlchemy setup
- Task 1.5: JWT authentication (register, login, current user)
- Task 1.6: CRUD endpoints for users, items, and wishlists
- Task 1.7: Initial unit tests for CRUD flows
- Task 2.1: Tarjan's SCC algorithm (`TarjanSCC` class with `strongconnect()` method)
- Task 2.2: Swap graph builder — adjacency list from wishlist/item DB queries
- Task 2.3: `/swaps/find/{user_id}` endpoint — returns swap cycles involving a user
- Task 2.4: 16 pytest unit tests for Tarjan's algorithm across varied mock graphs
- Task 2.5: Swap proposal creation, acceptance/rejection, automatic execution, and history and validated with unit tests
- Task 3.1: User preferences (blacklist management) — block specific users from ever appearing in a proposed swap cycle

## Project structure

- `app/main.py`: FastAPI entry point and router registration
- `app/database.py`: SQLAlchemy engine and DB session dependency
- `app/models.py`: ORM models aligned with the SQL schema
- `app/auth.py`: Password hashing and JWT helpers
- `app/routers/auth.py`: Register/login/me endpoints
- `app/routers/users.py`: Users CRUD endpoints
- `app/routers/items.py`: Items CRUD endpoints
- `app/routers/wishlists.py`: Wishlists CRUD endpoints
- `app/routers/swaps.py`: Cycle discovery, proposal, response, execution, and history endpoints
- `app/routers/preferences.py`: Blacklist management endpoints (create/list/delete avoided users)
- `app/routers/notifications.py`: Notification list/read endpoints
- `app/tarjan.py`: Tarjan's SCC algorithm implementation
- `app/graph.py`: Builds swap graph adjacency list from DB
- `tests/test_crud.py`: CRUD integration-style unit test
- `tests/test_swaps.py`: Swap proposal, response, rejection, and execution tests
- `tests/test_tarjan.py`: 16 unit tests for Tarjan's algorithm
- `tests/test_preferences.py`: Blacklist CRUD tests and swap-cycle exclusion tests

## Install

```bash
cd EquiSwap/backend
pip install -r requirements.txt
```

## Run API

```bash
uvicorn app.main:app --reload
```

Open docs at:

- http://127.0.0.1:8000/docs

## Deploy on Render

Create a Render Web Service using `EquiSwap/backend` as the root directory:

- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Health check path: `/health`

Set these environment variables in Render:

```text
DATABASE_URL=<Render PostgreSQL Internal Database URL>
JWT_SECRET_KEY=<unique long random secret>
ALLOWED_ORIGINS=https://<your-vercel-domain>
```

The service creates missing tables on startup, but `create_all()` does not migrate
an existing database. Use a migration tool before changing the schema in a live
deployment. The repository SQL files are PostgreSQL setup/seed scripts and are
optional for a fresh deployment.

Uploaded images are stored on the service filesystem. Configure a Render
persistent disk mounted at `/var/data` and set `UPLOAD_DIR=/var/data/uploads`, or
move uploads to object storage before relying on them in production. Without
this, uploaded files can disappear when the service restarts or redeploys.

## Run tests

```bash
pytest -q
```

## Tarjan performance benchmark

The project includes a lightweight benchmark script for the SCC algorithm:

```bash
cd EquiSwap/backend
python3 benchmark_tarjan.py
```

This benchmark generates directed graphs for 10, 25, and 50 users and measures the runtime of `TarjanSCC.cycles()` across 20 runs per size.

Measured results (current implementation):

| Users | Runs | Average   | Median    | Min       | Max       |
| ----- | ---- | --------- | --------- | --------- | --------- |
| 10    | 20   | 0.0237 ms | 0.0219 ms | 0.0212 ms | 0.0498 ms |
| 25    | 20   | 0.0532 ms | 0.0510 ms | 0.0505 ms | 0.0699 ms |
| 50    | 20   | 0.0955 ms | 0.0953 ms | 0.0946 ms | 0.0996 ms |

These timings show the current algorithm remains extremely fast for the target graph sizes used in the swap cycle detection workflow.

## Run lint and format locally

From the backend directory:

```bash
cd EquiSwap/backend
ruff check .
ruff format .
```

If you want to automatically fix lint issues where possible:

```bash
ruff check . --fix
```

## Swap workflow

All swap endpoints require a bearer token. Use the **Authorize** button in Swagger at
`http://127.0.0.1:8000/docs`, or send the token in this header:

```text
Authorization: Bearer <access-token>
```

### 1. Create the wishlist cycle

Before proposing a cycle, each participant must wishlist an available item owned by
the next participant in the directed cycle. For example:

```text
User 9 wants an available item owned by User 8
User 8 wants an available item owned by User 7
User 7 wants an available item owned by User 9
```

Create each wishlist entry while authenticated as the relevant user:

```bash
curl -X POST http://127.0.0.1:8000/wishlists/ \
	-H "Authorization: Bearer <user-9-token>" \
	-H "Content-Type: application/json" \
	-d '{"item_id": <item-owned-by-user-8>}'
```

The item must have `status: "available"`. Check item ownership with:

```bash
curl http://127.0.0.1:8000/items/
```

### 2. Find a cycle

```bash
curl http://127.0.0.1:8000/swaps/find/9 \
	-H "Authorization: Bearer <user-9-token>"
```

The response contains the user IDs in one strongly connected component. The order
returned by Tarjan is not necessarily the edge-by-edge direction of the cycle.

### 3. Create proposals

Submit the user IDs from the detected cycle. The endpoint follows the actual
wishlist/item ownership edges, so the IDs do not need to be manually reordered:

```bash
curl -X POST http://127.0.0.1:8000/swaps/propose \
	-H "Authorization: Bearer <user-9-token>" \
	-H "Content-Type: application/json" \
	-d '{"user_ids": [9, 8, 7]}'
```

The response contains one pending proposal per transfer. All proposals share a
`cycle_id`; save this value for later verification. Items are changed to
`swap_pending`, and each participant receives a `swap_proposal` notification.

### 4. Accept or reject proposals

Only the `giver_id` on a proposal can respond to that proposal. Each giver must use
their own access token and the proposal's `sp_id`:

```bash
curl -X PATCH http://127.0.0.1:8000/swaps/<sp_id>/respond \
	-H "Authorization: Bearer <giver-token>" \
	-H "Content-Type: application/json" \
	-d '{"decision": "accepted"}'
```

To reject a proposal:

```bash
curl -X PATCH http://127.0.0.1:8000/swaps/<sp_id>/respond \
	-H "Authorization: Bearer <giver-token>" \
	-H "Content-Type: application/json" \
	-d '{"decision": "rejected", "rejection_reason": "Not available"}'
```

A rejection cancels the complete cycle, restores pending items to `available`,
increments the rejector's `rejection_count`, and writes a negative trust log.
Proposals expire after 24 hours; expiry is checked when a proposal is accessed.

### 5. Verify a completed cycle

When every proposal is accepted, execution happens automatically. The API transfers
item ownership, marks each item as `swapped`, writes `swap_history` records, adds
positive trust logs, and creates `swap_completed` notifications.

Inspect all proposals using the saved cycle UUID:

```bash
curl http://127.0.0.1:8000/swaps/cycles/<cycle-id> \
	-H "Authorization: Bearer <participant-token>"
```

Every proposal should have `status: "accepted"`. Inspect completed transfers for
the authenticated participant with:

```bash
curl http://127.0.0.1:8000/swaps/history \
	-H "Authorization: Bearer <participant-token>"
```

Finally, check `GET /items/` and confirm that the transferred items have their new
`owner_id` and `status: "swapped"`.

## Notification workflow

The backend also includes notification endpoints for swap events. When a cycle is created, participants receive a `swap_proposal` notification. When a swap is completed, they receive a `swap_completed` notification. If a proposal is rejected, the rejection reason is recorded and the related user notification is triggered.

Relevant endpoints include:

- `GET /notifications/`
- `GET /notifications/{notification_id}`
- `PATCH /notifications/{notification_id}/read`

These are used to track important user-facing inbox events for the swap lifecycle.

## Preferences (blacklist) workflow

Users can block other users so they are never matched with them in a swap cycle.
All endpoints require a bearer token for the acting user.

- `GET /users/directory` — minimal user list (`user_id` + `name` only, current user excluded) for populating a "user to avoid" picker without exposing emails or other profile fields.
- `GET /preferences/` — list the current user's blacklist entries.
- `POST /preferences/` — add a user to the blacklist, e.g. `{"avoid_user_id": 8, "reason": "Missed a previous swap"}`. Rejects self-blacklisting, unknown users, and duplicates.
- `DELETE /preferences/{uf_id}` — remove a blacklist entry (only the owner may delete their own entry).

`GET /swaps/find/{user_id}` excludes any cycle that contains a user blacklisted by (or who has blacklisted) the requesting user, so blacklisted users are never proposed as swap partners.

## Local PostgreSQL dummy database setup

From project root, run schema then seed data into a local Postgres database.

1. Create database:

```bash
createdb equiswap_dev
```

2. Apply schema:

```bash
psql -d equiswap_dev -f EquiSwap/backend/database_create.sql
```

3. Seed dummy data:

```bash
psql -d equiswap_dev -f EquiSwap/database.populate.sql
```

4. Point API to Postgres:

```bash
export DATABASE_URL="postgresql+psycopg://localhost/equiswap_dev"
```

If your machine uses username/password auth:

```bash
export DATABASE_URL="postgresql+psycopg://<username>:<password>@localhost:5432/equiswap_dev"
```

Alternative one-command setup script:

```bash
cd EquiSwap/backend
psql -U postgres -d equiswap_dev -h localhost
```

## Environment variables

Optional variables:

- `DATABASE_URL` (default: `sqlite:///./equiswap.db`)
- `JWT_SECRET_KEY` (set this in real deployments)
- `ACCESS_TOKEN_EXPIRE_MINUTES` (default: `60`)
