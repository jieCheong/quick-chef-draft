// server/src/middleware/validate.ts
//
// A factory that turns any Zod schema into Express middleware.
// Usage: router.post('/', validate(registerSchema), async (req, res) => {...})
//
// WHY A FACTORY PATTERN:
// Instead of writing parse-and-handle-errors logic in every route,
// we write it once here and apply it declaratively per route.
// This is the same pattern requireAuth uses — middleware that runs
// BEFORE the route handler and can short-circuit the request.

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

// Which part of the request to validate.
// Most routes validate 'body'. Routes with URL params (DELETE /:id)
// also validate 'params'. Routes with query strings (?limit=3) validate 'query'.
type ValidationTarget = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, target: ValidationTarget = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // schema.parse() throws ZodError if validation fails.
      // On success, it returns the PARSED value — which matters because
      // Zod can coerce types (e.g. "30" query string -> 30 number) and
      // strip unknown fields if the schema uses .strict() or default behavior.
      const parsed = schema.parse(req[target]);

      // Overwrite req[target] with the parsed/coerced version.
      // This means route handlers receive clean, typed data —
      // they never need to re-validate or guess about shape.
      (req as unknown as Record<string, unknown>)[target] = parsed;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // error.errors is an array of { path, message } objects.
        // We flatten this into a simple field -> message map so the
        // frontend can show errors next to the right form input.
        const fieldErrors: Record<string, string> = {};
        error.issues.forEach((e) => {
          const field = e.path.join('.') || target;
          fieldErrors[field] = e.message;
        });

        res.status(400).json({
          message: 'Validation failed.',
          errors: fieldErrors,
        });
        return;
      }

      // Non-Zod error — something unexpected. Let it bubble to the
      // global error handler in index.ts rather than guessing here.
      next(error);
    }
  };
}