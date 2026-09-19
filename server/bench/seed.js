// Seeds quickchef_bench with ~5,000 saved_recipes across 135 users (25-50 each).
//   node bench/seed.js
//
// "Lean" rows on purpose: image_url is a short CDN-style URL, not the ~2 MB
// base64 data URI that production rows actually hold. That isolates the index
// question (sort vs. no sort) from payload size. payload.js measures the
// heavy-row case separately.
//
// created_at is random over the last 180 days and rows are inserted in shuffled
// order, so a user's recipes are scattered across the heap and are NOT already
// in created_at order — the ORDER BY has real work to do.
const { connect, rng } = require('./common');

const N_USERS = 135;
const { ri, pick, rand, shuffle } = rng(42);

const ING = ['chicken breast', 'salmon fillet', 'tofu', 'ground beef', 'shrimp', 'eggs', 'chickpeas', 'black beans', 'lentils', 'rice', 'quinoa', 'pasta', 'noodles', 'potatoes', 'sweet potato', 'broccoli', 'spinach', 'kale', 'bell pepper', 'zucchini', 'mushrooms', 'onion', 'garlic', 'ginger', 'tomatoes', 'carrots', 'cucumber', 'avocado', 'lemon', 'lime', 'olive oil', 'soy sauce', 'sesame oil', 'coconut milk', 'greek yogurt', 'feta', 'parmesan', 'basil', 'cilantro', 'parsley', 'cumin', 'paprika', 'chili flakes', 'turmeric', 'honey', 'butter', 'cream', 'tortillas', 'bread', 'oats'];
const UNITS = ['g', 'ml', 'tbsp', 'tsp', 'cup', 'piece', 'clove', 'pinch'];
const CUISINES = ['italian', 'mexican', 'asian', 'korean', 'japanese', 'indian', 'mediterranean', 'thai', 'american', 'middle-eastern'];
const GOALS = ['high_protein', 'low_calorie', 'low_carb', 'high_fiber', 'budget_friendly'];
const DIFF = ['easy', 'medium', 'advanced'];
const DISH = ['bowl', 'skillet', 'stir-fry', 'curry', 'salad', 'wrap', 'soup', 'bake', 'pasta', 'tacos'];
const ADJ = ['Quick', 'Creamy', 'Spicy', 'Garlic', 'Lemon', 'One-Pan', 'Crispy', 'Smoky', 'Herbed', 'Sticky'];
const VERB = ['Chop and prep', 'Heat the pan and sear', 'Simmer gently', 'Stir in', 'Toss together', 'Roast until golden', 'Season to taste and add', 'Fold through', 'Rest, then plate'];

function recipe(userId) {
  const cuisine = pick(CUISINES);
  const main = pick(ING);
  const nIng = ri(6, 14);
  const ingredients = shuffle([...ING]).slice(0, nIng).map((name) => ({
    name,
    amount: ri(1, 500),
    unit: pick(UNITS),
  }));
  const instructions = Array.from({ length: ri(4, 9) }, (_, i) => ({
    step: i + 1,
    instruction: `${pick(VERB)} the ${pick(ING)} with the ${pick(ING)}, keeping the heat ${pick(['low', 'medium', 'high'])} for about ${ri(2, 12)} minutes until ${pick(['tender', 'golden', 'fragrant', 'reduced'])}.`,
    duration_minutes: ri(2, 15),
  }));
  const cal = ri(250, 750);
  const created = new Date(Date.now() - rand() * 180 * 24 * 3600 * 1000);
  return [
    userId,
    `${pick(ADJ)} ${cuisine[0].toUpperCase() + cuisine.slice(1)} ${main} ${pick(DISH)}`,
    `A ${pick(['weeknight', 'meal-prep friendly', 'high-protein', 'comforting'])} ${cuisine} dish built around ${main}, ready in ${ri(10, 45)} minutes with pantry staples.`,
    `https://images.example.test/recipes/${Math.floor(rand() * 1e12).toString(36)}${Math.floor(rand() * 1e12).toString(36)}.jpg`,
    ri(10, 60),
    pick(DIFF),
    ri(1, 6),
    [cuisine, ...(rand() < 0.3 ? [pick(CUISINES)] : [])],
    rand() < 0.6 ? [pick(GOALS)] : [],
    rand() < 0.4,
    rand() < 0.15,
    JSON.stringify(ingredients),
    JSON.stringify(instructions),
    JSON.stringify({ calories: cal, protein: ri(10, 60), carbs: ri(10, 90), fat: ri(5, 45), fiber: ri(1, 15) }),
    created,
  ];
}

(async () => {
  const c = await connect();
  await c.query('TRUNCATE users CASCADE');

  const emails = Array.from({ length: N_USERS }, (_, i) => `bench_user_${i}@example.test`);
  const u = await c.query(
    `INSERT INTO users (email, password_hash)
     SELECT e, 'bench-not-a-real-hash' FROM unnest($1::text[]) e RETURNING id`,
    [emails]
  );
  const userIds = u.rows.map((r) => r.id);

  const rows = [];
  for (const id of userIds) for (let k = ri(25, 50); k > 0; k--) rows.push(recipe(id));
  shuffle(rows);

  const COLS = 15;
  const cols = 'user_id,title,description,image_url,cooking_time_minutes,difficulty,servings,cuisines,goal_alignment,is_quick_meal,is_trending,ingredients,instructions,nutrition,created_at';
  for (let i = 0; i < rows.length; i += 250) {
    const batch = rows.slice(i, i + 250);
    const ph = batch.map((_, r) => `(${Array.from({ length: COLS }, (_, k) => `$${r * COLS + k + 1}`).join(',')})`).join(',');
    await c.query(`INSERT INTO saved_recipes (${cols}) VALUES ${ph}`, batch.flat());
  }
  await c.query('VACUUM ANALYZE saved_recipes');

  const s = await c.query(`
    SELECT sum(n)::int AS recipes, count(*)::int AS users, min(n)::int AS min_per_user,
           round(avg(n), 1) AS avg_per_user, max(n)::int AS max_per_user
    FROM (SELECT count(*) n FROM saved_recipes GROUP BY user_id) t`);
  const sz = await c.query(`SELECT pg_size_pretty(pg_total_relation_size('saved_recipes')) AS total,
                                   pg_size_pretty(pg_table_size('saved_recipes')) AS table_only,
                                   (SELECT round(avg(pg_column_size(r.*))) FROM saved_recipes r) AS avg_row_bytes`);
  console.log({ ...s.rows[0], ...sz.rows[0] });
  await c.end();
})();
