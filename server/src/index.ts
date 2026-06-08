// File that actually starts the server.
/*
Entry point for entire backend.

This file does:
1. Create the Express app
2. Attach middleware (CORS, JSON body parsing)
3. Register all the route handlers (imported from routes/)
4. Start listening on a port

It is like main function of the backend.
*/
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';

dotenv.config();

import './db';

import authRouter from './routes/auth';
import profileRouter from './routes/profile';
import pantryRouter from './routes/pantry';
import recipesRouter from './routes/recipes';
import generateRouter from './routes/generate';
import viralRouter from './routes/viral';

// create express app
const app = express();
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map(o => o.trim());

app.use(cors({
    origin: (origin, callback) => {
        // Allow server-to-server requests (no origin) and any listed origin
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS: origin ${origin} not allowed`));
        }
    },
    credentials: true,
}));

app.use(express.json({limit: '10mb'}));

// health check
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'quickchef-api',
    });
});

// routes
app.use('/api/auth', authRouter);
app.use('/api/profile', profileRouter);
app.use('/api/pantry', pantryRouter);
app.use('/api/recipes', recipesRouter);
app.use('/api/generate-recipe', generateRouter);
app.use('/api/viral-recipes', viralRouter);

app.use((_req, res) => {
    res.status(404).json({message: 'Route not found'});
});

// global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', err.message);
    res.status(500).json({message: 'Internal server error'});
});

// start the server
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`QuickChef server running on http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});