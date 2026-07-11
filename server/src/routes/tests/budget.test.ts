import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// See generate.test.ts for why vi.hoisted is required here: generate.ts's
// sibling route (budget.ts) also instantiates `const openai = new OpenAI(...)`
// at module load time, so the mock `create` spy must exist before vi.mock's
// factory runs.
const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

vi.mock('../../db', () => ({
  default: {
    query: vi.fn(),
  },
}));

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

vi.mock('jsonwebtoken');

import pool from '../../db';
import { buildApp } from '../../app';

const app = buildApp();

const FAKE_BUDGET_ROW = {
  id: 'budget-1',
  user_id: 'user-123',
  month: 7,
  year: 2026,
  budget_amount: '300.00',
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-01T00:00:00.000Z',
};

const FAKE_TRANSACTION_ROW = {
  id: 'txn-1',
  user_id: 'user-123',
  budget_id: 'budget-1',
  amount: '25.50',
  description: 'Groceries',
  transaction_date: '2026-07-05T00:00:00.000Z',
  created_at: '2026-07-05T00:00:00.000Z',
};

describe('/api/budget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
    vi.mocked(jwt.verify).mockReturnValue({
      userId: 'user-123',
      email: 'test@quickchef.app',
    } as never);
  });

  describe('GET /api/budget', () => {
    it('returns a null budget and empty transactions when none exist yet', async () => {
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);

      const res = await request(app)
        .get('/api/budget')
        .set('Authorization', 'Bearer fake.token.here');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ budget: null, transactions: [] });
    });

    it('returns the budget and its transactions when they exist', async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [FAKE_BUDGET_ROW] } as never)
        .mockResolvedValueOnce({ rows: [FAKE_TRANSACTION_ROW] } as never);

      const res = await request(app)
        .get('/api/budget')
        .set('Authorization', 'Bearer fake.token.here');

      expect(res.status).toBe(200);
      expect(res.body.budget).toEqual(FAKE_BUDGET_ROW);
      expect(res.body.transactions).toEqual([FAKE_TRANSACTION_ROW]);
    });

    it('rejects requests with no Authorization header', async () => {
      const res = await request(app).get('/api/budget');

      expect(res.status).toBe(401);
      expect(pool.query).not.toHaveBeenCalled();
    });
  });

  describe('PUT /api/budget', () => {
    it('creates a new budget and returns it', async () => {
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [FAKE_BUDGET_ROW] } as never);

      const res = await request(app)
        .put('/api/budget')
        .set('Authorization', 'Bearer fake.token.here')
        .send({ budget_amount: 300 });

      expect(res.status).toBe(200);
      expect(res.body.budget).toEqual(FAKE_BUDGET_ROW);

      // The upsert relies on ON CONFLICT (user_id, month, year) — assert
      // the query actually targets that clause, not just that some query ran.
      const [sql] = vi.mocked(pool.query).mock.calls[0];
      expect(sql).toContain('ON CONFLICT (user_id, month, year)');
    });

    it('upserts (updates) when a budget already exists for that month', async () => {
      const updated = { ...FAKE_BUDGET_ROW, budget_amount: '400.00' };
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [updated] } as never);

      const res = await request(app)
        .put('/api/budget')
        .set('Authorization', 'Bearer fake.token.here')
        .send({ budget_amount: 400 });

      expect(res.status).toBe(200);
      expect(res.body.budget.budget_amount).toBe('400.00');
    });

    it('rejects a zero or negative budget_amount before touching the database', async () => {
      const res = await request(app)
        .put('/api/budget')
        .set('Authorization', 'Bearer fake.token.here')
        .send({ budget_amount: 0 });

      expect(res.status).toBe(400);
      expect(res.body.errors.budget_amount).toBeDefined();
      expect(pool.query).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/budget/transactions', () => {
    it('returns 400 when no budget exists for the current month', async () => {
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);

      const res = await request(app)
        .post('/api/budget/transactions')
        .set('Authorization', 'Bearer fake.token.here')
        .send({ amount: 20 });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Set a budget');
    });

    it('inserts and returns a transaction when a budget exists', async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ id: 'budget-1' }] } as never) // budget lookup
        .mockResolvedValueOnce({ rows: [FAKE_TRANSACTION_ROW] } as never); // insert

      const res = await request(app)
        .post('/api/budget/transactions')
        .set('Authorization', 'Bearer fake.token.here')
        .send({ amount: 25.5, description: 'Groceries' });

      expect(res.status).toBe(201);
      expect(res.body).toEqual(FAKE_TRANSACTION_ROW);
    });

    it('rejects a non-positive amount before touching the database', async () => {
      const res = await request(app)
        .post('/api/budget/transactions')
        .set('Authorization', 'Bearer fake.token.here')
        .send({ amount: -5 });

      expect(res.status).toBe(400);
      expect(pool.query).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/budget/recommendations', () => {
    it('returns 400 when no budget is set', async () => {
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never); // budget lookup

      const res = await request(app)
        .post('/api/budget/recommendations')
        .set('Authorization', 'Bearer fake.token.here')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Set a budget');
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('returns 400 when the profile has no monthly goals', async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ id: 'budget-1', budget_amount: '300.00' }] } as never) // budget lookup
        .mockResolvedValueOnce({ rows: [{ monthly_goals: [] }] } as never); // profile lookup

      const res = await request(app)
        .post('/api/budget/recommendations')
        .set('Authorization', 'Bearer fake.token.here')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('monthly goals');
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('calls OpenAI and returns parsed recommendations when budget + goals exist', async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ id: 'budget-1', budget_amount: '300.00' }] } as never) // budget lookup
        .mockResolvedValueOnce({ rows: [{ monthly_goals: ['more_protein'] }] } as never) // profile lookup
        .mockResolvedValueOnce({ rows: [{ spent: '50.00' }] } as never); // spent sum

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                recommendations: [
                  { category: 'Proteins', items: ['chicken thighs'], estimated_cost: 15 },
                ],
              }),
            },
          },
        ],
      } as never);

      const res = await request(app)
        .post('/api/budget/recommendations')
        .set('Authorization', 'Bearer fake.token.here')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.recommendations).toHaveLength(1);
      expect(res.body.recommendations[0].category).toBe('Proteins');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('rejects requests with no Authorization header', async () => {
      const res = await request(app).post('/api/budget/recommendations').send({});

      expect(res.status).toBe(401);
      expect(pool.query).not.toHaveBeenCalled();
    });
  });
});
