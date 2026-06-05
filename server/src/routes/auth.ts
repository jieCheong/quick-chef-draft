/*
This file defines all routes under /api/auth
For now, stubs that return placeholder responses

How express routing works:
An express "Router" is mini-app that handles subset of routes.
In index.ts we'll do: app.use('/api/auth', authRouter)
So every route defined here is automatically prefixed with /api/auth

*/

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Helper - sign a jwt
// jwt.sign() takes: payload, secret, and options
// '7d' => after 7 days the user must log in again
function signToken(userId: string, email: string): string {
    return jwt.sign(
        {userId, email},
        process.env.JWT_SECRET!,
        {expiresIn: '7d'}
    );
}

// ─── POST /api/auth/register ──────────────────────────────────────────────────
// Day 4 implementation will:
//   1. Validate email + password from req.body
//   2. Check if email already exists in DB (prevent duplicates)
//   3. Hash the password with bcrypt (NEVER store plain text)
//   4. INSERT new user into the users table
//   5. Sign a JWT with the new user's id
//   6. Return { user, token }
router.post('/register', async (req: Request, res: Response): Promise<void> => {
    const { email, password, display_name } = req.body;

    // input validation
    if (!email || !password) {
        res.status(400).json({message: 'Email and password are required.'});
        return;
    }
    if (password.length < 6) {
        res.status(400).json({message: 'Password must be at least 6 characters.'});
        return;
    }

    // basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        res.status(400).json({message: 'Please enter a valid email address.'});
        return;
    }
    
    try {
        // check for duplicate email, lowercase email for comparison
        const existingUser = await pool.query(
            'SELECT id FROM users WHERE email = $1',
            [email.toLowerCase()]
        );
        if (existingUser.rows.length > 0) {
            res.status(409).json({message: 'An account with this email already exists.'});
            return;
        }
        // hash the password
        const password_hash = await bcrypt.hash(password, 10);
        // insert user + profile in a transaction
        const client = await pool.connect();

        try {
            await client.query('BEGIN');
            const userResult = await client.query(
                `INSERT INTO users (email, password_hash)
                 VALUES ($1, $2)
                 RETURNING id, email, created_at`,
                 [email.toLowerCase(), password_hash]
            );
            const newUser = userResult.rows[0];

            // create empty profile row for the new user
            await client.query(
                `INSERT INTO user_profiles (user_id, display_name)
                VALUES ($1, $2)`,
                [newUser.id, display_name || null]
            );
            await client.query('COMMIT');
            // sign and return token
            const token = signToken(newUser.id, newUser.email);

            res.status(201).json({
                user: {
                    id: newUser.id,
                    email: newUser.email,
                    display_name: display_name || null,
                },
                token,
            });
        } catch (innerError) {
            await client.query('ROLLBACK');
            throw innerError;
        } finally {
            client.release();
        } 
    } catch (error) {
        console.error('Register error: ', error);
        res.status(500).json({message: 'Something went wrong, please try again.'});
    }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
//   1. Find user by email in DB
//   2. Compare password with bcrypt.compare()
//   3. If match: sign JWT and return { user, token }
//   4. If no match: return 401 Unauthorized
router.post('/login', async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body;

    if (!email || !password) {
        res.status(400).json({message: 'Email and password are required.'});
        return;
    }

    try {
        // find user by email
        const result = await pool.query(
            `SELECT u.id, u.email, u.password_hash, p.display_name, p.onboarding_completed
            FROM users u
            LEFT JOIN user_profiles p ON p.user_id = u.id
            WHERE u.email = $1`,
            [email.toLowerCase()]
        );

        const user = result.rows[0];

        // deliberate vagueness in error message
        if (!user) {
            res.status(401).json({message: 'Invalid email or password.'});
            return;
        }

        // compare the password
        const passwordMatch = await bcrypt.compare(password, user.password_hash);

        if (!passwordMatch) {
            res.status(401).json({message: 'Invalid email or password.'});
            return;
        }

        // sign and return the token
        const token = signToken(user.id, user.email);

        res.json({
            user: {
                id: user.id,
                email: user.email,
                display_name: user.display_name,
                onboarding_completed: user.onboarding_completed,
            },
            token,
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({message: 'Something went wrong, please try again.'});
    }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
// Day 5 implementation will:
//   1. Read the JWT from the Authorization header
//   2. Verify it with jwt.verify()
//   3. Look up the user in the DB by the id in the token payload
//   4. Return the user object (without the password hash)
//
// This is how the frontend checks "am I still logged in?" on app load.
router.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const result = await pool.query(
            `SELECT u.id, u.email, p.display_name, p.onboarding_completed
            FROM users u
            LEFT JOIN user_profiles p ON p.user_id = u.id
            WHERE u.id = $1`,
            [req.userId]
        );
        const user = result.rows[0];

        if (!user) {
            res.status(404).json({message: 'User not found.'});
            return;
        }

        res.json({
            user: {
                id: user.id,
                email: user.email,
                display_name: user.display_name,
                onboarding_completed: user.onboarding_completed,
            }
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({message: 'Something went wrong.'});
    }
});

export default router;