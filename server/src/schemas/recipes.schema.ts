// server/src/schemas/recipes.schema.ts

import { z } from 'zod';

// For DELETE /api/recipes/:id — rejects a malformed id with a 400
// before it ever reaches the database.
export const idParamSchema = z.object({
  id: z.string().uuid('Invalid recipe id.'),
});
