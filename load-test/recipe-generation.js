// load-test/recipe-generation.js
//
// k6 load test for POST /api/generate-recipe
//
// WHY TEST THIS ROUTE SPECIFICALLY:
// It's the most expensive path in the app — it hits auth middleware,
// Zod validation, a DB query (usage check), and would normally call
// OpenAI. Testing it tells you how much overhead your own server adds
// before any external call happens. That's the number you control
// and the number worth putting on a resume.
//
// WHY NOT CALL REAL OPENAI DURING A LOAD TEST:
// Two reasons: cost (100 concurrent requests × 30 seconds = hundreds
// of OpenAI calls = real money), and noise (OpenAI's latency variability
// would dominate your numbers, making them not about your server at all).
// Instead, we test up to the daily limit check — the route returns 429
// after the user's 2 free generations, which is a fast DB-only response.
// This lets us measure the full server stack without any external I/O.
//
// HOW TO RUN:
//   1. Paste your JWT token in the TOKEN variable below
//   2. Make sure your Docker stack is running (docker-compose up --build)
//   3. k6 run load-test/recipe-generation.js
//
// WHAT TO RECORD FOR YOUR RESUME:
//   After the run, look for these lines in the output:
//   - http_reqs................: the total requests/second (req/s)
//   - http_req_duration......p(95): your p95 latency in ms
//   - http_req_failed.........: error rate (should be 0.00%)
//   Write them down — those three numbers are your resume bullet.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// ── Paste your JWT token here ─────────────────────────────────────────────────
// Get it by registering a throwaway account:
//   Invoke-RestMethod -Method POST -Uri http://localhost:3002/api/auth/register
//     -ContentType "application/json"
//     -Body '{"email":"loadtest@quickchef.app","password":"loadtest123"}'
// Then copy the .token field from the response.
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjZGZjZjcyZC0zOWNkLTQ2NTUtYWYwNy0wMzJiYjM2NGNjMzEiLCJlbWFpbCI6ImxvYWR0ZXN0MkBxdWlja2NoZWYuYXBwIiwiaWF0IjoxNzgzODEzODY3LCJleHAiOjE3ODQ0MTg2Njd9.TKtPOPUh7zNG2oxzGV_BVMDmDUuyaNN-Eda5mlEMNLQ';
const BASE_URL = 'http://localhost:3002';

// Custom metric: tracks the rate of non-2xx/429 responses.
// 429 is EXPECTED here (daily limit hit after 2 generations) — it's
// not an error, it's the rate limiter working correctly.
// We only want to flag genuine server errors (5xx) as failures.
const errorRate = new Rate('error_rate');

// ── Test configuration ────────────────────────────────────────────────────────
export const options = {
  // Stages ramp up gradually rather than slamming the server instantly.
  // This matches realistic traffic patterns and prevents the "cold start"
  // of the first few requests from skewing the numbers.
  stages: [
    { duration: '10s', target: 5 },   // ramp up to 5 virtual users
    { duration: '20s', target: 10 },  // ramp up to 10 virtual users
    { duration: '20s', target: 20 },  // peak load: 20 virtual users
    { duration: '10s', target: 0 },   // ramp down
  ],

  // Thresholds define what "passing" means for this test.
  // The test will exit with a non-zero code if these aren't met,
  // which means you could wire it into CI to catch regressions.
  thresholds: {
    // 95% of requests must complete in under 2 seconds.
    // This accounts for the DB round-trip but not OpenAI latency
    // (which we're not calling here).
    'http_req_duration': ['p(95)<2000'],

    // Genuine server errors (5xx) must be under 1%.
    // 429s are excluded because they're expected and correct.
    'error_rate': ['rate<0.01'],
  },
};

// ── The virtual user script ───────────────────────────────────────────────────
// k6 runs this function once per virtual user, in a loop, for the
// duration defined in options.stages. Each "virtual user" represents
// one concurrent user hitting your API.
export default function () {
  const payload = JSON.stringify({
    ingredients: ['chicken breast', 'garlic', 'olive oil', 'lemon'],
    maxTime: 30,
    dietaryStyle: 'omnivore',
    skillLevel: 'beginner',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
    // Timeout per request — if the server doesn't respond in 10s,
    // k6 counts it as a failed request.
    timeout: '10s',
  };

  const res = http.post(`${BASE_URL}/api/generate-recipe`, payload, params);

  // 200 = successful generation (first 2 requests per user per day)
  // 429 = daily limit hit — EXPECTED and CORRECT, not an error
  // 400 = validation error — would indicate a bug in this test script
  // 5xx = genuine server error — should never happen
  const isExpectedResponse = res.status === 200 || res.status === 429;

  check(res, {
    'status is 200 or 429': () => isExpectedResponse,
    'response has a body': () => res.body.length > 0,
    'no 5xx errors': () => res.status < 500,
  });

  // Only count genuine errors (not 429) toward the error rate metric.
  errorRate.add(res.status >= 500);

  // Brief pause between requests per virtual user.
  // Without this, each VU hammers as fast as possible — unrealistic
  // and can cause connection pool exhaustion that skews results.
  sleep(0.5);
}
