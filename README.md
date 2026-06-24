# QuickChef

AI-powered cooking assistant — generates personalized recipes from your ingredients, dietary goals, and time constraints.

[![CI](https://github.com/jieCheong/quick-chef-draft/actions/workflows/ci.yml/badge.svg)](https://github.com/jieCheong/quick-chef-draft/actions/workflows/ci.yml)

## Stack

**Frontend** — React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, React Router, TanStack Query, Capacitor (Android)

**Backend** — Node.js, Express, TypeScript, PostgreSQL (Neon), JWT auth, Zod validation, OpenAI (GPT-4o-mini)

**Infrastructure** — Railway (API), Vercel (frontend), GitHub Actions (CI)

## Development

```bash
# Frontend + backend together
npm run dev

# Server tests
cd server && npm test
```

## Architecture

Full technical documentation — database schema, API reference, auth flow, and AI generation flow — lives in `QuickChef_Technical_Documentation.pdf`.

## CI

Every push and pull request runs three independent checks: ESLint on the frontend, TypeScript typechecking on both frontend and server, and the Vitest suite covering JWT auth middleware and the rate-limited recipe generation endpoint. See `.github/workflows/ci.yml`.
