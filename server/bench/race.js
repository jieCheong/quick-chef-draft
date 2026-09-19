// Reproduces the daily-cap race in POST /api/generate-recipe at the SQL layer.
//   node bench/race.js
//
// No OpenAI is called: "passed the gate" == "this request would have called OpenAI".
// Both variants fire CONCURRENCY requests at once for one user against the
// 2-per-day cap, TRIALS times each.
//
//   OLD  checkUsageLimit (SELECT) -> [OpenAI call, simulated by a delay] -> incrementUsage
//        SQL taken verbatim from git 572f834^  (server/src/routes/generate.ts before the fix)
//   NEW  reserveGenerationSlot: one INSERT .. ON CONFLICT DO UPDATE .. WHERE .. RETURNING
//        SQL copied from the current server/src/routes/generate.ts:55
const { connect, stats } = require('./common');
const { Pool } = require('pg');

const CONCURRENCY = 10, CAP = 2;
const today = () => new Date().toISOString().split('T')[0];

const old = {
  check: async (pool, id) => {
    const r = await pool.query('SELECT generations_used, max_generations FROM usage_daily WHERE user_id = $1 AND date = $2', [id, today()]);
    return r.rows.length === 0 ? true : r.rows[0].generations_used < r.rows[0].max_generations;
  },
  increment: (pool, id) => pool.query(
    `INSERT INTO usage_daily (user_id, date, generations_used, max_generations)
     VALUES ($1, $2, 1, 2)
     ON CONFLICT (user_id, date)
     DO UPDATE SET generations_used = usage_daily.generations_used + 1, updated_at = NOW()`, [id, today()]),
};
const reserve = async (pool, id) => (await pool.query(
  `INSERT INTO usage_daily (user_id, date, generations_used, max_generations)
   VALUES ($1, $2, 1, 2)
   ON CONFLICT (user_id, date)
   DO UPDATE SET generations_used = usage_daily.generations_used + 1, updated_at = NOW()
   WHERE usage_daily.generations_used < usage_daily.max_generations
   RETURNING generations_used, max_generations`, [id, today()])).rows.length > 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function trial(pool, id, mode, delayMs) {
  await pool.query('DELETE FROM usage_daily WHERE user_id = $1', [id]);
  const one = async () => {
    if (mode === 'new') return reserve(pool, id);
    if (!(await old.check(pool, id))) return false;
    await sleep(delayMs); // stand-in for the OpenAI call (real one is ~2-4 s)
    await old.increment(pool, id);
    return true;
  };
  const passed = (await Promise.all(Array.from({ length: CONCURRENCY }, one))).filter(Boolean).length;
  const final = (await pool.query('SELECT generations_used FROM usage_daily WHERE user_id = $1', [id])).rows[0]?.generations_used ?? 0;
  return { passed, final };
}

(async () => {
  const guard = await connect(); // enforces the local-bench-DB-only rule
  const id = (await guard.query(`INSERT INTO users (email, password_hash) VALUES ('race_user@example.test','x') ON CONFLICT (email) DO UPDATE SET email=EXCLUDED.email RETURNING id`)).rows[0].id;
  await guard.end();
  const pool = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5433/quickchef_bench', max: CONCURRENCY });

  console.log(`${CONCURRENCY} concurrent requests vs. a ${CAP}/day cap, one user\n`);
  console.log('variant                          trials | requests past the cap gate: min / median / max | trials over cap | final generations_used (max)');
  for (const [label, mode, delay, trials] of [
    ['OLD  check-then-increment, 0ms  ', 'old', 0, 50],
    ['OLD  check-then-increment, 500ms', 'old', 500, 30],
    ['NEW  atomic upsert             ', 'new', 0, 200],
  ]) {
    const res = [];
    for (let i = 0; i < trials; i++) res.push(await trial(pool, id, mode, delay));
    const s = stats(res.map((r) => r.passed));
    const over = res.filter((r) => r.passed > CAP).length;
    console.log(`${label}   ${String(trials).padStart(4)}   |            ${s.min} / ${s.median} / ${s.max}${' '.repeat(22)}| ${String(over).padStart(4)} / ${trials}       | ${Math.max(...res.map((r) => r.final))}`);
  }
  await pool.query('DELETE FROM users WHERE id = $1', [id]);
  await pool.end();
})();
