// server/src/schemas/generate.schema.ts
//
// This is the most important schema in the app.
// Every field here is a guard against wasted OpenAI spend or a
// malformed prompt that produces garbage output.

import { z } from 'zod';

const dietaryStyleEnum = z.enum([
  'omnivore', 'vegetarian', 'vegan', 'pescatarian', 'keto', 'paleo',
]);
const skillLevelEnum = z.enum(['beginner', 'intermediate', 'advanced']);
const monthlyGoalEnum = z.enum([
  'high_protein', 'lose_weight', 'gain_muscle', 'low_calorie',
  'budget_friendly', 'quick_meals', 'meal_prep',
]);

export const generateRecipeSchema = z.object({
  // .min(1) prevents an empty array — the route already checks this
  // manually today, but moving it into the schema means the check
  // happens before ANY route logic runs, including the usage-limit
  // database query. Fail fast on the cheapest possible check first.
  //
  // .max(20) caps ingredient count. Without this, someone could send
  // 10,000 ingredients, inflating the prompt token count and your
  // OpenAI bill on a single request.
  ingredients: z
    .array(z.string().trim().min(1).max(50))
    .min(1, 'At least one ingredient is required.')
    .max(20, 'Maximum 20 ingredients allowed.'),

  // .int() rejects 30.5. Bounding between 5 and 180 minutes prevents
  // nonsense like maxTime: -1 or maxTime: 999999 from reaching the
  // prompt builder, where it would produce a confusing or absurd prompt.
  maxTime: z
    .number()
    .int()
    .min(5, 'Minimum cooking time is 5 minutes.')
    .max(180, 'Maximum cooking time is 180 minutes.')
    .default(30),

  // All personalization fields are optional — a user with no profile
  // set up yet should still be able to generate recipes with defaults.
  dietaryStyle: dietaryStyleEnum.optional(),

  // Bounding the allergies array size matters for the same reason as
  // ingredients — it's user-controlled content that gets interpolated
  // directly into the OpenAI prompt string.
  allergies: z.array(z.string().trim().min(1).max(50)).max(20).optional(),

  skillLevel: skillLevelEnum.optional(),
  cuisines: z.array(z.string().trim().min(1).max(50)).max(10).optional(),
  goals: z.array(monthlyGoalEnum).max(10).optional(),

  // craving is free-text the user types directly — this is the field
  // most worth capping. Without max length, a user could paste a huge
  // block of text trying to inject instructions into your prompt
  // (a basic prompt-injection attempt). Capping length doesn't fully
  // prevent injection, but it bounds the blast radius and token cost.
  craving: z.string().trim().max(200).optional(),
});

export type GenerateRecipeInput = z.infer<typeof generateRecipeSchema>;