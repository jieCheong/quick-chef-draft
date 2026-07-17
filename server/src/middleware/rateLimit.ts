import { rateLimit } from 'express-rate-limit';

// Brute-force guard for /api/auth/login and /api/auth/register. Keyed by IP
// (express-rate-limit's default), so 5 failed or successful attempts in a
// 15-minute window exhausts it — enough for a real user who mistypes a
// password a couple times, not enough to run a password list against one
// account.
//
// Skipped in tests: it's keyed by IP and shared across every request the
// test app handles, so a single test file exercising several register/login
// cases in a row would otherwise trip it and fail on request count alone,
// not on anything the test is actually asserting.
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { message: 'Too many attempts. Please try again in 15 minutes.' },
});
