// server/src/routes/__tests__/auth.test.ts
//
// Integration tests for POST /api/auth/register and POST /api/auth/login.
// Same pattern as generate.test.ts: real Express app via buildApp(),
// real HTTP requests via supertest, external dependencies mocked at
// the module boundary (pg Pool, bcryptjs, jsonwebtoken).
//
// WHY MOCK bcrypt INSTEAD OF LETTING IT RUN FOR REAL:
// bcrypt.hash with 10 salt rounds takes roughly 80-100ms BY DESIGN —
// that deliberate slowness is what makes it resistant to brute force.
// That's exactly the property we don't want paying for in a test suite
// that should run in milliseconds. Mocking bcrypt.hash/.compare to
// return instantly lets us test OUR logic (do we call compare with the
// right arguments, do we reject on a false result) without paying the
// real cryptographic cost on every test run.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

vi.mock('../../db', () => ({
  default: {
    query: vi.fn(),
    connect: vi.fn(),
  },
}));

vi.mock('bcryptjs');
vi.mock('jsonwebtoken');

import pool from '../../db';
import { buildApp } from '../../app';

const app = buildApp();

// The register route uses pool.connect() to get a dedicated client for
// the BEGIN/INSERT/INSERT/COMMIT transaction, NOT pool.query() directly.
// This helper builds a fake client matching that shape, since mocking
// it incorrectly (e.g. assuming pool.query is used) would make every
// register test fail for a reason that has nothing to do with real bugs.
function mockTransactionClient() {
  const client = {
    query: vi.fn(),
    release: vi.fn(),
  };
  vi.mocked(pool.connect).mockResolvedValue(client as never);
  return client;
}

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
    vi.mocked(jwt.sign).mockReturnValue('fake.jwt.token' as never);
  });

  it('rejects a password under 6 characters before touching the database', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'new@quickchef.app', password: '123' });

    expect(res.status).toBe(400);
    expect(res.body.errors.password).toBeDefined();
    // The cheapest check (schema validation) must run before the
    // expensive ones (a database round trip). If this fired anyway,
    // it would mean validation isn't actually short-circuiting the route.
    expect(pool.query).not.toHaveBeenCalled();
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('rejects registration when the email already exists, before hashing the password', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{ id: 'existing-user-id' }],
    } as never);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'taken@quickchef.app', password: 'validpass123' });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('already exists');

    // bcrypt.hash is deliberately slow — confirming it was never called
    // proves the duplicate check short-circuits BEFORE that cost is paid,
    // not just that the user eventually gets the right error message.
    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('creates a user and profile in one transaction, and returns a token', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never); // no existing user
    vi.mocked(bcrypt.hash).mockResolvedValue('$2b$10$fakehash' as never);

    const client = mockTransactionClient();
    client.query
      .mockResolvedValueOnce(undefined as never) // BEGIN
      .mockResolvedValueOnce({
        rows: [{ id: 'new-user-id', email: 'new@quickchef.app', created_at: new Date() }],
      } as never) // INSERT users
      .mockResolvedValueOnce(undefined as never) // INSERT profiles
      .mockResolvedValueOnce(undefined as never); // COMMIT

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'NEW@QuickChef.app', password: 'validpass123', display_name: 'Jie' });

    expect(res.status).toBe(201);
    expect(res.body.token).toBe('fake.jwt.token');
    expect(res.body.user.email).toBe('new@quickchef.app');

    // Confirm BOTH inserts ran inside the SAME transaction client,
    // in the right order, and that it was committed rather than left open.
    expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(client.query.mock.calls[1][0]).toContain('INSERT INTO users');
    expect(client.query.mock.calls[2][0]).toContain('INSERT INTO user_profiles');
    expect(client.query).toHaveBeenNthCalledWith(4, 'COMMIT');

    // The client must always be released back to the pool, success or not —
    // a leaked client is a slow, silent way to exhaust the connection pool.
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('rolls back the transaction if the profile insert fails, leaving no orphaned user', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);
    vi.mocked(bcrypt.hash).mockResolvedValue('$2b$10$fakehash' as never);

    const client = mockTransactionClient();
    client.query
      .mockResolvedValueOnce(undefined as never) // BEGIN
      .mockResolvedValueOnce({
        rows: [{ id: 'new-user-id', email: 'new@quickchef.app' }],
      } as never) // INSERT users succeeds
      .mockRejectedValueOnce(new Error('profiles insert failed')) // INSERT profiles fails
      .mockResolvedValueOnce(undefined as never); // ROLLBACK

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'new@quickchef.app', password: 'validpass123' });

    expect(res.status).toBe(500);

    // This is the actual guarantee a transaction exists to provide:
    // when the second insert fails, the client must issue ROLLBACK,
    // not silently leave a users row with no matching profiles row.
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledOnce();
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
    vi.mocked(jwt.sign).mockReturnValue('fake.jwt.token' as never);
  });

  it('returns the same generic error for a nonexistent email as for a wrong password', async () => {
    // Case A: no such user at all.
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);

    const noUserRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@quickchef.app', password: 'whatever123' });

    // Case B: user exists, password is wrong.
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{ id: 'u1', email: 'real@quickchef.app', password_hash: '$2b$10$real' }],
    } as never);
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

    const wrongPassRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'real@quickchef.app', password: 'wrongpassword' });

    // Both must be 401 with the IDENTICAL message. If a real attacker
    // could distinguish "no such email" from "wrong password" by
    // response content, they could enumerate valid registered emails
    // one guess at a time — this test exists specifically to prevent
    // that distinction from ever being reintroduced by a future edit.
    expect(noUserRes.status).toBe(401);
    expect(wrongPassRes.status).toBe(401);
    expect(noUserRes.body.message).toBe(wrongPassRes.body.message);
  });

  it('logs in successfully and returns a token on correct credentials', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{
        id: 'u1',
        email: 'real@quickchef.app',
        password_hash: '$2b$10$real',
        display_name: 'Jie',
        onboarding_completed: true,
      }],
    } as never);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'real@quickchef.app', password: 'correctpassword' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBe('fake.jwt.token');
    expect(res.body.user.onboarding_completed).toBe(true);

    // Confirm compare was called with the RAW password the user sent
    // and the stored hash — not, for example, comparing two hashes
    // directly, which would always fail since bcrypt salts differ.
    expect(bcrypt.compare).toHaveBeenCalledWith('correctpassword', '$2b$10$real');
  });

  it('lowercases email before querying, so login is case-insensitive', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);

    await request(app)
      .post('/api/auth/login')
      .send({ email: 'Real@QuickChef.APP', password: 'whatever123' });

    expect(pool.query).toHaveBeenCalledWith(
      expect.any(String),
      ['real@quickchef.app']
    );
  });
});

// requireAuth itself (middleware/auth.ts) has no dedicated test file — every
// other suite mocks jsonwebtoken entirely and never exercises jwt.verify's
// failure paths. GET /api/auth/me is used here purely as a stand-in for
// "any requireAuth-protected route": these tests are about the middleware
// short-circuiting BEFORE the route handler runs, not about /me specifically.
describe('requireAuth middleware (exercised via GET /api/auth/me)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  it('rejects a request with no Authorization header at all', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.message).toContain('No token provided');
    // Confirms the rejection happens in the middleware, before the route
    // handler ever gets a chance to query the database.
    expect(jwt.verify).not.toHaveBeenCalled();
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('rejects a header missing the "Bearer " prefix', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'sometoken.without.prefix');

    expect(res.status).toBe(401);
    expect(res.body.message).toContain('No token provided');
    expect(jwt.verify).not.toHaveBeenCalled();
  });

  it('rejects an expired token', async () => {
    vi.mocked(jwt.verify).mockImplementation(() => {
      throw new Error('jwt expired');
    });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer an.expired.token');

    expect(res.status).toBe(401);
    expect(res.body.message).toContain('Invalid or expired token');
    // The DB is never touched once verification fails — a stale/expired
    // token must not reach route logic just because it's well-formed.
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('rejects a token with a tampered signature', async () => {
    vi.mocked(jwt.verify).mockImplementation(() => {
      throw new Error('invalid signature');
    });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer header.payload.wrongsignature');

    expect(res.status).toBe(401);
    expect(res.body.message).toContain('Invalid or expired token');
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('rejects a token whose payload was tampered with (fails signature check)', async () => {
    // A tampered payload (e.g. swapping in a different userId) changes the
    // signed content, so it fails signature verification exactly like a
    // wrong-signature token — jwt.verify can't tell "re-signed" apart from
    // "edited then not re-signed"; both surface as the same verify failure.
    vi.mocked(jwt.verify).mockImplementation(() => {
      throw new Error('invalid signature');
    });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer header.tamperedpayload.originalsignature');

    expect(res.status).toBe(401);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('accepts a valid token and attaches userId for the route handler to use', async () => {
    vi.mocked(jwt.verify).mockReturnValue({ userId: 'u1', email: 'real@quickchef.app' } as never);
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{ id: 'u1', email: 'real@quickchef.app', display_name: 'Jie', onboarding_completed: true }],
    } as never);

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer a.valid.token');

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe('u1');
    // Confirms requireAuth passed the decoded userId through to the route,
    // which used it as the query parameter.
    expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['u1']);
  });
});