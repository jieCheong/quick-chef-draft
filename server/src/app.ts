import express, { Express } from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { randomUUID } from 'crypto';
import { logger } from './logger';

import authRouter from './routes/auth';
import profileRouter from './routes/profile';
import pantryRouter from './routes/pantry';
import recipesRouter from './routes/recipes';
import generateRouter from './routes/generate';
import generateImageRouter from './routes/generateImage';
import viralRouter from './routes/viral';
import budgetRouter from './routes/budget';

export function buildApp(): Express {
  const app = express();

  // pino-http auto-logs every request/response pair as ONE structured
  // line: method, url, statusCode, responseTime, and the genReqId below.
  // It attaches a `req.log` object that's a child logger scoped to this
  // specific request — anything logged via req.log automatically
  // includes the same requestId, so a single request's full story
  // (auth check, db query, OpenAI call, response) can be filtered
  // together in Railway by searching for one requestId value.
  app.use(
    pinoHttp({
      logger,
      // genReqId assigns a short random id to every incoming request.
      // Without this, two concurrent requests to the same route at the
      // same millisecond would be indistinguishable in the logs — you
      // could not tell which log lines belonged to which request.
      genReqId: (req) => {
        const existing = req.headers['x-request-id'];
        return typeof existing === 'string' ? existing : randomUUID();
      },
      // Custom log level per response status — 4xx are client errors
      // (warn, not error — the SERVER didn't fail, the request was bad),
      // 5xx are real server errors (error level).
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    })
  );

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
  app.use('/api/generate-image', generateImageRouter);
  app.use('/api/viral-recipes', viralRouter);
  app.use('/api/budget', budgetRouter);

  app.use((_req, res) => {
    res.status(404).json({ message: 'Route not found' });
  });

  app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    // req.log (attached by pino-http above) is scoped to this exact
    // request, so this error line automatically carries the same
    // requestId as the "request completed" line pino-http will also
    // emit for this same request — the two lines are correlatable.
    req.log.error({ err }, 'Unhandled error in request');
    res.status(500).json({ message: 'Internal server error' });
  });

  return app;
}