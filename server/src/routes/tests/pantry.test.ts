// server/src/routes/__tests__/pantry.test.ts
//
// Integration tests for the pantry routes:
//   GET    /api/pantry
//   POST   /api/pantry
//   DELETE /api/pantry/:id
//
// All routes require auth — every test sends a valid Bearer token.
// The interesting behaviors to test:
//   - GET returns the user's items in the right shape
//   - POST rejects duplicate item names (case-insensitive check)
//   - POST rejects missing name before hitting the DB
//   - DELETE is user-scoped — can't delete another user's item
//   - DELETE returns 404 when the item doesn't exist

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import pool from '../../db';
import { buildApp } from '../../app';

vi.mock('../../db', () => ({
  default: { query: vi.fn() },
}));

vi.mock('jsonwebtoken');

const app = buildApp();

// Shared valid user context for all tests in this file.
const TEST_USER_ID = 'user-pantry-test-123';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.JWT_SECRET = 'test-secret';

  // Every test assumes a valid logged-in user — requireAuth's own
  // correctness is covered by the Day 16 middleware unit tests.
  vi.mocked(jwt.verify).mockReturnValue({
    userId: TEST_USER_ID,
    email: 'test@quickchef.app',
  } as never);
});

describe('GET /api/pantry', () => {
  it('returns all pantry items for the authenticated user', async () => {
    const fakeItems = [
      { id: 'item-1', user_id: TEST_USER_ID, name: 'Chicken', category: 'proteins', created_at: new Date() },
      { id: 'item-2', user_id: TEST_USER_ID, name: 'Garlic', category: 'vegetables', created_at: new Date() },
    ];

    vi.mocked(pool.query).mockResolvedValueOnce({ rows: fakeItems } as never);

    const res = await request(app)
      .get('/api/pantry')
      .set('Authorization', 'Bearer valid.token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].name).toBe('Chicken');
    expect(res.body[1].name).toBe('Garlic');
  });

  it('returns an empty array when the user has no pantry items', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);

    const res = await request(app)
      .get('/api/pantry')
      .set('Authorization', 'Bearer valid.token');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 401 with no Authorization header', async () => {
    const res = await request(app).get('/api/pantry');
    expect(res.status).toBe(401);
    expect(pool.query).not.toHaveBeenCalled();
  });
});

describe('POST /api/pantry', () => {
  it('adds a new pantry item and returns the created row', async () => {
    const newItem = {
      id: 'item-new',
      user_id: TEST_USER_ID,
      name: 'Salmon',
      category: 'proteins',
      created_at: new Date(),
    };

    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [] } as never)      // duplicate check: not found
      .mockResolvedValueOnce({ rows: [newItem] } as never); // INSERT

    const res = await request(app)
      .post('/api/pantry')
      .set('Authorization', 'Bearer valid.token')
      .send({ name: 'Salmon', category: 'proteins' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Salmon');
    expect(res.body.category).toBe('proteins');
  });

  it('rejects a duplicate item name (case-insensitive)', async () => {
    // Simulate the duplicate check query finding an existing item.
    // The route uses LOWER(name) = LOWER($2) so 'chicken' and 'CHICKEN'
    // are treated as the same item.
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{ id: 'existing-item' }],
    } as never);

    const res = await request(app)
      .post('/api/pantry')
      .set('Authorization', 'Bearer valid.token')
      .send({ name: 'CHICKEN', category: 'proteins' });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('already in your pantry');

    // INSERT must never run if the duplicate check found a match.
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('rejects an empty name before hitting the database', async () => {
    const res = await request(app)
      .post('/api/pantry')
      .set('Authorization', 'Bearer valid.token')
      .send({ name: '', category: 'proteins' });

    expect(res.status).toBe(400);
    // Zod validation runs before any DB query — confirming no DB call
    // proves validation is actually short-circuiting the route.
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('defaults category to "other" when not provided', async () => {
    const newItem = {
      id: 'item-new',
      user_id: TEST_USER_ID,
      name: 'Salt',
      category: 'other',
      created_at: new Date(),
    };

    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [newItem] } as never);

    const res = await request(app)
      .post('/api/pantry')
      .set('Authorization', 'Bearer valid.token')
      .send({ name: 'Salt' }); // no category field

    expect(res.status).toBe(201);
    expect(res.body.category).toBe('other');
  });
});

describe('DELETE /api/pantry/:id', () => {
  it('deletes an item and returns 204 No Content', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{ id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' }],
    } as never);

    const res = await request(app)
      .delete('/api/pantry/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
      .set('Authorization', 'Bearer valid.token');

    expect(res.status).toBe(204);
  });

  it('returns 404 when the item does not exist or belongs to another user', async () => {
    // Empty rows = either no such item, or it exists but belongs to
    // a different user. The route uses WHERE id=$1 AND user_id=$2,
    // so both cases return the same 404 — no information leakage
    // about whether the item exists at all.
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);

    const res = await request(app)
      .delete('/api/pantry/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
      .set('Authorization', 'Bearer valid.token');

    expect(res.status).toBe(404);
  });

  it('rejects a malformed UUID before hitting the database', async () => {
    const res = await request(app)
      .delete('/api/pantry/not-a-valid-uuid')
      .set('Authorization', 'Bearer valid.token');

    expect(res.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });
});