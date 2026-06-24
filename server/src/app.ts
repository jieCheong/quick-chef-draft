import express, { Express } from 'express';
import cors from 'cors';

import authRouter from './routes/auth';
import profileRouter from './routes/profile';
import pantryRouter from './routes/pantry';
import recipesRouter from './routes/recipes';
import generateRouter from './routes/generate';
import viralRouter from './routes/viral';

export function buildApp(): Express {
  const app = express();

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowed = (process.env.CORS_ORIGIN || 'http://localhost:5173')
        .split(',')
        .map((o) => o.trim());
      if (allowed.includes(origin)) callback(null, true);
      else callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
  }));

  app.use(express.json({ limit: '10mb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'quickchef-api' });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/profile', profileRouter);
  app.use('/api/pantry', pantryRouter);
  app.use('/api/recipes', recipesRouter);
  app.use('/api/generate-recipe', generateRouter);
  app.use('/api/viral-recipes', viralRouter);

  app.use((_req, res) => {
    res.status(404).json({ message: 'Route not found' });
  });

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  });

  return app;
}