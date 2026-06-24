// server/src/schemas/pantry.schema.ts

import { z } from 'zod';

const categoryEnum = z.enum([
  'proteins', 'vegetables', 'fruits', 'dairy',
  'grains', 'spices', 'condiments', 'other',
]);

export const addPantryItemSchema = z.object({
  name: z.string().trim().min(1, 'Item name is required.').max(100),
  category: categoryEnum.default('other'),
});

// For routes with a URL param like DELETE /api/pantry/:id
// z.string().uuid() ensures the param is actually a valid UUID shape
// BEFORE it reaches a database query. Without this, a malformed id
// like "../../etc" or "1; DROP TABLE" still gets parameterized safely
// by pg, but you'd rather reject it at the edge with a clear 400
// than let it fall through to a confusing "not found" 404.
export const idParamSchema = z.object({
  id: z.string().uuid('Invalid item id.'),
});

export type AddPantryItemInput = z.infer<typeof addPantryItemSchema>;