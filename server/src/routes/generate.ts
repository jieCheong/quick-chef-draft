// server/src/routes/generate.ts
//
// POST /api/generate-recipe — calls OpenAI and returns structured recipes
//
// This route does 4 things in order:
//   1. Check the user's daily usage limit (before spending any money)
//   2. Call OpenAI with a structured prompt
//   3. Parse and validate the response
//   4. Increment the usage count in the database

import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import pool from '../db';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { generateRecipeSchema, GenerateRecipeInput } from '../schemas/generate.schema';

const router = Router();
router.use(requireAuth);

// ─── OpenAI client ────────────────────────────────────────────────────────────
// Instantiated once here — reused on every request.
// The SDK automatically reads OPENAI_API_KEY from process.env.
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ─── Usage limit helpers ──────────────────────────────────────────────────────
// These two functions handle the daily usage tracking.
// We use a single function to check AND a separate one to increment
// so we only increment after a successful generation.

async function checkUsageLimit(userId: string): Promise<{
  allowed: boolean;
  used: number;
  max: number;
}> {
  const today = new Date().toISOString().split('T')[0]; // "2024-01-15"

  // Try to find today's usage row for this user.
  const result = await pool.query(
    `SELECT generations_used, max_generations
     FROM usage_daily
     WHERE user_id = $1 AND date = $2`,
    [userId, today]
  );

  if (result.rows.length === 0) {
    // No row yet for today — user hasn't generated anything yet.
    // They are allowed to generate (used=0, max=2).
    return { allowed: true, used: 0, max: 2 };
  }

  const { generations_used, max_generations } = result.rows[0];
  return {
    allowed: generations_used < max_generations,
    used: generations_used,
    max: max_generations,
  };
}

async function incrementUsage(userId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  // INSERT ... ON CONFLICT is an "upsert":
  // - If no row exists for today → INSERT a new row with generations_used = 1
  // - If a row exists → UPDATE it by incrementing generations_used by 1
  //
  // This is ATOMIC — even if two requests arrive at the same time,
  // the database handles it correctly. You can't get two inserts for the same day.
  await pool.query(
    `INSERT INTO usage_daily (user_id, date, generations_used, max_generations)
     VALUES ($1, $2, 1, 2)
     ON CONFLICT (user_id, date)
     DO UPDATE SET
       generations_used = usage_daily.generations_used + 1,
       updated_at = NOW()`,
    [userId, today]
  );
}

// ─── The prompt builder ───────────────────────────────────────────────────────
// This is "prompt engineering" — the art of telling the AI exactly what to do.
//
// Key principles used here:
//   1. Tell it to return ONLY JSON — no intro text, no markdown fences
//   2. Give it the exact JSON schema you expect
//   3. Be specific about constraints (time, dietary, allergies)
//   4. Ask for exactly 3 recipes so you always get a consistent number

function buildPrompt(params: GenerateRecipeInput): string {
  const {
    ingredients,
    maxTime,
    dietaryStyle = 'omnivore',
    allergies = [],
    skillLevel = 'beginner',
    cuisines = [],
    goals = [],
    craving,
  } = params;

  // Build constraint sentences conditionally — only include if relevant.
  const allergyNote = allergies.length > 0
    ? `NEVER include these allergens: ${allergies.join(', ')}.`
    : '';

  const cuisineNote = cuisines.length > 0
    ? `Preferred cuisines: ${cuisines.join(', ')}.`
    : '';

  const goalNote = goals.length > 0
    ? `User goals: ${goals.join(', ')}. Align recipes to these goals.`
    : '';

  const cravingNote = craving
    ? `The user is craving: "${craving}". Use their ingredients creatively to satisfy this craving.`
    : '';

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
      "ingredients": [
        { "name": "chicken breast", "amount": "200", "unit": "g" }
      ],
      "instructions": [
        { "step": 1, "instruction": "Season the chicken with salt and pepper.", "duration_minutes": 2 }
      ],
      "nutrition": {
        "calories": 420,
        "protein": 35,
        "carbs": 28,
        "fat": 12,
        "fiber": 4
      }
    }
  ]
}`;
}

// ─── POST /api/generate-recipe ────────────────────────────────────────────────
router.post('/', validate(generateRecipeSchema), async (req: Request, res: Response): Promise<void> => {
  const input = req.body as GenerateRecipeInput;

  // ── Check usage limit BEFORE calling OpenAI ────────────────────────────────
  // This is the most important check — we never spend API credits
  // if the user is already at their limit.
  let usage;
  try {
    usage = await checkUsageLimit(req.userId);
  } catch (error) {
    console.error('Usage check error:', error);
    res.status(500).json({ message: 'Failed to check usage limit.' });
    return;
  }

  if (!usage.allowed) {
    // 429 = Too Many Requests — the standard HTTP status for rate limiting.
    res.status(429).json({
      message: `Daily limit reached. You've used ${usage.used}/${usage.max} recipe generations today. Resets at midnight.`,
      used: usage.used,
      max: usage.max,
    });
    return;
  }

  // ── Call OpenAI ────────────────────────────────────────────────────────────
  try {
    const prompt = buildPrompt(input);

    // openai.chat.completions.create() is the main API call.
    // "messages" is an array — you can pass conversation history for multi-turn,
    // but for recipe generation a single user message is enough.
    //
    // model: "gpt-4o-mini" is the best balance of quality vs cost.
    //   - gpt-4o-mini: ~$0.01 per recipe generation, very fast
    //   - gpt-4o: ~$0.10 per call, higher quality but expensive for an app
    //
    // max_tokens: caps the response length so you don't get unexpectedly large bills.
    // temperature: 0.8 = slightly creative but still follows the JSON format.
    //   0.0 = deterministic (same input → same output)
    //   1.0 = very creative (can get unpredictable)
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 3000,
      temperature: 0.8,
    });

    // Extract the text content from the response.
    // The API returns an array of "choices" — we always take the first one.
    const content = completion.choices[0]?.message?.content;

    if (!content) {
      throw new Error('OpenAI returned empty response');
    }

    // ── Parse the JSON response ──────────────────────────────────────────────
    // Even though we told the AI to return only JSON, it sometimes adds
    // markdown code fences (```json ... ```) anyway. Strip them just in case.
    const cleaned = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

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

    // ── Increment usage AFTER successful generation ──────────────────────────
    // We only charge the usage count if OpenAI actually returned recipes.
    // If OpenAI failed, the user doesn't lose a generation.
    await incrementUsage(req.userId);

    // Return recipes plus remaining usage info so the frontend
    // can show "X generations remaining today" if needed.
    res.json({
      recipes: parsed.recipes,
      usage: {
        used: usage.used + 1,
        max: usage.max,
        remaining: usage.max - usage.used - 1,
      },
    });

  } catch (error) {
    console.error('OpenAI error:', error);

    // Give the user a helpful message without leaking internal details.
    const message = error instanceof Error ? error.message : 'Failed to generate recipes.';
    res.status(500).json({ message });
  }
});

export default router;