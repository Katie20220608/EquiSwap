# EquiSwap

[![CI](https://github.com/COMP693-Projects-26S2/COMP693_26S2_Project_Yue_Li_1165455/actions/workflows/ci.yml/badge.svg)](https://github.com/COMP693-Projects-26S2/COMP693_26S2_Project_Yue_Li_1165455/actions/workflows/ci.yml)
[![Backend coverage](https://img.shields.io/badge/backend%20coverage-94.0%25-brightgreen)](https://github.com/COMP693-Projects-26S2/COMP693_26S2_Project_Yue_Li_1165455/actions/workflows/ci.yml)
[![Frontend coverage](https://img.shields.io/badge/frontend%20coverage-93.4%25-brightgreen)](https://github.com/COMP693-Projects-26S2/COMP693_26S2_Project_Yue_Li_1165455/actions/workflows/ci.yml)

Coverage badges show the latest verified snapshot; the Actions run summary shows the percentages for each run.

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
- FastAPI backend with PostgreSQL/SQLite compatibility

## Current project status

- Backend MVP is implemented in the EquiSwap backend
- Swap graph logic and Tarjan SCC implementation are in place
- Core swap workflows and unit tests have been added
- Frontend is implemented and deployed as the live EquiSwap application

## Live application

The live EquiSwap application is available at:

- [https://equi-swap.vercel.app](https://equi-swap.vercel.app)

The application is deployed using the following architecture:

- **Frontend:** React frontend hosted on [Vercel](https://vercel.com/)
- **Backend:** FastAPI API hosted on [Render](https://render.com/)
- **Database:** PostgreSQL database hosted on Render and connected to the backend

The frontend communicates with the deployed FastAPI backend on Render for authentication, item and wishlist management, swap cycle detection, notifications, and swap lifecycle operations.

## Documentation and project files

- Backend project guide: [EquiSwap/backend/README.md](EquiSwap/backend/README.md)
- Project journal: [Journals/README.md](Journals/README.md)
- Deliverables: [Deliverables/README.md](Deliverables/README.md)
- App overview: [EquiSwap/README.md](EquiSwap/README.md)

## Quick start

```bash
cd EquiSwap/backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Then open the Swagger docs at:

- http://127.0.0.1:8000/docs

## Running the tests

```bash
# Backend unit tests
cd EquiSwap/backend && pytest -q

# Frontend unit tests
cd EquiSwap/frontend && npm test

# End-to-end tests (Playwright, mocked API + real backend)
cd EquiSwap/frontend && ./scripts/run-e2e.sh
```

See [EquiSwap/frontend/README.MD](EquiSwap/frontend/README.MD#end-to-end-tests-playwright) for details.

## Repository structure

- [EquiSwap/backend](EquiSwap/backend) — FastAPI backend application and tests
- [EquiSwap/frontend](EquiSwap/frontend) — frontend workspace
- [Journals](Journals) — weekly project journal and reflections
- [Deliverables](Deliverables) — architecture and project documentation
- [References](References) — supporting materials
