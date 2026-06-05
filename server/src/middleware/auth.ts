// server/src/middleware/auth.ts
//
// requireAuth is a middleware function that protects routes.
// Any route that needs a logged-in user adds requireAuth before the handler:
//
//   router.get('/profile', requireAuth, async (req, res) => { ... })
//
// If the token is missing or invalid → 401 Unauthorized, route never runs.
// If the token is valid → req.userId and req.userEmail are set, route runs.
//
// HOW MIDDLEWARE WORKS IN EXPRESS:
//   Express processes a request through a chain of functions.
//   Each function gets (req, res, next).
//   Calling next() passes control to the next function in the chain.
//   Not calling next() (and sending a response instead) stops the chain.
//   That's how we "block" unauthorized requests.

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken'

// extend express's request type to include custom fields
declare global {
    namespace Express{
        interface Request{
            userId: string,
            userEmail: string;
        }
    }
}

// shape of data store inside the jwt payload
interface JwtPayload {
    userId: string;
    email: string;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
    // read the auth header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({message: 'No token provided. Please log in.'});
        return;
    }
    const token = authHeader.split(' ')[1];

    try {
        // jwt.verify() does two things:
        // 1. Checks the signature — was this token signed with our JWT_SECRET?
        // If someone tampers with the payload, the signature won't match → throws.
        // 2. Checks expiry — is the token still within its 7-day window?
        // If expired → throws JsonWebTokenError.
        const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
        req.userId = payload.userId;
        req.userEmail = payload.email;

        next();
    } catch (error) {
        res.status(401).json({message: 'Invalid or expired token. Please log in again'});
    }
}