// load-test/health-check.js
//
// Baseline load test — hits GET /health with no auth, no DB, no business logic.
// This gives you the theoretical ceiling of your server's throughput.
// Compare these numbers to recipe-generation.js to see the overhead
// your middleware stack and DB calls actually add.
//
// Run: k6 run load-test/health-check.js

import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = 'http://localhost:3002';

export const options = {
  stages: [
    { duration: '10s', target: 20 },
    { duration: '30s', target: 50 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    'http_req_duration': ['p(95)<200'],  // health check should be fast
    'http_req_failed': ['rate<0.01'],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/health`);
  check(res, {
    'status is 200': () => res.status === 200,
    'body contains ok': () => res.json('status') === 'ok',
  });
}
