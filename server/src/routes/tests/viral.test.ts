// server/src/routes/__tests__/viral.test.ts
//
// Tests for GET /api/viral-recipes — the public endpoint.
//
// This is the simplest route in the app: no auth, no mutation,
// just a SELECT of active viral recipes. Three tests are enough:
// it returns data when rows exist, an empty array when none do,
// and critically — it returns 200 with NO Authorization header,
// confirming it's actually public and requireAuth is not applied.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import pool from '../../db';
import { buildApp } from '../../app';

vi.mock('../../db', () => ({
  default: { query: vi.fn() },
}));

const app = buildApp();

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/viral-recipes', () => {
  it('returns active viral recipes without requiring authentication', async () => {
    const fakeRecipes = [
      {
        id: 'viral-1',
        title: 'Dubai Chocolate Bark',
        description: 'The TikTok-famous chocolate treat',
        image_url: null,
        tags: ['viral', 'dessert', 'tiktok'],
        nutrition: { calories: 280, protein: 5 },
        week_start: '2024-01-01',
        week_end: '2024-01-07',
        created_at: new Date(),
      },
    ];

    vi.mocked(pool.query).mockResolvedValueOnce({ rows: fakeRecipes } as never);

    // No Authorization header — this is the key assertion for a public route.
    const res = await request(app).get('/api/viral-recipes');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Dubai Chocolate Bark');
    expect(res.body[0].tags).toContain('viral');
  });

  it('returns an empty array when no viral recipes are active', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);

    const res = await request(app).get('/api/viral-recipes');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('only queries for active=true recipes', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);

    await request(app).get('/api/viral-recipes');

    // The SQL query must filter by active=true so inactive/scheduled
    // recipes don't leak into the public endpoint before their time.
    const queryText = vi.mocked(pool.query).mock.calls[0][0] as string;
    expect(queryText).toContain('active = true');
  });
});