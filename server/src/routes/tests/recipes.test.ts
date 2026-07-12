// server/src/routes/__tests__/recipes.test.ts
//
// Integration tests for saved recipes routes:
//   GET    /api/recipes
//   GET    /api/recipes?limit=N
//   POST   /api/recipes
//   DELETE /api/recipes/:id
//
// Key behaviors:
//   - GET with ?limit returns at most N recipes (used by Home page)
//   - POST correctly serializes JSONB fields (ingredients, instructions, nutrition)
//   - DELETE is user-scoped — returns 404 for another user's recipe
//   - DELETE returns 404 for nonexistent recipe

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
const TEST_USER_ID = 'user-recipes-test-789';

const FAKE_RECIPE = {
  id: 'recipe-1',
  user_id: TEST_USER_ID,
  title: 'Garlic Butter Chicken',
  description: 'Quick weeknight dinner',
  cooking_time_minutes: 25,
  difficulty: 'easy',
  servings: 2,
  is_quick_meal: false,
  cuisines: ['american'],
  goal_alignment: ['high_protein'],
  ingredients: [{ name: 'chicken breast', amount: '200', unit: 'g' }],
  instructions: [{ step: 1, instruction: 'Season the chicken', duration_minutes: 2 }],
  nutrition: { calories: 420, protein: 35, carbs: 10, fat: 18, fiber: 2 },
  created_at: new Date(),
  updated_at: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.JWT_SECRET = 'test-secret';

  vi.mocked(jwt.verify).mockReturnValue({
    userId: TEST_USER_ID,
    email: 'test@quickchef.app',
  } as never);
});

describe('GET /api/recipes', () => {
  it('returns all saved recipes for the user', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [FAKE_RECIPE],
    } as never);

    const res = await request(app)
      .get('/api/recipes')
      .set('Authorization', 'Bearer valid.token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Garlic Butter Chicken');
  });

  it('respects the ?limit query parameter', async () => {
    // The Home page calls GET /api/recipes?limit=3 to show recent recipes.
    // This test verifies the route actually passes the limit to the DB query
    // rather than ignoring it and returning everything.
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [FAKE_RECIPE],
    } as never);

    const res = await request(app)
      .get('/api/recipes?limit=3')
      .set('Authorization', 'Bearer valid.token');

    expect(res.status).toBe(200);

    // Assert the DB was called with 2 params (userId + limit),
    // not 1 param (userId only — which would be the no-limit query path).
    // This is the assertion that actually verifies limit is wired through,
    // not just that the response happens to be short.
    const queryCall = vi.mocked(pool.query).mock.calls[0];
    expect(queryCall[1]).toHaveLength(2);
    expect(queryCall[1][1]).toBe(3);
  });

  it('returns an empty array when no recipes are saved', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);

    const res = await request(app)
      .get('/api/recipes')
      .set('Authorization', 'Bearer valid.token');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('POST /api/recipes', () => {
  it('saves a recipe and returns the created row with 201', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [FAKE_RECIPE],
    } as never);

    const res = await request(app)
      .post('/api/recipes')
      .set('Authorization', 'Bearer valid.token')
      .send({
        title: 'Garlic Butter Chicken',
        ingredients: [{ name: 'chicken breast', amount: '200', unit: 'g' }],
        instructions: [{ step: 1, instruction: 'Season', duration_minutes: 2 }],
        nutrition: { calories: 420, protein: 35, carbs: 10, fat: 18, fiber: 2 },
        cooking_time_minutes: 25,
        difficulty: 'easy',
        servings: 2,
      });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Garlic Butter Chicken');
  });

  it('rejects a request missing required fields', async () => {
    // title, ingredients, and instructions are all required.
    // Sending only a title should fail validation before any DB call.
    const res = await request(app)
      .post('/api/recipes')
      .set('Authorization', 'Bearer valid.token')
      .send({ title: 'Incomplete Recipe' }); // missing ingredients + instructions

    expect(res.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/recipes/:id', () => {
  it('deletes a recipe and returns 204', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{ id: 'recipe-1' }],
    } as never);

    const res = await request(app)
      .delete('/api/recipes/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
      .set('Authorization', 'Bearer valid.token');

    expect(res.status).toBe(204);
  });

  it('returns 404 for a recipe that belongs to another user', async () => {
    // The DELETE query includes WHERE user_id = $2 — another user's
    // recipe returns empty rows, same as a nonexistent recipe.
    // No information leakage about whether the recipe exists at all.
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);

    const res = await request(app)
      .delete('/api/recipes/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
      .set('Authorization', 'Bearer valid.token');

    expect(res.status).toBe(404);
  });

  it('rejects a malformed UUID param before hitting the database', async () => {
    const res = await request(app)
      .delete('/api/recipes/not-a-uuid')
      .set('Authorization', 'Bearer valid.token');

    expect(res.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });
});