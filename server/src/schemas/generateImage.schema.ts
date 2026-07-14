// server/src/schemas/generateImage.schema.ts

import { z } from 'zod';

export const generateImageSchema = z.object({
  recipeTitle: z.string().trim().min(1).max(200),
  stepInstruction: z.string().trim().min(1).max(500),
  stepNumber: z.number().int().positive(),
});

export type GenerateImageInput = z.infer<typeof generateImageSchema>;
