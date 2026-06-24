// server/src/routes/generate.ts
//
// CHANGES FROM ORIGINAL:
//   1. Import validate + generateRecipeSchema
//   2. router.post('/', validate(generateRecipeSchema), async (req, res) => {...})
//   3. DELETE the manual ingredients.length checks — schema handles it
//   4. req.body is now typed as GenerateRecipeInput — destructure with confidence
//
// WHY THIS MATTERS MOST OF ALL FOUR VALIDATION TARGETS:
// This route is the only one that costs real money per malformed request
// reaching the database usage check (cheap) — but more importantly, the
// only one where malformed input could previously reach buildPrompt()
// and produce a confusing or wasteful OpenAI call. Validation here is a
// direct cost control, not just a correctness nice-to-have.

import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import pool from '../db';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { generateRecipeSchema, GenerateRecipeInput } from '../schemas/generate.schema';

const router = Router();
router.use(requireAuth);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function checkUsageLimit(userId: string): Promise<{ allowed: boolean; used: number; max: number }> {
  const today = new Date().toISOString().split('T')[0];
  const result = await pool.query(
    `SELECT generations_used, max_generations FROM usage_daily WHERE user_id = $1 AND date = $2`,
    [userId, today]
  );
  if (result.rows.length === 0) return { allowed: true, used: 0, max: 2 };
  const { generations_used, max_generations } = result.rows[0];
  return { allowed: generations_used < max_generations, used: generations_used, max: max_generations };
}

async function incrementUsage(userId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  await pool.query(
    `INSERT INTO usage_daily (user_id, date, generations_used, max_generations)
     VALUES ($1, $2, 1, 2)
     ON CONFLICT (user_id, date)
     DO UPDATE SET generations_used = usage_daily.generations_used + 1, updated_at = NOW()`,
    [userId, today]
  );
}

function buildPrompt(params: GenerateRecipeInput): string {
  const {
    ingredients, maxTime, dietaryStyle = 'omnivore', allergies = [],
    skillLevel = 'beginner', cuisines = [], goals = [], craving,
  } = params;

  const allergyNote = allergies.length > 0 ? `NEVER include these allergens: ${allergies.join(', ')}.` : '';
  const cuisineNote = cuisines.length > 0 ? `Preferred cuisines: ${cuisines.join(', ')}.` : '';
  const goalNote = goals.length > 0 ? `User goals: ${goals.join(', ')}. Align recipes to these goals.` : '';
  const cravingNote = craving ? `The user is craving: "${craving}". Use their ingredients creatively to satisfy this craving.` : '';

  return `You are a professional chef and nutritionist. Generate exactly 3 recipe suggestions.

CONSTRAINTS:
- Available ingredients: ${ingredients.join(', ')}
- Maximum cooking time: ${maxTime} minutes
- Dietary style: ${dietaryStyle}
- Cooking skill level: ${skillLevel}
${allergyNote}
${cuisineNote}
${goalNote}
${cravingNote}

RULES:
- Use ONLY the provided ingredients as the main ingredients (you may add basic pantry staples like salt, pepper, oil, water)
- Every recipe MUST be completable in ${maxTime} minutes or less
- Match the skill level — ${skillLevel === 'beginner' ? 'simple techniques only, no advanced methods' : skillLevel === 'intermediate' ? 'moderate techniques allowed' : 'advanced techniques welcome'}
- is_quick_meal should be true only if cooking_time_minutes is 15 or less

RESPOND WITH ONLY VALID JSON. No markdown, no explanation, no \`\`\`json fences. Just the raw JSON object.

Required format:
{
  "recipes": [
    {
      "title": "Recipe Name",
      "description": "One sentence describing the dish",
      "cooking_time_minutes": 25,
      "difficulty": "easy",
      "servings": 2,
      "is_quick_meal": false,
      "cuisines": ["italian"],
      "goal_alignment": ["high_protein"],
      "ingredients": [{ "name": "chicken breast", "amount": "200", "unit": "g" }],
      "instructions": [{ "step": 1, "instruction": "Season the chicken with salt and pepper.", "duration_minutes": 2 }],
      "nutrition": { "calories": 420, "protein": 35, "carbs": 28, "fat": 12, "fiber": 4 }
    }
  ]
}`;
}

// ─── POST /api/generate-recipe ────────────────────────────────────────────────
// validate(generateRecipeSchema) runs first. By the time this handler executes:
//   - ingredients is a non-empty array of trimmed strings, max 20 items
//   - maxTime is an integer 5-180, defaulted to 30 if omitted
//   - all enum fields (dietaryStyle, skillLevel, goals) are from the allowed set
//   - craving is capped at 200 chars
// The manual validation block that used to be here is GONE — Zod owns it.
router.post('/', validate(generateRecipeSchema), async (req: Request, res: Response): Promise<void> => {
  const input = req.body as GenerateRecipeInput;

  let usage;
  try {
    usage = await checkUsageLimit(req.userId);
  } catch (error) {
    // req.log.error's first argument is an OBJECT, not a string —
    // this is the core difference from console.error. Pino merges this
    // object's fields (here, { err }) into the structured JSON log line
    // alongside userId (attached in requireAuth) and requestId (attached
    // by pino-http). The second argument is a plain human-readable
    // message, kept separate from the structured data on purpose.
    req.log.error({ err: error }, 'Usage limit check failed');
    res.status(500).json({ message: 'Failed to check usage limit.' });
    return;
  }

  if (!usage.allowed) {
    // Logging the rate-limit hit itself (at warn, not error — this is
    // expected product behavior, not a bug) means you can later answer
    // "how often are free users actually hitting the 2/day wall?" by
    // searching Railway logs for this exact message, instead of having
    // no record that it happened at all.
    req.log.warn({ used: usage.used, max: usage.max }, 'Daily generation limit reached');
    res.status(429).json({
      message: `Daily limit reached. You've used ${usage.used}/${usage.max} recipe generations today. Resets at midnight.`,
      used: usage.used,
      max: usage.max,
    });
    return;
  }

  try {
    const prompt = buildPrompt(input);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 3000,
      temperature: 0.8,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('OpenAI returned empty response');

    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let parsed: { recipes: unknown[] };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error('Failed to parse OpenAI response:', content);
      throw new Error('AI returned invalid JSON. Please try again.');
    }

    if (!parsed.recipes || !Array.isArray(parsed.recipes) || parsed.recipes.length === 0) {
      throw new Error('AI returned no recipes. Please try again.');
    }

    await incrementUsage(req.userId);

    req.log.info(
      { ingredientCount: input.ingredients.length, recipeCount: parsed.recipes.length },
      'Recipe generation succeeded'
    );

    res.json({
      recipes: parsed.recipes,
      usage: { used: usage.used + 1, max: usage.max, remaining: usage.max - usage.used - 1 },
    });
  } catch (error) {
    // err is logged as its own field (not string-concatenated into the
    // message) so Pino preserves the full stack trace as structured
    // data — visible and expandable in Railway's log viewer, rather
    // than flattened into a single unreadable line of text.
    req.log.error({ err: error }, 'OpenAI recipe generation failed');
    const message = error instanceof Error ? error.message : 'Failed to generate recipes.';
    res.status(500).json({ message });
  }
});

export default router;