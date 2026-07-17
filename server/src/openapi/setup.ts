// server/src/openapi/setup.ts
//
// extendZodWithOpenApi patches the ZodType prototype (adds a .openapi()
// method) on the SAME 'zod' module instance imported everywhere else in
// the app. This file just needs to run once, before document.ts builds
// any routes — it does NOT require touching the existing schema files in
// src/schemas/*.ts, since zod-to-openapi can convert a plain Zod schema
// into an OpenAPI schema object without an explicit .openapi() call.

import { z } from 'zod';
import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: 'Obtain a token from POST /api/auth/login or /api/auth/register, then send it as "Authorization: Bearer <token>".',
});

// Shape returned by requireAuth (401) and most route-level catch blocks (4xx/5xx).
export const errorResponseSchema = z.object({
  message: z.string(),
});

// Shape returned by middleware/validate.ts on a failed Zod parse (400).
export const validationErrorResponseSchema = z.object({
  message: z.string(),
  errors: z.record(z.string(), z.string()),
});
