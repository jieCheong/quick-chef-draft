// load-test/rate-limit-race.js
//
// Regression test for the daily-cap race on POST /api/generate-recipe.
//
// THE BUG THIS GUARDS AGAINST:
// The 2-per-day cap used to be SELECT (check usage) -> call OpenAI -> INSERT
// (increment). Concurrent requests all read "under limit" before any of them
// incremented, so every one of them went on to call OpenAI. The fix is a single
// atomic INSERT .. ON CONFLICT DO UPDATE .. WHERE used < max .. RETURNING
// (routes/generate.ts, reserveGenerationSlot).
//
// WHAT IT DOES:
// Registers a fresh throwaway user (fresh user == fresh daily counter), then
// fires CONCURRENCY identical requests at the SAME instant and asserts the
// outcome is EXACTLY:   2 x 200   and   8 x 429 (daily-cap body)   and   0 other.
// Thresholds are exact counts, so k6 exits non-zero if the cap is exceeded OR
// if fewer than the cap succeed.
//
// COST / SIDE EFFECTS:
// The 2 allowed requests are real OpenAI (gpt-4o-mini) calls: a fraction of a
// cent. Run it against a local/dev stack, not production. Each run registers a
// user, and /api/auth/register is limited to 5 per 15 min per IP, so the 6th run
// inside 15 minutes fails in setup() with a clear message.
//
// HOW TO RUN (repo root):
//   k6 run -e BASE_URL=http://localhost:3002 load-test/rate-limit-race.js
//
// Verified in both directions: PASSES on the atomic-upsert code and FAILS
// (10 x 200) on the pre-fix check-then-increment code. See server/bench/RESULTS.md.

import http from 'k6/http';
import { check, fail } from 'k6';
import { Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3002';
const CAP = 2;
const CONCURRENCY = 10;

const ok200 = new Counter('race_status_200');
const capped429 = new Counter('race_status_429_daily_cap');
const other = new Counter('race_status_other');

export const options = {
  scenarios: {
    race: { executor: 'shared-iterations', vus: 1, iterations: 1, maxDuration: '2m' },
  },
  // k6's http.batch opens at most `batchPerHost` (default 6) parallel connections
  // to one host — without raising it, 10 "concurrent" requests would really be 6.
  batch: CONCURRENCY,
  batchPerHost: CONCURRENCY,
  thresholds: {
    race_status_200: [`count==${CAP}`],
    race_status_429_daily_cap: [`count==${CONCURRENCY - CAP}`],
    race_status_other: ['count==0'],
  },
};

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export function setup() {
  const email = `race_${Date.now()}_${Math.floor(Math.random() * 1e6)}@quickchef.test`;
  const t0 = Date.now();
  const res = http.post(
    `${BASE_URL}/api/auth/register`,
    JSON.stringify({ email, password: 'race-test-password' }),
    { headers: JSON_HEADERS }
  );
  console.log(`register: HTTP ${res.status} in ${Date.now() - t0} ms`);
  if (res.status === 429) fail('register is rate-limited (5 per 15 min per IP) - wait, or restart the server');
  if (res.status !== 201 && res.status !== 200) fail(`register failed: HTTP ${res.status} ${res.body}`);
  return { token: res.json('token') };
}

export default function (data) {
  const body = JSON.stringify({
    ingredients: ['chicken breast', 'garlic', 'olive oil', 'lemon'],
    maxTime: 30,
    dietaryStyle: 'omnivore',
    skillLevel: 'beginner',
  });
  const params = {
    headers: { ...JSON_HEADERS, Authorization: `Bearer ${data.token}` },
    timeout: '90s', // the allowed requests wait on a real OpenAI call
  };

  const responses = http.batch(
    Array.from({ length: CONCURRENCY }, () => ['POST', `${BASE_URL}/api/generate-recipe`, body, params])
  );

  let n200 = 0, n429 = 0, nOther = 0;
  for (const r of responses) {
    if (r.status === 200) n200++;
    // Count a 429 only if it is the daily-cap response (body carries used/max), so
    // a generic HTTP rate-limiter 429 can't be mistaken for the cap working.
    else if (r.status === 429 && r.json('max') === CAP) n429++;
    else nOther++;
  }
  ok200.add(n200);
  capped429.add(n429);
  other.add(nOther);
  console.log(`${CONCURRENCY} concurrent requests -> ${n200} x 200, ${n429} x 429 (daily cap), ${nOther} other`);

  check(null, {
    [`exactly ${CAP} requests passed the cap gate`]: () => n200 === CAP,
    [`exactly ${CONCURRENCY - CAP} were rejected by the cap`]: () => n429 === CONCURRENCY - CAP,
  });
}
