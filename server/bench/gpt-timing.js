// Times the OpenAI call behind POST /api/generate-recipe.
//   node bench/gpt-timing.js            (20 sequential calls, real API, ~$0.01-0.03 total)
//
// Same model, prompt template, and parameters as routes/generate.ts:
//   model gpt-4o-mini, max_tokens 3000, temperature 0.8, non-streaming.
// buildPrompt() below is copied verbatim from generate.ts:94-143 (the route file
// can't be imported: it pulls in the DB pool). If the route's prompt changes,
// update this copy.
//
// Measures ONLY the chat.completions.create() round trip from this machine —
// no auth, DB, or retry wrapper — plus whether the reply parses as the JSON the
// route requires (same fence-stripping + recipes-array checks as the route).
// Only OPENAI_API_KEY is read from server/.env; nothing else in it is loaded.
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const OpenAI = require('openai').default || require('openai');
const { stats } = require('./common');

const key = dotenv.parse(fs.readFileSync(path.join(__dirname, '..', '.env'))).OPENAI_API_KEY;
if (!key) { console.error('OPENAI_API_KEY not found in server/.env'); process.exit(1); }
const openai = new OpenAI({ apiKey: key });

function buildPrompt(params) {
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

// Five varied, realistic requests, rotated so the average isn't one prompt's.
const INPUTS = [
  { ingredients: ['chicken breast', 'garlic', 'olive oil', 'lemon'], maxTime: 30, dietaryStyle: 'omnivore', skillLevel: 'beginner' },
  { ingredients: ['tofu', 'broccoli', 'soy sauce', 'rice', 'ginger'], maxTime: 25, dietaryStyle: 'vegan', skillLevel: 'intermediate', goals: ['high_protein'] },
  { ingredients: ['eggs', 'spinach', 'feta', 'tomatoes'], maxTime: 15, dietaryStyle: 'vegetarian', skillLevel: 'beginner' },
  { ingredients: ['salmon fillet', 'asparagus', 'butter', 'dill', 'potatoes'], maxTime: 40, dietaryStyle: 'omnivore', skillLevel: 'advanced', cuisines: ['mediterranean'] },
  { ingredients: ['chickpeas', 'coconut milk', 'curry powder', 'onion', 'spinach'], maxTime: 35, dietaryStyle: 'vegan', skillLevel: 'beginner', craving: 'comfort food' },
];
const N = 20;

(async () => {
  const rows = [];
  for (let i = 0; i < N; i++) {
    const input = INPUTS[i % INPUTS.length];
    const t0 = performance.now();
    try {
      const c = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: buildPrompt(input) }],
        max_tokens: 3000,
        temperature: 0.8,
      });
      const ms = performance.now() - t0;
      const content = c.choices[0]?.message?.content || '';
      let validJson = false, recipes = 0;
      try {
        const parsed = JSON.parse(content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
        recipes = Array.isArray(parsed.recipes) ? parsed.recipes.length : 0;
        validJson = recipes > 0;
      } catch { /* leave validJson false */ }
      rows.push({ i: i + 1, ms, promptTokens: c.usage.prompt_tokens, completionTokens: c.usage.completion_tokens, finish: c.choices[0].finish_reason, validJson, recipes });
      console.log(`#${String(i + 1).padStart(2)}  ${(ms / 1000).toFixed(2).padStart(6)} s  out=${String(c.usage.completion_tokens).padStart(4)} tok  ${c.choices[0].finish_reason}  json=${validJson ? 'ok' : 'FAIL'} recipes=${recipes}`);
    } catch (e) {
      rows.push({ i: i + 1, error: e.message });
      console.log(`#${String(i + 1).padStart(2)}  ERROR ${e.message}`);
    }
  }

  const ok = rows.filter((r) => r.ms);
  const s = stats(ok.map((r) => r.ms / 1000));
  const tok = ok.map((r) => r.completionTokens);
  const tps = ok.map((r) => r.completionTokens / (r.ms / 1000));
  const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  console.log(`\ncalls: ${rows.length}, succeeded: ${ok.length}, valid JSON with recipes: ${ok.filter((r) => r.validJson).length}, finish_reason=length: ${ok.filter((r) => r.finish === 'length').length}`);
  console.log(`latency (s): mean ${s.mean.toFixed(2)}  median ${s.median.toFixed(2)}  p95 ${s.p95.toFixed(2)}  min ${s.min.toFixed(2)}  max ${s.max.toFixed(2)}`);
  console.log(`completion tokens: mean ${avg(tok).toFixed(0)} (min ${Math.min(...tok)}, max ${Math.max(...tok)});  throughput mean ${avg(tps).toFixed(0)} tok/s`);
  fs.mkdirSync(path.join(__dirname, 'results'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'results', 'gpt-timing.json'), JSON.stringify({ model: 'gpt-4o-mini', n: N, rows, latencySeconds: s }, null, 2));
})();
