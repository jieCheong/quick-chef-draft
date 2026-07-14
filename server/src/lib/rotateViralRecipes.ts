// server/src/lib/rotateViralRecipes.ts
//
// Keeps the "Trending This Week" section on the home page fresh
// automatically: exactly 3 AI-generated recipes are active at a time,
// swapped out for a new batch every 7 days. No manual curation needed —
// rotateViralRecipesIfStale() is self-seeding (an empty table is just
// "infinitely stale") and self-healing (checked on server startup AND
// daily via cron, so a missed exact-day tick from a server restart
// doesn't skip a rotation — it just fires the next time this runs).

import OpenAI from 'openai';
import pool from '../db';
import { retryWithBackoff, isRetryableOpenAIError } from './retryWithBackoff';
import { generateFoodImage } from './generateFoodImage';

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

interface ViralRecipeDraft {
  title: string;
  description: string;
  cooking_time_minutes: number;
  difficulty: string;
  ingredients: { name: string; amount: string; unit: string }[];
  instructions: { step: number; instruction: string }[];
  nutrition: { calories: number; protein: number; carbs: number; fat: number; fiber: number };
  tags: string[];
}

function buildViralPrompt(): string {
  return `You are a professional chef and social-media food trend expert. Generate exactly 3 "trending this week" recipes — the kind of visually appealing, shareable recipes that go viral on TikTok/Instagram. Pick 3 DIFFERENT cuisines or food styles for variety across the 3.

RESPOND WITH ONLY VALID JSON. No markdown, no explanation, no \`\`\`json fences. Just the raw JSON object.

Required format:
{
  "recipes": [
    {
      "title": "Recipe Name",
      "description": "One punchy sentence describing why this is trending right now",
      "cooking_time_minutes": 25,
      "difficulty": "easy",
      "ingredients": [{ "name": "chicken breast", "amount": "200", "unit": "g" }],
      "instructions": [{ "step": 1, "instruction": "Season the chicken with salt and pepper." }],
      "nutrition": { "calories": 420, "protein": 35, "carbs": 28, "fat": 12, "fiber": 4 },
      "tags": ["viral", "tiktok", "comfort-food"]
    }
  ]
}`;
}

async function generateThreeViralRecipes(): Promise<ViralRecipeDraft[]> {
  const prompt = buildViralPrompt();

  const completion = await retryWithBackoff(
    () =>
      getOpenAI().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 3000,
        temperature: 0.9,
      }),
    { maxRetries: 2, baseDelayMs: 500, shouldRetry: isRetryableOpenAIError }
  );

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error('OpenAI returned empty response for viral recipes');

  const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(cleaned) as { recipes: ViralRecipeDraft[] };

  if (!parsed.recipes || !Array.isArray(parsed.recipes) || parsed.recipes.length === 0) {
    throw new Error('OpenAI returned no viral recipes');
  }

  return parsed.recipes.slice(0, 3);
}

// A generic FALLBACK_IMAGES stock photo displayed instead of a real one
// looks like a bug (e.g. a pancake stack under "Tandoori Cauliflower
// Tacos") — so each trending recipe gets its own hero image generated
// from its actual title/description, same as step images. Failures are
// caught per-recipe rather than failing the whole rotation: a recipe
// with image_url null just falls back to a generic stock photo on the
// frontend, which is a downgrade, not a dealbreaker.
async function generateHeroImage(recipe: ViralRecipeDraft): Promise<string | null> {
  const prompt = `A professional food photography hero shot of "${recipe.title}". ${recipe.description} Bright natural lighting, overhead or 45-degree angle, appetizing and realistic, no text or watermarks in the image.`;
  try {
    return await generateFoodImage(prompt);
  } catch (error) {
    console.error(`[viral-rotation] Failed to generate hero image for "${recipe.title}":`, error);
    return null;
  }
}

// Arbitrary constant key for a Postgres advisory lock — see below for why
// this exists. Any int works; it just needs to not collide with another
// advisory lock elsewhere in this codebase (nothing else uses one today).
const ROTATION_LOCK_KEY = 732871;

// Checks whether the currently active trending batch is 7+ days old (or
// there isn't one at all) and, if so, generates 3 new recipes and swaps
// them in atomically — old batch deactivated and new batch activated in
// the same transaction, so /api/viral-recipes never sees a moment with
// zero or a mixed-week set of active rows.
export async function rotateViralRecipesIfStale(): Promise<void> {
  const client = await pool.connect();
  try {
    // This function is called both on server startup and daily via cron.
    // Two server processes starting near-simultaneously (a rolling deploy,
    // or ts-node-dev's --respawn restarting) could otherwise both query
    // "no active batch found" before either has written anything, and
    // both proceed to spend an OpenAI call generating a redundant batch
    // that gets immediately discarded. pg_try_advisory_lock scopes a lock
    // to this specific Postgres session, so only one caller at a time
    // gets past this point — losers return immediately instead of racing.
    const { rows: lockRows } = await client.query(
      'SELECT pg_try_advisory_lock($1) as locked',
      [ROTATION_LOCK_KEY]
    );
    if (!lockRows[0].locked) {
      console.log('[viral-rotation] Another process is already checking/rotating — skipping.');
      return;
    }

    try {
      const { rows } = await client.query(
        `SELECT MIN(week_start) as oldest_week_start FROM viral_recipes WHERE active = true`
      );
      const oldestWeekStart: string | null = rows[0]?.oldest_week_start;
      const isStale =
        !oldestWeekStart || Date.now() - new Date(oldestWeekStart).getTime() >= SEVEN_DAYS_MS;

      if (!isStale) return;

      console.log('[viral-rotation] Active trending batch is stale or missing — generating a new one.');

      let recipes: ViralRecipeDraft[];
      try {
        recipes = await generateThreeViralRecipes();
      } catch (error) {
        // Leave the old (stale) batch active rather than deactivating it
        // with nothing to replace it — stale beats empty.
        console.error('[viral-rotation] Failed to generate new viral recipes:', error);
        return;
      }

      // Generate hero images before opening the transaction — these are
      // the slow, failure-prone OpenAI calls, and there's no reason to
      // hold a transaction open across them.
      const heroImages = await Promise.all(recipes.map(generateHeroImage));

      await client.query('BEGIN');
      await client.query(`UPDATE viral_recipes SET active = false WHERE active = true`);
      for (let i = 0; i < recipes.length; i++) {
        const r = recipes[i];
        await client.query(
          `INSERT INTO viral_recipes (
            title, description, image_url, cooking_time_minutes, difficulty,
            ingredients, instructions, nutrition, tags, week_start, week_end, active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_DATE, CURRENT_DATE + 7, true)`,
          [
            r.title,
            r.description,
            heroImages[i],
            r.cooking_time_minutes || null,
            r.difficulty || null,
            JSON.stringify(r.ingredients),
            JSON.stringify(r.instructions),
            JSON.stringify(r.nutrition),
            r.tags || [],
          ]
        );
      }
      await client.query('COMMIT');
      console.log(`[viral-rotation] Rotated in ${recipes.length} new trending recipes.`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[viral-rotation] Failed to write new viral recipes, rolled back:', error);
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [ROTATION_LOCK_KEY]);
    }
  } finally {
    client.release();
  }
}
