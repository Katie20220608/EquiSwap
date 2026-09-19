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
- Oxlint

## Project structure

- `src/App.tsx` — landing page and main app entry
- `src/main.tsx` — React bootstrap
- `src/components/` — reusable UI components such as nav, cards, forms
- `src/pages/` — auth, dashboard, profile, preferences (blacklist management), and admin pages
- `src/lib/api.ts` — authenticated API client and types
- `src/lib/AuthContext.tsx` — auth/session state
- `src/test/setup.ts` — test setup for Vitest

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
