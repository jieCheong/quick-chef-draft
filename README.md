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

## Performance

Load tested against the local Docker stack (k6, 60s sustained run):

| Endpoint | Concurrency | Throughput | p95 Latency | Error Rate |
|---|---|---|---|---|
| `GET /health` | 50 VUs | 2,456 req/s | 24ms | 0% |
| `POST /generate-recipe` | 20 VUs | 18 req/s | 47ms | 0% |

The `/generate-recipe` numbers cover the full server-side path: JWT
verification, Zod schema validation, and a PostgreSQL atomic upsert
for the per-user daily rate limit. OpenAI is not called during the
test — the daily limit is hit after 2 real generations per user,
so the load test measures server overhead in isolation.

Scripts: `load-test/health-check.js`, `load-test/recipe-generation.js`

## CI

Every push and pull request runs three independent checks: ESLint on the frontend, TypeScript typechecking on both frontend and server, and the Vitest suite covering JWT auth middleware and the rate-limited recipe generation endpoint. See `.github/workflows/ci.yml`.
