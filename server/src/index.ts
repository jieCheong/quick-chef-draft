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
const app = express();

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// health check that returns 200 ok when server is running
// if it returns anything other than 200, frontend will show "Backend is not running" message
app.get('/health', (_req, res) => {
    res.json({ status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'QuickChef API Server',
     });
});

// routes
app.use('/api/auth', authRouter);
app.use((_req, res) => {
    res.status(404).json({ message: 'Not found' });
});

// global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', err?.message ?? err);
    res.status(500).json({ message: 'Internal server error' });
});

// start the server
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log('Health check: http://localhost:' + PORT + '/health');
    console.log('Environment:', process.env.NODE_ENV);
});