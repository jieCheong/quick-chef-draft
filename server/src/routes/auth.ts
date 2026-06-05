/*
This file defines all routes under /api/auth
For now, stubs that return placeholder responses

How express routing works:
An express "Router" is mini-app that handles subset of routes.
In index.ts we'll do: app.use('/api/auth', authRouter)
So every route defined here is automatically prefixed with /api/auth

*/

import { Router, Request, Response } from 'express';

const router = Router();
// ─── POST /api/auth/register ──────────────────────────────────────────────────
// Day 4 implementation will:
//   1. Validate email + password from req.body
//   2. Check if email already exists in DB (prevent duplicates)
//   3. Hash the password with bcrypt (NEVER store plain text)
//   4. INSERT new user into the users table
//   5. Sign a JWT with the new user's id
//   6. Return { user, token }
router.post('/register', async (req: Request, res: Response) => {
    const { email, password } = req.body;

    res.json({
        message: 'Register endpoint - not implemented yet',
        received: { email, passwordLength: password?.length },
    });
});
// ─── POST /api/auth/login ─────────────────────────────────────────────────────
// Day 4 implementation will:
//   1. Find user by email in DB
//   2. Compare password with bcrypt.compare()
//   3. If match: sign JWT and return { user, token }
//   4. If no match: return 401 Unauthorized
router.post('/login', async (req: Request, res: Response) => {
    const { email } = req.body;
    res.json({
        message: 'Login endpoint - not implemented yet',
        received: { email },
    });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
// Day 5 implementation will:
//   1. Read the JWT from the Authorization header
//   2. Verify it with jwt.verify()
//   3. Look up the user in the DB by the id in the token payload
//   4. Return the user object (without the password hash)
//
// This is how the frontend checks "am I still logged in?" on app load.
router.get('/me', async (req: Request, res: Response) => {
    res.json({
        message: 'Me endpoint - not implemented yet',
    });
});

export default router;