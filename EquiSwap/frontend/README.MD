# EquiSwap Frontend

This is the React + Vite frontend for EquiSwap, a family-focused swap platform for children’s toys, books, and learning resources.

## Overview

The frontend provides the user experience for:

- user registration and login
- browsing available items
- managing a personal wishlist
- viewing and responding to swap proposals
- checking swap history and trust scores
- managing a blacklist of users to avoid in future swap matches (Preferences page)
- admin dashboard operations

It connects to the FastAPI backend at the configured API base URL and uses local storage for the JWT session token.

## Tech stack

- React 19
- Vite
- TypeScript
- React Router
- Vitest + Testing Library
- Playwright (end-to-end)
- Oxlint

## Project structure

- `src/App.tsx` — landing page and main app entry
- `src/main.tsx` — React bootstrap
- `src/components/` — reusable UI components such as nav, cards, forms
- `src/pages/` — auth, dashboard, profile, preferences (blacklist management), and admin pages
- `src/lib/api.ts` — authenticated API client and types
- `src/lib/AuthContext.tsx` — auth/session state
- `src/test/setup.ts` — test setup for Vitest
- `e2e/mocked/` — Playwright specs that mock the API
- `e2e/integration/` — Playwright specs that run against the real backend
- `playwright.config.ts`, `playwright.integration.config.ts` — Playwright configs
- `scripts/run-e2e.sh` — helper to run the E2E suites locally

## Prerequisites

- Node.js 18+
- npm
- The backend API running locally on `http://localhost:8000`

## Install

From the frontend directory:

```bash
cd EquiSwap/frontend
npm install
```

## Run locally

Start the Vite development server:

```bash
npm run dev
```

Then open the local URL shown in the terminal, typically:

- http://localhost:5173

## Environment variables

The frontend expects a backend API URL via the following variable:

```bash
VITE_API_BASE_URL=http://localhost:8000
```

You can set this in a `.env` file in the frontend root, for example:

```bash
VITE_API_BASE_URL=http://localhost:8000
```

If it is not set, the app defaults to `http://localhost:8000`.

## Run tests

```bash
npm test
```

## Test coverage

Coverage is measured with `@vitest/coverage-v8` and configured in `vitest.config.ts`
with an 80% statement threshold (branch coverage is not enforced):

```bash
npm run test:coverage
```

Current coverage is around 93% statements across `src/`. An HTML report is written
to `coverage/index.html`.

## End-to-end tests (Playwright)

Two Playwright suites drive a real Chromium browser:

| Suite | Location | Backend | Command |
| --- | --- | --- | --- |
| Mocked | `e2e/mocked/` | None: API calls are intercepted with `page.route` | `npm run test:e2e` |
| Integration | `e2e/integration/` | Real FastAPI app with a throwaway SQLite DB (`backend/e2e.db`) | `npm run test:e2e:integration` |

Integration specs cover registration/login, adding/editing/deleting items, wishlist add/remove, and the swap lifecycle (match discovery, propose, accept, reject, swap history, group chat). `e2e/integration/helpers.ts` seeds users, items, wishlists and swap cycles through the API and signs in by storing the JWT, so each spec uses unique data and the tests need no database reset.

Playwright starts the servers itself, so you do not need to run the dev server or
backend first. The integration suite uses its own ports (backend `8001`, frontend
`4174`), so it will not clash with a dev stack on `8000`/`5173`.

### Run locally

One-time setup:

```bash
cd EquiSwap/frontend
npm install
npx playwright install chromium

# Integration suite only: backend dependencies
cd ../backend
pip install -r requirements.txt
```

Run the tests:

```bash
cd EquiSwap/frontend

# Helper script: installs the browser if needed, then runs the suites
./scripts/run-e2e.sh              # both suites
./scripts/run-e2e.sh mocked       # mocked suite only
./scripts/run-e2e.sh integration  # integration suite only

# Or use npm directly
npm run test:e2e                  # mocked
npm run test:e2e:integration      # real backend
npm run test:e2e:all              # both
```

The integration suite launches the backend with `python3`. To use another
interpreter (for example a virtualenv), set `PYTHON`:

```bash
PYTHON=../backend/.venv/bin/python npm run test:e2e:integration
```

Useful Playwright options (append after `--`):

```bash
npm run test:e2e -- --headed          # watch the browser
npm run test:e2e -- --ui              # interactive UI mode
npm run test:e2e -- --debug           # step through with the inspector
npm run test:e2e -- -g "login"        # run tests matching a title
npx playwright show-report playwright-report/mocked   # open the HTML report (CI mode)
```

Vitest ignores `e2e/`, so `npm test` only runs the unit tests.

### CI

The `e2e-tests` job in `.github/workflows/ci.yml` runs both suites and uploads the
`playwright-report/` folder as an artifact. The deploy job waits for it to pass.

## Run lint

```bash
npm run lint
```

## Production build

```bash
npm run build
```

For Vercel, set the project root to `EquiSwap/frontend` and define this
environment variable for the Production environment before building:

```text
VITE_API_BASE_URL=https://<your-render-service>.onrender.com
```

The Render `ALLOWED_ORIGINS` value must contain the exact Vercel origin, without
a trailing slash. Add the Vercel preview origin too if preview deployments need
to call the API.

To preview the production build locally:

```bash
npm run preview
```

## Notes

- The app stores the JWT in `localStorage` under `equiswap_token`.
- Authentication is required for protected routes and API calls.
- The UI is designed to work with the backend endpoints defined in the FastAPI service.

## Backend dependency

This frontend expects the backend service to be started separately. See the backend README for setup and API usage instructions.
