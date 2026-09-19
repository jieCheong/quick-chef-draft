# QuickChef performance & correctness results

Everything here is reproducible from this folder. Raw output is in `results/`.

**Environment:** Windows 11 (Docker Desktop), Node v24.15.0, local `postgres:16.14-alpine` (docker-compose `quickchef-db`, port 5433, isolated database `quickchef_bench`). Production runs on Neon PostgreSQL 18.6, so absolute timings and planner choices may differ there. Every script refuses to run against anything except local `quickchef_bench`.

| Script | What it does |
|---|---|
| `seed.js` | 5,088 `saved_recipes` across 135 users (25–50 each, avg 37.7), avg row 1.7 KB, deterministic (seeded PRNG) |
| `bench-index.js` | A/B/C index benchmark, 3 rounds × 100 runs per state per query shape |
| `race.js` | Reproduces the daily-cap race at the SQL layer, old vs. new code |
| `auth-timing.js` | `jwt.verify` and `bcryptjs` timings |
| `payload.js` | Cost of `SELECT *` when rows carry base64 images |
| `../../load-test/rate-limit-race.js` | **k6 regression test** for the race: 10 simultaneous requests, asserts exactly 2×200 and 8×429 |
| `serve.ts` | Starts the API on a local DB without the startup viral-recipe rotation (used to run the k6 test safely) |
| `gpt-timing.js` | Times 20 real `gpt-4o-mini` calls with the route's exact prompt and parameters |

---

## 1. Race condition on the 2-per-day generation cap (fixed)

**Bug:** `POST /api/generate-recipe` did `SELECT` (check usage) → call OpenAI → `INSERT … ON CONFLICT` (increment). Concurrent requests all read "under limit" before any of them incremented, so every one proceeded to OpenAI. **Fix:** one atomic `INSERT … ON CONFLICT DO UPDATE … WHERE generations_used < max_generations RETURNING` (`generate.ts:55`); Postgres row-level locking serializes racers.

Reproduction: 10 concurrent requests, one user, cap = 2. "Past the gate" means the request would have called OpenAI. OLD SQL is verbatim from git `572f834^`; NEW SQL is verbatim from `generate.ts`.

| Variant | Trials | Requests past gate (min / median / max) | Trials over cap | Final `generations_used` |
|---|---|---|---|---|
| OLD, check-then-increment, no delay | 50 | 4 / 10 / 10 | **50 / 50** | 10 |
| OLD, check-then-increment, 500 ms between check and increment | 30 | 10 / 10 / 10 | **30 / 30** | 10 |
| NEW, atomic upsert | 200 | 2 / 2 / 2 | **0 / 200** | 2 |

The 500 ms delay stands in for the OpenAI call (real ones take ~2–4 s, a wider window). With it, all 10 requests get through, which matches the "10 real OpenAI calls against a 2/day cap" recorded in the `generate.ts` comment and the README. Even with zero delay, the race wins in every trial.

### k6 regression test, verified in both directions (HTTP level, real OpenAI calls)

`load-test/rate-limit-race.js` registers a fresh throwaway user, fires 10 requests at `POST /api/generate-recipe` simultaneously (`http.batch` with `batchPerHost` raised to 10, since k6 defaults to 6 parallel connections per host), and asserts exact counts through k6 thresholds (non-zero exit on violation). Run against the real Express app and a local Postgres; the allowed requests call real gpt-4o-mini.

| Code under test | Result | Thresholds | k6 exit code |
|---|---|---|---|
| Fixed (atomic upsert, current) | **2 × 200, 8 × 429** (daily-cap body), 0 other | pass | **0** |
| Pre-fix (`generate.ts` from git `572f834^`, everything else current) | **10 × 200, 0 × 429**: 10 real OpenAI calls against a 2/day cap | fail (`count==2` saw 10) | **99** |

Raw output: `results/k6-race-fixed.txt`, `results/k6-race-prefix.txt`. One k6 run per version; the repeated-trial counts in the table above come from `race.js` (SQL layer), not from k6.

**Provenance:** the original k6 run that first found the bug is described in the README and the `generate.ts` comment, but that script is not in the repo; the committed `load-test/recipe-generation.js` is a 20-VU ramp test that treats 429s as fine and would not expose this race. `rate-limit-race.js` is a new script that reproduces the same failure on the pre-fix code and now guards against regression. Describe it as "reproduced and locked in with a k6 regression test", which is exactly what the evidence shows.

Reproduce the pre-fix failure: copy `src/` aside, replace `routes/generate.ts` with `git show 572f834^:server/src/routes/generate.ts`, start it with `APP_MODULE=<copy>/app` via `bench/serve.ts` on a local DB, and point the k6 script at it.

## 2. Query latency: `GET /api/recipes`

`SELECT * FROM saved_recipes WHERE user_id = $1 ORDER BY created_at DESC [LIMIT 3]`

* **A** = no index (background only) · **B** = `idx_saved_recipes_user_id (user_id)`, **what production has today** · **C** = `(user_id, created_at DESC)`
* Execution time = `EXPLAIN (ANALYZE, BUFFERS)`, median of 300 runs per state. Client = wall-clock of the real query through node-postgres (local, includes row transfer).

**Home page, `?limit=3` (`Index.tsx:234`)**

| State | Exec median | Exec p95 | Buffers | Client median | Plan |
|---|---|---|---|---|---|
| B (today) | 0.094 ms | 0.124 ms | 39.2 | 0.694 ms | Limit > **Sort** > Bitmap Heap Scan > Bitmap Index Scan |
| C | 0.032 ms | 0.063 ms | 5.0 | 0.652 ms | Limit > Index Scan (no sort) |
| **B → C** | **−66%** | −49% | **−87%** | −6% | |

**Saved page, full list (`Saved.tsx:227`)**

| State | Exec median | Buffers | Client median |
|---|---|---|---|
| B (today) | 0.125 ms | 39.2 | 1.404 ms |
| C | 0.129 ms | 39.4 | 1.399 ms |
| **B → C** | **no change (+3%, noise)** | | |

Context: A → B (the index production already has) was −84% exec (0.800 → 0.125 ms, 1,193 → 39 buffers). The composite index is 224 kB vs. 56 kB for the single-column one.

**How to read this honestly:**
* The composite index pays off only when a `LIMIT` lets Postgres stop early. Without a limit it still bitmap-scans and sorts ~38 rows, which is already cheap, so it gains nothing there.
* 66% is a real, repeatable plan-level improvement (sort eliminated, 87% fewer buffer reads), but the absolute saving is ~60 µs. Client-observed it is ~6%, because round-trip time dominates a 0.03 ms query. Quote it as **query execution time**, not end-user latency.
* "Busiest" is my judgement, not measured traffic: the home page loads it on every visit (`?limit=3`). There are no request logs to confirm.

## 3. Payload: `SELECT *` returns base64 images (the larger latency problem)

Live rows (structure/size only, no content read): `image_url` ≈ 2.05–2.29 MB per row (base64 PNG data URI); `instructions` reached 9.2 MB on one row once step images were saved. 5 production rows = 16 MB. The list endpoint does `SELECT *` then `res.json(rows)`.

Synthetic user with 20 recipes × ~2 MB `image_url` (sizes taken from the live rows), local DB, query + `JSON.stringify` (what `res.json` does), 15 runs, median:

| Query | Median | p95 | Response size |
|---|---|---|---|
| Saved list, `SELECT *` (today) | 174.1 ms | 355.6 ms | 38.2 MB |
| Saved list, without `image_url` | 1.3 ms | 2.7 ms | 9.9 KB |
| Home `limit 3`, `SELECT *` (today) | 31.8 ms | 151.6 ms | 5.7 MB |
| Home `limit 3`, without `image_url` | 0.7 ms | 1.0 ms | 1.5 KB |

Excluded: the network hop from Railway to the phone, which makes the real cost much larger. This is a measurement of the problem, not a fix. The frontend renders `image_url` on cards, so fixing it means moving images out of the DB (object storage/CDN URLs, or a separate image endpoint) rather than just dropping the column.

## 4. Auth latency (`auth-timing.js`; dev machine, not Railway)

**Change made:** bcrypt cost raised from 10 to **12** (`BCRYPT_COST` in `routes/auth.ts`). All 71 existing tests pass (bcrypt is mocked there). Existing cost-10 hashes keep working, since the cost is stored inside each hash; only newly registered passwords use 12.

Three runs of `auth-timing.js` (n=20 each for bcrypt, n=5,000 for JWT), medians:

| Operation | Run 1 | Run 2 | Run 3 |
|---|---|---|---|
| `jwt.verify` (HS256) | 0.025 ms | 0.024 ms | not re-run |
| `bcryptjs.hash`, cost 10 (previous) | 56.3 ms | 57.3 ms | 59.8 ms |
| `bcryptjs.hash`, cost 11 | 113.4 ms | 114.3 ms | not re-run |
| **`bcryptjs.hash`, cost 12 (current)** | **225.4 ms** | **236.9 ms** | **225.9 ms** |
| **`bcryptjs.compare`, cost 12 (current)** | 228.6 ms | 241.9 ms | 230.4 ms |

* **bcrypt at cost 12 ≈ 225–237 ms**, inside the 200–300 ms target. JWT verification (0.025 ms) is ~200× under the 5 ms target.
* End-to-end check: `POST /api/auth/register` through the real Express app + local Postgres took **296–309 ms** over HTTP (k6 `setup()`, two runs), i.e. ~230 ms hash + ~70 ms of validation, DB writes and HTTP.
* Cost 10 is the OWASP minimum for bcrypt; 12 is a common current default.
* Trade-off worth knowing for an interview: `bcryptjs` is pure JS and runs on the main Node thread, so each login/register spends ~230 ms of CPU there (~4 per second per process at saturation). Native `bcrypt` or a worker pool would raise that ceiling.
* Measured on a dev machine, not Railway; a container CPU may be slower.

## 5. GPT-4o-mini generation time (`gpt-timing.js`)

20 sequential real calls, exact model/prompt/params from `generate.ts` (`gpt-4o-mini`, `max_tokens` 3000, temperature 0.8, non-streaming), five varied ingredient sets rotated. Round trip from this machine to OpenAI only (no auth/DB).

| Metric | Value |
|---|---|
| Calls succeeded | 20 / 20 |
| Valid JSON with 3 recipes (route's own parse check) | 20 / 20 |
| Truncated (`finish_reason=length`) | 0 / 20 |
| **Median latency** | **13.0 s** |
| Mean latency | 16.0 s |
| Mean excluding the 3 stalls below | 12.3 s |
| Min / p95 / max | 9.3 s / 44.6 s / 44.6 s |
| Output size | 1,310 tokens mean (1,162–1,580), ~98 tok/s |

* **The "2–4 s average" target is not realistic for this workload.** The route asks for three complete recipes (ingredients, steps, nutrition), about 1,300 output tokens, and at ~100 tokens/s that is ~13 s of pure generation. A 2–4 s number would only come from a much smaller response. Report the real figure.
* Typical calls cluster at 9–15 s. Three calls (#5 44.6 s, #8 34.7 s, #16 32.4 s) stalled 3× longer despite normal output sizes, i.e. queueing/time-to-first-token on OpenAI's side, which is why the mean (16.0 s) sits well above the median (13.0 s). Lead with the median and disclose the mean.
* Independent cross-check: in the k6 race test the two allowed requests through the full route took 12.7–13.8 s each.
* Possible improvement (not built): streaming the response would cut *perceived* latency to first content while total generation time stays ~13 s.

## Not measured / deliberately skipped

* **Uptime:** needs an UptimeRobot monitor and calendar time (not started).
* **Rate-limit threshold script (`express-rate-limit` on auth routes):** skipped by decision. It would be a weaker version of the concurrency-bug story above.

## Known finding, not fixed (backlog)

**Base64 images stored in the DB make `GET /api/recipes` ship megabytes per request.** `saved_recipes.image_url` holds ~2 MB base64 data URIs and `instructions` reached 9.2 MB with step images; `SELECT *` + `res.json()` returns all of it on every list call (section 3: 38 MB / 174 ms for a 20-recipe user; 5.7 MB / 32 ms on every home-page load, versus ~1.5 KB / 0.7 ms without the image column). Fixing it means moving images to object storage (S3/R2/Cloudinary) and storing URLs, or serving them from a separate endpoint; it is a schema + data migration + frontend change, so it was scoped out. Revisit later. It would be the single biggest latency win in the app, and the before/after is already measured here.
