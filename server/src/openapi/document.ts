// server/src/openapi/document.ts
//
// Builds the OpenAPI 3.0 document from the same Zod schemas that already
// validate requests at runtime (src/schemas/*.ts) — the request-body specs
// below can't drift from what the API actually accepts, because they ARE
// what the API actually accepts. Response shapes are documentation-only
// (routes don't validate their own output), so they're kept lightweight
// and describe what the route handlers actually res.json().

import { z } from 'zod';
import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { registry, errorResponseSchema, validationErrorResponseSchema } from './setup';
import { registerSchema, loginSchema } from '../schemas/auth.schema';
import { addPantryItemSchema, idParamSchema as pantryIdParamSchema } from '../schemas/pantry.schema';
import { updateProfileSchema } from '../schemas/profile.schema';
import { idParamSchema as recipeIdParamSchema } from '../schemas/recipes.schema';
import { generateRecipeSchema } from '../schemas/generate.schema';
import { generateImageSchema } from '../schemas/generateImage.schema';
import { setBudgetSchema, addTransactionSchema } from '../schemas/budget.schema';

const bearerAuth = [{ bearerAuth: [] }];

const jsonBody = (schema: z.ZodTypeAny) => ({
  content: { 'application/json': { schema } },
});

const errorResponses = {
  400: { description: 'Validation failed.', ...jsonBody(validationErrorResponseSchema) },
  401: { description: 'Missing, invalid, or expired token.', ...jsonBody(errorResponseSchema) },
  500: { description: 'Unexpected server error.', ...jsonBody(errorResponseSchema) },
};

// ─── Shared entity shapes (response documentation only) ──────────────────

const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  display_name: z.string().nullable().optional(),
  onboarding_completed: z.boolean().optional(),
});

const authSuccessSchema = z.object({
  user: userSchema,
  token: z.string().describe('JWT, valid for 7 days. Send as "Authorization: Bearer <token>" on subsequent requests.'),
});

const pantryItemSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string(),
  category: z.string(),
  created_at: z.string(),
});

const profileSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  display_name: z.string().nullable(),
  dietary_style: z.string().nullable(),
  allergies: z.array(z.string()),
  skill_level: z.string().nullable(),
  preferred_cuisines: z.array(z.string()),
  monthly_goals: z.array(z.string()),
  calorie_goal: z.number().nullable(),
  protein_goal: z.number().nullable(),
  onboarding_completed: z.boolean(),
  email: z.string().email().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

const recipeIngredientSchema = z.object({ name: z.string(), amount: z.string(), unit: z.string() });
const recipeInstructionSchema = z.object({ step: z.number(), instruction: z.string(), image_url: z.string().nullable().optional() });
const nutritionSchema = z.object({ calories: z.number(), protein: z.number(), carbs: z.number().optional(), fat: z.number().optional(), fiber: z.number().optional() });

const savedRecipeSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  image_url: z.string().nullable(),
  cooking_time_minutes: z.number().nullable(),
  difficulty: z.string().nullable(),
  servings: z.number().nullable(),
  cuisines: z.array(z.string()),
  goal_alignment: z.array(z.string()),
  is_quick_meal: z.boolean(),
  is_trending: z.boolean(),
  ingredients: z.array(recipeIngredientSchema),
  instructions: z.array(recipeInstructionSchema),
  nutrition: nutritionSchema.nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const saveRecipeBodySchema = z.object({
  title: z.string(),
  description: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  cooking_time_minutes: z.number().optional(),
  difficulty: z.string().optional(),
  servings: z.number().optional(),
  cuisines: z.array(z.string()).optional(),
  goal_alignment: z.array(z.string()).optional(),
  is_quick_meal: z.boolean().optional(),
  is_trending: z.boolean().optional(),
  ingredients: z.array(recipeIngredientSchema),
  instructions: z.array(recipeInstructionSchema),
  nutrition: nutritionSchema.optional(),
});

const viralRecipeSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  image_url: z.string().nullable(),
  cooking_time_minutes: z.number().nullable(),
  difficulty: z.string().nullable(),
  ingredients: z.array(recipeIngredientSchema),
  instructions: z.array(recipeInstructionSchema),
  nutrition: nutritionSchema.nullable(),
  tags: z.array(z.string()),
  week_start: z.string(),
  week_end: z.string(),
  created_at: z.string(),
});

const budgetSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  month: z.number(),
  year: z.number(),
  budget_amount: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

const transactionSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  budget_id: z.string().uuid(),
  amount: z.string(),
  description: z.string().nullable(),
  transaction_date: z.string(),
  created_at: z.string(),
});

// ─── Auth ──────────────────────────────────────────────────────────────

registry.registerPath({
  method: 'post',
  path: '/api/auth/register',
  tags: ['Auth'],
  summary: 'Create an account',
  description: 'Rate-limited to 5 requests per 15 minutes per IP.',
  request: { body: { content: { 'application/json': { schema: registerSchema } } } },
  responses: {
    201: { description: 'Account created.', ...jsonBody(authSuccessSchema) },
    409: { description: 'Email already registered.', ...jsonBody(errorResponseSchema) },
    429: { description: 'Rate limit exceeded.', ...jsonBody(errorResponseSchema) },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/auth/login',
  tags: ['Auth'],
  summary: 'Log in',
  description: 'Rate-limited to 5 requests per 15 minutes per IP.',
  request: { body: { content: { 'application/json': { schema: loginSchema } } } },
  responses: {
    200: { description: 'Logged in.', ...jsonBody(authSuccessSchema) },
    429: { description: 'Rate limit exceeded.', ...jsonBody(errorResponseSchema) },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/auth/me',
  tags: ['Auth'],
  summary: 'Get the current logged-in user',
  security: bearerAuth,
  responses: {
    200: { description: 'Current user.', ...jsonBody(z.object({ user: userSchema })) },
    404: { description: 'User not found.', ...jsonBody(errorResponseSchema) },
    ...errorResponses,
  },
});

// ─── Pantry ────────────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/api/pantry',
  tags: ['Pantry'],
  summary: "List the logged-in user's pantry items",
  security: bearerAuth,
  responses: {
    200: { description: 'Pantry items.', ...jsonBody(z.array(pantryItemSchema)) },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/pantry',
  tags: ['Pantry'],
  summary: 'Add a pantry item',
  security: bearerAuth,
  request: { body: { content: { 'application/json': { schema: addPantryItemSchema } } } },
  responses: {
    201: { description: 'Item added.', ...jsonBody(pantryItemSchema) },
    409: { description: 'Item already exists (case-insensitive).', ...jsonBody(errorResponseSchema) },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/pantry/{id}',
  tags: ['Pantry'],
  summary: 'Remove a pantry item',
  security: bearerAuth,
  request: { params: pantryIdParamSchema },
  responses: {
    204: { description: 'Item removed.' },
    404: { description: 'Item not found.', ...jsonBody(errorResponseSchema) },
    ...errorResponses,
  },
});

// ─── Profile ───────────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/api/profile',
  tags: ['Profile'],
  summary: "Get the logged-in user's profile",
  security: bearerAuth,
  responses: {
    200: { description: 'Profile.', ...jsonBody(z.object({ profile: profileSchema })) },
    404: { description: 'Profile not found.', ...jsonBody(errorResponseSchema) },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/profile',
  tags: ['Profile'],
  summary: 'Update the profile (partial — only send fields you want to change)',
  security: bearerAuth,
  request: { body: { content: { 'application/json': { schema: updateProfileSchema } } } },
  responses: {
    200: { description: 'Updated profile.', ...jsonBody(z.object({ profile: profileSchema })) },
    404: { description: 'Profile not found.', ...jsonBody(errorResponseSchema) },
    ...errorResponses,
  },
});

// ─── Saved Recipes ─────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/api/recipes',
  tags: ['Recipes'],
  summary: "List the logged-in user's saved recipes",
  security: bearerAuth,
  request: { query: z.object({ limit: z.coerce.number().int().positive().optional() }) },
  responses: {
    200: { description: 'Saved recipes.', ...jsonBody(z.array(savedRecipeSchema)) },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/recipes',
  tags: ['Recipes'],
  summary: 'Save a recipe',
  security: bearerAuth,
  request: { body: { content: { 'application/json': { schema: saveRecipeBodySchema } } } },
  responses: {
    201: { description: 'Saved recipe.', ...jsonBody(savedRecipeSchema) },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/recipes/{id}',
  tags: ['Recipes'],
  summary: "Update a saved recipe's instructions (e.g. after generating a step image)",
  security: bearerAuth,
  request: {
    params: recipeIdParamSchema,
    body: { content: { 'application/json': { schema: z.object({ instructions: z.array(recipeInstructionSchema) }) } } },
  },
  responses: {
    200: { description: 'Updated recipe.', ...jsonBody(savedRecipeSchema) },
    404: { description: 'Recipe not found.', ...jsonBody(errorResponseSchema) },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/recipes/{id}',
  tags: ['Recipes'],
  summary: 'Delete a saved recipe',
  security: bearerAuth,
  request: { params: recipeIdParamSchema },
  responses: {
    204: { description: 'Recipe deleted.' },
    404: { description: 'Recipe not found.', ...jsonBody(errorResponseSchema) },
    ...errorResponses,
  },
});

// ─── AI generation ─────────────────────────────────────────────────────

registry.registerPath({
  method: 'post',
  path: '/api/generate-recipe',
  tags: ['Generate'],
  summary: 'Generate recipes from ingredients via OpenAI (rate-limited by daily usage quota, not IP)',
  security: bearerAuth,
  request: { body: { content: { 'application/json': { schema: generateRecipeSchema } } } },
  responses: {
    200: { description: 'Generated recipes.', ...jsonBody(z.object({ recipes: z.array(z.unknown()) })) },
    429: { description: 'Daily generation limit reached.', ...jsonBody(z.object({ message: z.string(), used: z.number(), max: z.number() })) },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/generate-image',
  tags: ['Generate'],
  summary: 'Generate a DALL-E image for a single recipe step (rate-limited by daily usage quota, not IP)',
  security: bearerAuth,
  request: { body: { content: { 'application/json': { schema: generateImageSchema } } } },
  responses: {
    200: { description: 'Generated image.', ...jsonBody(z.object({ image_url: z.string() })) },
    429: { description: 'Daily image generation limit reached.', ...jsonBody(z.object({ message: z.string(), used: z.number(), max: z.number() })) },
    ...errorResponses,
  },
});

// ─── Viral / Trending ──────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/api/viral-recipes',
  tags: ['Viral'],
  summary: "This week's trending recipes (public, no auth required)",
  responses: {
    200: { description: 'Trending recipes.', ...jsonBody(z.array(viralRecipeSchema)) },
    500: errorResponses[500],
  },
});

// ─── Budget ────────────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/api/budget',
  tags: ['Budget'],
  summary: "Get the logged-in user's budget + transactions for a month (defaults to current month)",
  security: bearerAuth,
  request: { query: z.object({ month: z.coerce.number().int().min(1).max(12).optional(), year: z.coerce.number().int().optional() }) },
  responses: {
    200: { description: 'Budget and transactions.', ...jsonBody(z.object({ budget: budgetSchema.nullable(), transactions: z.array(transactionSchema) })) },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'put',
  path: '/api/budget',
  tags: ['Budget'],
  summary: 'Set (or update) the budget amount for a month',
  security: bearerAuth,
  request: { body: { content: { 'application/json': { schema: setBudgetSchema } } } },
  responses: {
    200: { description: 'Saved budget.', ...jsonBody(z.object({ budget: budgetSchema })) },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/budget/transactions',
  tags: ['Budget'],
  summary: "Log a purchase against the current month's budget",
  security: bearerAuth,
  request: { body: { content: { 'application/json': { schema: addTransactionSchema } } } },
  responses: {
    201: { description: 'Logged transaction.', ...jsonBody(transactionSchema) },
    ...errorResponses,
    400: { description: 'No budget set yet for this month.', ...jsonBody(errorResponseSchema) },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/budget/recommendations',
  tags: ['Budget'],
  summary: 'AI-suggested ingredient categories that fit the remaining budget + monthly goals',
  security: bearerAuth,
  responses: {
    200: {
      description: 'Recommendations.',
      ...jsonBody(z.object({ recommendations: z.array(z.object({ category: z.string(), items: z.array(z.string()), estimated_cost: z.number() })) })),
    },
    ...errorResponses,
    400: { description: 'No budget or goals set yet.', ...jsonBody(errorResponseSchema) },
  },
});

export const openApiDocument = new OpenApiGeneratorV3(registry.definitions).generateDocument({
  openapi: '3.0.0',
  info: {
    title: 'QuickChef API',
    version: '1.0.0',
    description: 'AI-powered recipe, pantry, and grocery-budget assistant. Auth is a Bearer JWT (7-day expiry) obtained from /api/auth/login or /api/auth/register.',
  },
  servers: [{ url: '/', description: 'Current host' }],
});
