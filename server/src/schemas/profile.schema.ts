// server/src/schemas/profile.schema.ts

import { z } from 'zod';

// z.enum() restricts the value to an exact set of strings.
// This replaces the loose VARCHAR(50) column with compile-time AND
// runtime guarantees — a typo like "vegitarian" is rejected with a
// clear error instead of silently saving bad data.
const dietaryStyleEnum = z.enum([
  'omnivore', 'vegetarian', 'vegan', 'pescatarian', 'keto', 'paleo',
]);

const skillLevelEnum = z.enum(['beginner', 'intermediate', 'advanced']);

const monthlyGoalEnum = z.enum([
  'high_protein', 'lose_weight', 'gain_muscle', 'low_calorie',
  'budget_friendly', 'quick_meals', 'meal_prep',
]);

// .partial() makes every field in the object optional.
// This matches the PATCH semantics — the dynamic SET clause in
// profile.ts already only updates fields that were sent, so the
// schema should allow any subset of fields, not require all of them.
export const updateProfileSchema = z.object({
  display_name: z.string().trim().min(1).max(100),
  dietary_style: dietaryStyleEnum,
  allergies: z.array(z.string().trim().min(1)).max(20),
  skill_level: skillLevelEnum,
  preferred_cuisines: z.array(z.string().trim().min(1)).max(15),
  monthly_goals: z.array(monthlyGoalEnum).max(10),
  calorie_goal: z.number().int().positive().max(10000),
  protein_goal: z.number().int().positive().max(1000),
  onboarding_completed: z.boolean(),
}).partial(); // every field optional — matches PATCH semantics

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;