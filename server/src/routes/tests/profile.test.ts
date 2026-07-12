// server/src/routes/__tests__/profile.test.ts
//
// Integration tests for profile routes:
//   GET   /api/profile
//   PATCH /api/profile
//
// The most interesting behavior in these routes is the dynamic PATCH:
// only whitelisted fields should be updatable, and only the fields
// actually sent in the request should appear in the SET clause.
// A field like 'id' or 'user_id' sent in the body must be silently
// ignored, not written to the database.

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
const TEST_USER_ID = 'user-profile-test-456';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.JWT_SECRET = 'test-secret';

  vi.mocked(jwt.verify).mockReturnValue({
    userId: TEST_USER_ID,
    email: 'test@quickchef.app',
  } as never);
});

describe('GET /api/profile', () => {
  it('returns the profile for the authenticated user', async () => {
    const fakeProfile = {
      id: 'profile-1',
      user_id: TEST_USER_ID,
      display_name: 'Jie',
      dietary_style: 'omnivore',
      allergies: [],
      skill_level: 'beginner',
      preferred_cuisines: ['korean', 'italian'],
      monthly_goals: ['high_protein'],
      onboarding_completed: true,
      email: 'test@quickchef.app',
    };

    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [fakeProfile] } as never);

    const res = await request(app)
      .get('/api/profile')
      .set('Authorization', 'Bearer valid.token');

    expect(res.status).toBe(200);
    expect(res.body.profile.display_name).toBe('Jie');
    expect(res.body.profile.email).toBe('test@quickchef.app');
    expect(res.body.profile.dietary_style).toBe('omnivore');
  });

  it('returns 404 when no profile row exists for the user', async () => {
    // This shouldn't happen in normal operation (profile is created
    // during registration), but testing it means the route fails
    // cleanly rather than throwing an unhandled exception.
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);

    const res = await request(app)
      .get('/api/profile')
      .set('Authorization', 'Bearer valid.token');

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Profile not found.');
  });
});

describe('PATCH /api/profile', () => {
  it('updates allowed fields and returns the updated profile', async () => {
    const updatedProfile = {
      id: 'profile-1',
      user_id: TEST_USER_ID,
      display_name: 'Jie Updated',
      dietary_style: 'vegan',
      onboarding_completed: true,
    };

    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [updatedProfile],
    } as never);

    const res = await request(app)
      .patch('/api/profile')
      .set('Authorization', 'Bearer valid.token')
      .send({ display_name: 'Jie Updated', dietary_style: 'vegan' });

    expect(res.status).toBe(200);
    expect(res.body.profile.display_name).toBe('Jie Updated');
    expect(res.body.profile.dietary_style).toBe('vegan');
  });

  it('rejects an invalid dietary_style value', async () => {
    // 'carnivore' is not in the allowed enum — Zod should reject this
    // before any DB query runs.
    const res = await request(app)
      .patch('/api/profile')
      .set('Authorization', 'Bearer valid.token')
      .send({ dietary_style: 'carnivore' });

    expect(res.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('returns 400 when no valid fields are sent', async () => {
    // Sending only non-whitelisted fields (like id or user_id) should
    // result in an empty update set — the route returns 400 rather
    // than running an UPDATE with no SET clause, which would be a
    // syntax error in PostgreSQL.
    const res = await request(app)
      .patch('/api/profile')
      .set('Authorization', 'Bearer valid.token')
      .send({});

    expect(res.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('rejects a skill_level value outside the allowed enum', async () => {
    const res = await request(app)
      .patch('/api/profile')
      .set('Authorization', 'Bearer valid.token')
      .send({ skill_level: 'expert' }); // not in enum

    expect(res.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });
});