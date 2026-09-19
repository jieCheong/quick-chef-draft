# QuickChef

AI recipe generation on a backend I actually built, not one I prompted into existing.

QuickChef generates recipes from whatever's in your kitchen, your dietary goals, and how much time you've got — then walks you through cooking them. The AI-generation part is the easy half. The rest — auth, rate limiting under concurrency, request-scoped logging, schema-validated APIs, a Postgres schema that doesn't fall over under load — is the part this README is actually about. It's a deployed product (Railway + Vercel, submitted to Google Play's internal testing track), not a local demo.

[![CI](https://github.com/jieCheong/quick-chef-draft/actions/workflows/ci.yml/badge.svg)](https://github.com/jieCheong/quick-chef-draft/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/badge/tests-71%20passing-C85A28?style=flat-square)](server/src/routes/tests)
[![License: MIT](https://img.shields.io/badge/license-MIT-C85A28?style=flat-square)](LICENSE)
[![Live](https://img.shields.io/badge/live-quick--chef--draft.vercel.app-C85A28?style=flat-square)](https://quick-chef-draft.vercel.app)

**Live:** [quick-chef-draft.vercel.app](https://quick-chef-draft.vercel.app)

---

## Screens

<table>
<tr>
<td width="50%"><img src="docs/screenshots/home.png" alt="Home screen — ingredient and goal input" width="100%"></td>
<td valign="top">

### Home — recipe generation

This is the core loop: pantry items and dietary goals go in, a structured recipe comes out. The form maps directly onto `POST /api/generate-recipe`'s Zod schema, so whatever the user can submit here is exactly what the API will accept — validation isn't duplicated between client and server, it's just enforced twice against the same shape. The daily generation counter shown here is backed by the atomic Postgres upsert described below, not a client-side guess.

</td>
</tr>
<tr>
<td valign="top">

### Cook mode

A generated recipe isn't just text on a page — Cook mode turns it into a step-by-step flow, one instruction at a time, sized for actually standing at a stove with a phone nearby. This is the screen that makes the AI output a product feature instead of a chat transcript: the same `instructions` JSONB column that came back from OpenAI gets rendered as a sequence, not a wall of text.

</td>
<td width="50%"><img src="docs/screenshots/cook-mode.png" alt="Cook mode — step-by-step cooking view" width="100%"></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/saved-recipes.png" alt="Saved recipes with filtering" width="100%"></td>
<td valign="top">

### Saved recipes

Generated recipes can be saved, then filtered — including by a "Trendy" filter over recipes flagged `is_trending`. Saved recipes live in their own table (`saved_recipes`) separate from the weekly-rotating `viral_recipes` table that's seeded independently of user generations, so a user's personal library and the app's editorial content never collide on the same rows.

</td>
</tr>
<tr>
<td valign="top">

### Pantry

Pantry items are what actually drives recipe generation — this screen is the input side of the loop shown on Home, not a separate inventory feature bolted on afterward. Items are stored per-user with a category, so "what can I cook right now" is answerable from a simple indexed query (`idx_pantry_items_user_id`) instead of scanning.

</td>
<td width="50%"><img src="docs/screenshots/pantry.png" alt="Pantry item tracking" width="100%"></td>
</tr>
</table>

---

## Why this exists

QuickChef started as an AI-generated draft — Lovable for the frontend, Supabase for everything else. Shipping that would have meant shipping something I couldn't fully explain. Instead I rebuilt every layer under `server/` by hand: raw SQL over an ORM, JWT auth over Supabase Auth, Zod-validated routes, structured logging, rate limiting, and an OpenAI integration that isn't just a fetch call. The goal wasn't a feature checklist — it was understanding how a production API is actually put together, including the parts that only break once real traffic hits them.

## How it works

```
┌──────────────────────┐        ┌───────────────────────┐
│  React / Vite / TS    │        │  Android (Capacitor)  │
│  Vercel (static)       │        │                       │
└──────────┬────────────┘        └───────────┬───────────┘
           │                                  │
           │         HTTPS + Bearer JWT       │
           └────────────────┬─────────────────┘
                            ▼
              ┌─────────────────────────────┐
              │   Express API (Railway)      │
              │                             │
              │  helmet → pino-http (req id) │
              │  → CORS (regex-matched       │
              │    Vercel preview origins)   │
              │  → requireAuth (JWT)         │
              │  → Zod validate middleware   │
              └───────────┬─────────────────┘
                          │
        ┌─────────────────┼──────────────────────┐
        ▼                 ▼                       ▼
┌───────────────┐ ┌────────────────┐   ┌─────────────────────┐
│ PostgreSQL     │ │ OpenAI          │   │ node-cron (daily)    │
│ (Neon)         │ │ GPT-4o-mini     │   │ rotates viral_recipes│
│ raw SQL (pg)   │ │ recipe + image  │   │ when batch is stale  │
│ atomic usage_  │ │ generation      │   └─────────────────────┘
│ daily upsert   │ └────────────────┘
└───────────────┘
```

Every mutating route runs through the same pipeline: JWT verification → Zod schema validation → handler. `/api/generate-recipe` additionally reserves a slot in `usage_daily` *before* calling OpenAI, atomically, so the per-user daily cap can't be raced (see below). The same Zod schemas that validate these requests at runtime also generate the OpenAPI spec served at `/api/docs`.

## Highlights

- **Atomic rate limiting, not read-then-write.** The daily AI-generation cap used to be a `SELECT` check followed by an `INSERT`/`UPDATE` — a k6 test firing concurrent requests against a 2-per-day cap walked straight through it, with real OpenAI calls going out past the limit. The fix folds check-and-reserve into one `INSERT ... ON CONFLICT DO UPDATE ... WHERE` statement, so Postgres's row-level locking makes the race structurally impossible instead of just less likely.
- **71 tests aimed at the unhappy paths.** Vitest + Supertest cover expired, tampered, and malformed JWTs; brute-force rate limiting; retry/backoff logic; and every mutating route — not just the CRUD happy path.
- **API docs that can't drift from the API.** The OpenAPI 3.0 spec served at `/api/docs` is generated directly from the same Zod schemas that validate incoming requests, so the documentation and the validation logic are structurally the same source.
- **Structured, correlatable logging.** Pino + `pino-http` attach a per-request ID to every log line, with automatic redaction of passwords and tokens — one request's full story (auth check, DB query, OpenAI call, response) is traceable through Railway's logs by a single ID.
- **Real bugs, fixed in a real environment.** An SSL flag hardcoded for Neon broke local Postgres (fixed by reading it off the connection string instead of `NODE_ENV`); CORS against Vercel's ephemeral preview URLs needed a regex origin matcher instead of a hand-maintained allowlist; a lazy-initialized OpenAI client so the API key is read on first request, not at module load.
- **Load-tested, not just unit-tested.** k6 against the full Docker stack: 2,456 req/s at 24ms p95 on `/health`, and the full JWT-verify → Zod-validate → atomic-upsert path on `/generate-recipe` measured in isolation from OpenAI's own latency.

## Tech stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui (Radix primitives), React Router, TanStack Query, Framer Motion, Capacitor 8 (Android) |
| **Backend** | Node.js, Express, TypeScript, raw SQL via `pg`, JWT (`jsonwebtoken`) + `bcryptjs`, Zod, Pino + `pino-http`, `express-rate-limit`, Helmet, `node-cron` |
| **Database** | PostgreSQL (Neon), JSONB for recipe/nutrition data, UUID primary keys |
| **AI** | OpenAI GPT-4o-mini (recipe + image generation) |
| **Testing** | Vitest, Supertest, k6 (load testing) |
| **Infrastructure** | Docker (multi-stage build), Railway (API), Vercel (frontend), GitHub Actions (CI) |

## Engineering decisions worth knowing about

- **Why raw SQL instead of an ORM:** the fix for the rate-limit race condition is a single atomic `INSERT ... ON CONFLICT DO UPDATE ... WHERE ... RETURNING` statement. Most ORMs either can't express that as one round-trip or hide the exact SQL being sent, which is precisely the thing I needed to control and verify under load.
- **Why JWT instead of Supabase Auth or session cookies:** the frontend (Vercel) and API (Railway) are deployed independently on different origins. A Bearer token in the `Authorization` header needs no server-side session store and no `credentials: true` CORS config — cookie-based auth would have added cross-origin complexity for no real benefit here.
- **Why UUID primary keys instead of auto-increment integers:** IDs are user-facing (recipe URLs, pantry item references) and unguessable IDs are cheap insurance against enumeration; UUIDs also mean no ID collisions if data ever needs to move between databases.
- **Why a separate CI job for dependency audits instead of folding it into the test job:** a failing test means the logic is wrong; a high-severity vulnerability means a dependency needs updating — different categories of failure. Splitting them means a vulnerable dependency shows up as its own named check in GitHub's UI instead of hiding inside an unrelated "test" failure.

## Getting started

Requires Node 20+, Docker, and an OpenAI API key.

```bash
git clone https://github.com/jieCheong/quick-chef-draft.git
cd quick-chef-draft

# 1. Backend — Postgres + API via Docker Compose
#    server/.env needs OPENAI_API_KEY and JWT_SECRET
#    (DATABASE_URL is overridden by docker-compose for the container network)
docker-compose up --build
# API:      http://localhost:3002
# Postgres: localhost:5433

# 2. Frontend, in a separate terminal
npm install
echo "VITE_API_BASE_URL=http://localhost:3002" > .env.local
npm run dev:frontend
# App: http://localhost:5173
```

API docs (non-production only): `http://localhost:3002/api/docs`

Without Docker: point `server/.env`'s `DATABASE_URL` at any reachable Postgres instance (Neon works), then `npm run dev` from the repo root runs frontend and backend together.

## Testing

```bash
cd server
npm test
```

71 Vitest/Supertest tests covering auth (including expired/tampered/malformed JWTs), rate limiting, pantry, profiles, recipes, budget, and retry logic. Every push and PR runs this suite plus ESLint, a TypeScript check on both frontend and server, and an `npm audit` scan (blocking on high/critical severity) — see [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

Load testing (against the local Docker stack):

```bash
k6 run load-test/health-check.js
k6 run load-test/recipe-generation.js
```

## Roadmap

- [ ] Refresh token flow — JWTs currently expire flat at 7 days with no rotation
- [ ] Frontend test coverage beyond the current Vitest/RTL scaffolding
- [ ] `.env.example` files for both `server/` and the frontend, for faster onboarding
- [ ] Public Google Play release (currently in internal testing)

## License

MIT — see [LICENSE](LICENSE).

---

Built by [Jie Cheong](https://github.com/jieCheong).
