import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { requireAuth } from '../auth';

vi.mock('jsonwebtoken');

function mockRequest(authHeader?: string): Request {
  const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn().mockReturnThis() };
  return {
    headers: { authorization: authHeader },
    log,
  } as unknown as Request;
}

function mockResponse(): Response {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('requireAuth middleware', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  it('rejects a request with no Authorization header', () => {
    const req = mockRequest(undefined);
    const res = mockResponse();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: 'No token provided. Please log in.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a header that does not start with "Bearer "', () => {
    const req = mockRequest('Token abc123');
    const res = mockResponse();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects an expired or tampered token', () => {
    const req = mockRequest('Bearer some.invalid.token');
    const res = mockResponse();

    vi.mocked(jwt.verify).mockImplementation(() => {
      throw new Error('jwt expired');
    });

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Invalid or expired token. Please log in again.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts a valid token and attaches userId + userEmail to req', () => {
    const req = mockRequest('Bearer valid.token.here');
    const res = mockResponse();

    vi.mocked(jwt.verify).mockReturnValue({
      userId: 'user-123',
      email: 'test@quickchef.app',
    } as never);

    requireAuth(req, res, next);

    expect(req.userId).toBe('user-123');
    expect(req.userEmail).toBe('test@quickchef.app');
    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('extracts only the token portion, not the "Bearer " prefix', () => {
    const req = mockRequest('Bearer abc.def.ghi');
    const res = mockResponse();

    vi.mocked(jwt.verify).mockReturnValue({
      userId: 'user-456',
      email: 'someone@quickchef.app',
    } as never);

    requireAuth(req, res, next);

    expect(jwt.verify).toHaveBeenCalledWith('abc.def.ghi', expect.any(String));
  });
});
