# EquiSwap

[![CI](https://github.com/COMP693-Projects-26S2/COMP693_26S2_Project_Yue_Li_1165455/actions/workflows/deploy%20to%20render.yml/badge.svg)](https://github.com/COMP693-Projects-26S2/COMP693_26S2_Project_Yue_Li_1165455/actions/workflows/deploy-to-render.yml)
[![Backend coverage](https://img.shields.io/badge/backend%20coverage-95.69%25-brightgreen)](https://github.com/COMP693-Projects-26S2/COMP693_26S2_Project_Yue_Li_1165455/actions/workflows/deploy-to-render.yml)
[![Frontend coverage](https://img.shields.io/badge/frontend%20coverage-90.35%25-brightgreen)](https://github.com/COMP693-Projects-26S2/COMP693_26S2_Project_Yue_Li_1165455/actions/workflows/deploy-to-render.yml)

EquiSwap is a full-stack application that helps parents exchange children's toys and books without relying on cash-based transactions. Instead of matching one buyer and one seller, the system models user desires as a graph and identifies multi-user barter cycles using Tarjan's Strongly Connected Components algorithm.

## Project overview

The app is designed to solve the practical problem of barter illiquidity. When a direct one-to-one trade does not exist, EquiSwap can still discover a valid cycle such as:

- Parent A wants something from Parent B
- Parent B wants something from Parent C
- Parent C wants something from Parent A

This creates a coordinated multi-party exchange that would be difficult to organise manually.

## Main features

- User registration and authentication
- Item and wishlist management
- Swap cycle detection using graph theory
- Swap proposal creation, acceptance, rejection, and expiry handling
- Notifications, trust updates, and swap history tracking
- User blacklist preferences and account management
- Admin dashboards for platform and swap-cycle insights
- FastAPI backend with PostgreSQL/SQLite compatibility

## Current project status

- Backend MVP is implemented in the EquiSwap backend
- Swap graph logic and Tarjan SCC implementation are in place
- Backend and frontend unit tests, plus mocked and real-backend Playwright E2E suites, are configured in CI
- Frontend and backend are deployed as the live EquiSwap application

## Live application

The live EquiSwap application is available at:

- [https://equi-swap.vercel.app](https://equi-swap.vercel.app)

The application is deployed using the following architecture:

- **Frontend:** React frontend hosted on [Vercel](https://vercel.com/)
- **Backend:** FastAPI API hosted on [Render](https://render.com/)
- **Database:** PostgreSQL database hosted on Render and connected to the backend

The frontend communicates with the deployed FastAPI backend on Render for authentication, item and wishlist management, swap cycle detection, notifications, and swap lifecycle operations.

## Documentation and project files

- User guide (GitHub Pages): https://comp693-projects-26s2.github.io/COMP693_26S2_Project_Yue_Li_1165455/ (source in [docs/](docs/))
- Frontend project guide: [EquiSwap/frontend/README.MD](EquiSwap/frontend/README.MD)
- Backend project guide: [EquiSwap/backend/README.md](EquiSwap/backend/README.md)
- Project journal: [Journals/README.md](Journals/README.md)
- Deliverables: [Deliverables/README.md](Deliverables/README.md)
- App overview: [EquiSwap/README.md](EquiSwap/README.md)

## Quick start

Start the backend API:

```bash
cd EquiSwap/backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open the Swagger docs at:

- http://127.0.0.1:8000/docs

In another terminal, start the frontend:

```bash
cd EquiSwap/frontend
npm install
npm run dev
```

The frontend defaults to the backend at `http://localhost:8000`. See the
[frontend guide](EquiSwap/frontend/README.MD) for environment configuration,
deployment, and Playwright report instructions.

## Running the tests

```bash
# Backend unit tests
(cd EquiSwap/backend && pytest -q)

# Frontend unit tests
(cd EquiSwap/frontend && npm test)

# Frontend unit tests with coverage (90% statement threshold)
(cd EquiSwap/frontend && npm run test:coverage)

# Playwright tests: mocked API and real backend integration
(cd EquiSwap/frontend && ./scripts/run-e2e.sh)
```

The Playwright runner starts its own frontend and, for integration tests, a
backend using a disposable SQLite database. It requires the frontend npm
dependencies, Playwright Chromium, and backend dependencies. See the
[frontend testing guide](EquiSwap/frontend/README.MD#end-to-end-tests-playwright)
and [backend testing guide](EquiSwap/backend/README.md#run-tests) for details.

## Repository structure

- [EquiSwap/backend](EquiSwap/backend) — FastAPI backend application and tests
- [EquiSwap/frontend](EquiSwap/frontend) — frontend workspace
- [Journals](Journals) — weekly project journal and reflections
- [Deliverables](Deliverables) — architecture and project documentation
- [References](References) — supporting materials
