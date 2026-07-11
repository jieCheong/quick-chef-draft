import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// ── Shared OpenAI spy ──────────────────────────────────────────────────────────
// vi.hoisted runs before vi.mock factory functions, so `mockCreate` can be
// referenced inside the mock factory below. Without hoisting, the variable
// would be undefined when the factory runs (vi.mock is hoisted to the top of
// the file regardless of where you write it).
//
// We need ONE shared vi.fn() for `create` because generate.ts instantiates
// `const openai = new OpenAI(...)` at module load time (a module-level singleton).
// If the mock factory returned a fresh object on each `new OpenAI()` call, the
// instance created in the test and the instance used by the route would have
// separate spies — mocking one wouldn't affect the other.
const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

// ── Mock PostgreSQL pool ───────────────────────────────────────────────────────
vi.mock('../../db', () => ({
  default: {
    query: vi.fn(),
  },
}));

// ── Mock the OpenAI SDK ────────────────────────────────────────────────────────
// Uses a regular `function` (not an arrow function) so that Vitest 4.x can
// call it with `new`. Arrow functions lack [[Construct]] and throw when used
// as constructors.
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    };
  }),
}));

// Mock jsonwebtoken so requireAuth passes deterministically in every test.
vi.mock('jsonwebtoken');

import pool from '../../db';
import { buildApp } from '../../app';

const app = buildApp();

// A realistic fake OpenAI response shape — what completion.choices[0]
// .message.content looks like in production, pre-JSON.parse.
const FAKE_OPENAI_RESPONSE = {
  choices: [
    {
      message: {
        content: JSON.stringify({
          recipes: [
            {
              title: 'Garlic Butter Chicken',
              description: 'A quick weeknight dinner.',
              cooking_time_minutes: 25,
              difficulty: 'easy',
              servings: 2,
              is_quick_meal: false,
              cuisines: ['american'],
              goal_alignment: ['high_protein'],
              ingredients: [{ name: 'chicken breast', amount: '200', unit: 'g' }],
              instructions: [{ step: 1, instruction: 'Season the chicken.', duration_minutes: 2 }],
              nutrition: { calories: 420, protein: 35, carbs: 10, fat: 18, fiber: 2 },
            },
          ],
        }),
      },
    },
  ],
};

describe('POST /api/generate-recipe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';

    // Every test in this file assumes a valid logged-in user —
    // requireAuth's own correctness is already covered by Day 16's tests.
    vi.mocked(jwt.verify).mockReturnValue({
      userId: 'user-123',
      email: 'test@quickchef.app',
    } as never);
  });

  it('allows generation when usage is under the daily limit', async () => {
    // The route now does ONE atomic reserve-and-increment query (an
    // INSERT..ON CONFLICT DO UPDATE..WHERE..RETURNING), not a separate
    // check then a separate increment. RETURNING a row means the
    // reservation succeeded — used: 1 reflects this request's own
    // increment (first generation of the day for this user).
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{ generations_used: 1, max_generations: 2 }],
    } as never); // reserveGenerationSlot INSERT..ON CONFLICT..RETURNING

    mockCreate.mockResolvedValue(FAKE_OPENAI_RESPONSE as never);

    const res = await request(app)
      .post('/api/generate-recipe')
      .set('Authorization', 'Bearer fake.token.here')
      .send({ ingredients: ['chicken', 'garlic'], maxTime: 30 });

    expect(res.status).toBe(200);
    expect(res.body.recipes).toHaveLength(1);
    expect(res.body.recipes[0].title).toBe('Garlic Butter Chicken');
    expect(res.body.usage).toEqual({ used: 1, max: 2, remaining: 1 });

    // Exactly one query for the whole usage check+reserve — proves
    // there's no separate increment call left over from the old flow.
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('returns 429 and NEVER calls OpenAI when the user is already at the daily limit', async () => {
    // RETURNING zero rows is how reserveGenerationSlot signals "already
    // at limit" — the DO UPDATE's WHERE clause failed, so ON CONFLICT
    // behaved as DO NOTHING. The route then falls back to a plain
    // SELECT (currentUsage) just to report the numbers in the 429 body.
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [] } as never) // reserveGenerationSlot: 0 rows = at limit
      .mockResolvedValueOnce({
        rows: [{ generations_used: 2, max_generations: 2 }],
      } as never); // currentUsage SELECT for the error message

    const res = await request(app)
      .post('/api/generate-recipe')
      .set('Authorization', 'Bearer fake.token.here')
      .send({ ingredients: ['chicken'], maxTime: 30 });

    expect(res.status).toBe(429);
    expect(res.body.message).toContain('Daily limit reached');
    expect(res.body.used).toBe(2);
    expect(res.body.max).toBe(2);

    // THIS is the assertion that actually matters for cost control:
    // proving the expensive external call was skipped entirely, not
    // just that the user got an error message. A bug where the route
    // returns 429 to the user AFTER still calling OpenAI would pass
    // every status-code assertion but silently burn API credits —
    // this line is what catches that specific bug.
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('releases the reserved slot when OpenAI fails, so a failed attempt does not cost the user a generation', async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({
        rows: [{ generations_used: 1, max_generations: 2 }],
      } as never) // reserveGenerationSlot succeeds
      .mockResolvedValueOnce({ rows: [] } as never); // releaseGenerationSlot UPDATE

    // status: 400 is deliberately NOT retryable (see isRetryableOpenAIError)
    // so this fails on the first attempt instead of waiting through
    // retryWithBackoff's exponential delays.
    mockCreate.mockRejectedValue(Object.assign(new Error('OpenAI down'), { status: 400 }) as never);

    const res = await request(app)
      .post('/api/generate-recipe')
      .set('Authorization', 'Bearer fake.token.here')
      .send({ ingredients: ['rice'], maxTime: 30 });

    expect(res.status).toBe(500);

    // The 2nd+3rd queries are the retryWithBackoff attempts hitting
    // OpenAI (mocked, not real pool.query calls) — the 2nd pool.query
    // call is specifically the release UPDATE, proven by its SQL text.
    const [releaseSql] = vi.mocked(pool.query).mock.calls[1];
    expect(releaseSql).toContain('generations_used = GREATEST(generations_used - 1, 0)');
  });

  it('rejects requests with no ingredients before reaching the database', async () => {
    // No pool.query mock is set up at all for this test. If the route
    // incorrectly let this request past validation and tried to query
    // the database, the mock would return undefined and the test would
    // fail with a confusing error — which is itself a useful signal.
    // The CORRECT behavior is that validate() rejects this before any
    // route logic, including the database check, ever runs.
    const res = await request(app)
      .post('/api/generate-recipe')
      .set('Authorization', 'Bearer fake.token.here')
      .send({ ingredients: [], maxTime: 30 });

    expect(res.status).toBe(400);
    expect(res.body.errors.ingredients).toContain('At least one ingredient');
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('rejects maxTime outside the allowed 5-180 range', async () => {
    const res = await request(app)
      .post('/api/generate-recipe')
      .set('Authorization', 'Bearer fake.token.here')
      .send({ ingredients: ['rice'], maxTime: 999 });

    expect(res.status).toBe(400);
    expect(res.body.errors.maxTime).toBeDefined();
  });

  it('returns 500 gracefully when OpenAI returns malformed JSON', async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({
        rows: [{ generations_used: 1, max_generations: 2 }],
      } as never) // reserveGenerationSlot succeeds
      .mockResolvedValueOnce({ rows: [] } as never); // releaseGenerationSlot UPDATE, since parsing fails after reserving

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'this is not valid json at all' } }],
    } as never);

    const res = await request(app)
      .post('/api/generate-recipe')
      .set('Authorization', 'Bearer fake.token.here')
      .send({ ingredients: ['rice'], maxTime: 30 });

    // The route must fail safely with a clear message, not crash the
    // process or leak a raw stack trace to the client.
    expect(res.status).toBe(500);
    expect(res.body.message).toBeDefined();
  });

  it('rejects requests with no Authorization header before validation even runs', async () => {
    const res = await request(app)
      .post('/api/generate-recipe')
      .send({ ingredients: ['rice'], maxTime: 30 });

    expect(res.status).toBe(401);
    expect(pool.query).not.toHaveBeenCalled();
  });
});