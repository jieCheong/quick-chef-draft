// server/src/middleware/auth.ts
//
// CHANGE FROM ORIGINAL: after a token verifies successfully, we now
// also call req.log = req.log.child({ userId }) — this creates a CHILD
// logger that automatically includes userId on every subsequent log
// line for this request, without every individual route having to
// remember to pass userId into req.log.info({ userId }, '...') by hand.
//
// req.log only exists because pino-http (wired in app.ts) attaches it
// to every request BEFORE any route or middleware runs. requireAuth
// runs after that, so req.log is guaranteed to exist here.

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId: string;
      userEmail: string;
    }
  }
}

interface JwtPayload {
  userId: string;
  email: string;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'No token provided. Please log in.' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

    req.userId = payload.userId;
    req.userEmail = payload.email;

    // From this point forward in the request lifecycle, every
    // req.log.info(...) or req.log.error(...) call — including the
    // final "request completed" line pino-http logs automatically —
    // includes userId. This is what makes "show me everything that
    // happened during this user's failed request" possible to search
    // for in Railway, instead of only having an anonymous request id.
    req.log = req.log.child({ userId: payload.userId });

    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid or expired token. Please log in again.' });
  }
}