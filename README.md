# QuickChef

AI-powered cooking assistant — generates personalized recipes from your ingredients, dietary goals, and time constraints. Native Android app built on a self-built Node/Express/PostgreSQL backend.

[![CI](https://github.com/jieCheong/quick-chef-draft/actions/workflows/ci.yml/badge.svg)](https://github.com/jieCheong/quick-chef-draft/actions/workflows/ci.yml)

## Why this project exists

QuickChef started as an AI-generated draft (Lovable + Supabase). Rather than ship that, I rebuilt every layer of the backend from scratch — auth, database access, validation, rate limiting, logging, AI integration, deployment — to actually understand how a production API is put together, not just how to prompt one into existing. Everything under `server/` is hand-written: raw SQL via `pg` instead of an ORM, JWT auth instead of Supabase Auth, and a request-scoped structured logging setup instead of `console.log`.

The result is deployed (Railway + Vercel) and submitted to the Google Play Store's internal testing track.

## Engineering highlights

**Fixed a real concurrency bug, not a hypothetical one.**
The daily AI-generation limit was originally a read-then-write check (`SELECT` usage, then `INSERT`/`UPDATE` after the OpenAI call). Under concurrent requests there's a gap between those two steps — a k6 load test firing 10 simultaneous requests against a 2-per-day cap reproduced it directly, with real OpenAI calls going out well past the limit. The fix folds the check and the increment into one atomic statement:

```sql
INSERT INTO usage_daily (user_id, date, generations_used, max_generations)
VALUES ($1, $2, 1, 2)
ON CONFLICT (user_id, date)
DO UPDATE SET generations_used = usage_daily.generations_used + 1
WHERE usage_daily.generations_used < usage_daily.max_generations
RETURNING generations_used, max_generations
```

Postgres serializes concurrent `INSERT ... ON CONFLICT` attempts on the same row via row-level locking, so only `max_generations` reservations can ever succeed for a given user+date, no matter how many requests race. If the OpenAI call that follows a reservation fails, the slot is released — a failed attempt doesn't cost the user one of their limited daily generations. See `server/src/routes/generate.ts`.

**Bugs caught and fixed during the rebuild** (each one only surfaced in a real environment, not in isolated unit tests):
- Auth table mismatch that silently broke new-user registration
- SSL hardcoded on for Postgres, which broke local development against Docker (Neon requires SSL, local Postgres doesn't support it — the fix reads the flag off the connection string itself instead of hardcoding it or keying it off `NODE_ENV`)
- CORS misconfiguration against Vercel's ephemeral preview URLs, solved with a regex origin matcher instead of a hand-maintained allowlist
- A Vitest 4.x arrow-function constructor incompatibility and a Vite 8.x breaking change, both resolved by pinning dependency versions after root-causing the failure
- Lazy OpenAI client initialization, so the API key is only read when a request actually needs it, not at module load time
- Docker volume path mismatches between local compose and the production image

**Security and reliability, not just happy-path features:**
- JWT auth with bcrypt password hashing; login returns an identical error for "no such user" and "wrong password" to prevent email enumeration (covered by a dedicated test)
- Zod schema validation on every mutating route, applied as reusable Express middleware
- `express-rate-limit` on `/auth/login` and `/auth/register` (5 attempts / 15 min per IP) as a brute-force guard
- `helmet` for standard security headers
- Structured logging (Pino) with automatic redaction of passwords/tokens and per-request correlation IDs, so a single request's full story — auth check, DB query, OpenAI call, response — can be traced through Railway's logs by one ID
- 71 Vitest/Supertest tests covering auth (including expired/tampered/malformed JWTs), rate limiting, pantry, profiles, recipes, budget, and retry logic

**API documentation generated from the same source that validates requests.**
An OpenAPI 3.0 spec (served at `/api/docs` via Swagger UI, raw JSON at `/api/openapi.json`) is built directly from the Zod schemas that validate incoming requests at runtime — the docs can't drift from what the API actually accepts, because they're generated from the exact same definitions.

## Stack

**Frontend** — React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, React Router, TanStack Query, Framer Motion, Capacitor 8 (Android)

**Backend** — Node.js, Express, TypeScript, PostgreSQL (Neon) via raw SQL (`pg`), JWT auth, bcrypt, Zod, Pino, `express-rate-limit`, Helmet, OpenAI (GPT-4o-mini)

**Testing** — Vitest, Supertest, k6 (load testing)

**Infrastructure** — Docker (multi-stage build), Railway (API), Vercel (frontend), GitHub Actions (CI)

## Development

```bash
# Frontend + backend together
npm run dev

# Server tests
cd server && npm test

# Server only, with hot reload
cd server && npm run dev
```

API docs (once the server is running): `http://localhost:3001/api/docs`

## Architecture

Full technical documentation — database schema, API reference, auth flow, and AI generation flow — lives in `QuickChef_Technical_Documentation.pdf`.

## Performance

Load tested against the local Docker stack (k6, 60s sustained run):

| Endpoint | Concurrency | Throughput | p95 Latency | Error Rate |
|---|---|---|---|---|
| `GET /health` | 50 VUs | 2,456 req/s | 24ms | 0% |
| `POST /generate-recipe` | 20 VUs | 18 req/s | 47ms | 0% |

The `/generate-recipe` numbers cover the full server-side path: JWT verification, Zod schema validation, and the atomic PostgreSQL upsert for the per-user daily rate limit. OpenAI is not called during the test — the daily limit is hit after 2 real generations per user, so the load test measures server overhead in isolation.

Scripts: `load-test/health-check.js`, `load-test/recipe-generation.js`

## CI

Every push and pull request runs four independent checks: ESLint on the frontend, TypeScript typechecking on both frontend and server, the Vitest suite (71 tests — auth, rate limiting, pantry, profiles, recipes, budget, viral routes, retry logic), and a `npm audit` dependency vulnerability scan (blocking on high/critical severity). See `.github/workflows/ci.yml`.
