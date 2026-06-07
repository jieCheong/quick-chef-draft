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
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

import './db';
import authRouter from './routes/auth';
import profileRouter from './routes/profile';

const app = express();
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
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