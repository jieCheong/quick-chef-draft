// Measures what `SELECT *` costs when rows carry base64 image data URIs.
//   node bench/payload.js
//
// Why: production saved_recipes rows hold image_url values of ~2 MB (base64 PNG
// from gpt-image-1; measured with pg_column_size on the live rows) and
// `instructions` up to ~9 MB when step images are saved. The list endpoint
// (routes/recipes.ts:15) does SELECT * then res.json(rows).
//
// Creates one throwaway user with 20 recipes x ~2 MB image, times the
// query + JSON.stringify (what res.json does) for SELECT * vs. the same columns
// minus image_url, then deletes everything it created.
// Local-only, so it EXCLUDES the network hop to the client — real numbers are worse.
const crypto = require('crypto');
const { connect, stats } = require('./common');

const N = 20, WARM = 3, RUNS = 15;
const COLS_NO_IMG = 'id,user_id,title,description,cooking_time_minutes,difficulty,servings,cuisines,goal_alignment,is_quick_meal,is_trending,ingredients,instructions,nutrition,created_at,updated_at';

(async () => {
  const c = await connect();
  const uid = (await c.query(`INSERT INTO users (email, password_hash) VALUES ('payload_user@example.test','x') RETURNING id`)).rows[0].id;
  try {
    for (let i = 0; i < N; i++) {
      const img = 'data:image/png;base64,' + crypto.randomBytes(1_500_000).toString('base64'); // ~2.0 MB, incompressible like real PNG
      await c.query(
        `INSERT INTO saved_recipes (user_id,title,description,image_url,ingredients,instructions,nutrition,created_at)
         VALUES ($1,$2,'payload test',$3,'[{"name":"rice","amount":100,"unit":"g"}]','[{"step":1,"instruction":"cook"}]','{"calories":400}', NOW() - ($4 || ' minutes')::interval)`,
        [uid, `payload ${i}`, img, i]);
    }
    await c.query('VACUUM ANALYZE saved_recipes');

    const cases = [
      ['list    SELECT *            (today)', `SELECT * FROM saved_recipes WHERE user_id=$1 ORDER BY created_at DESC`],
      ['list    without image_url', `SELECT ${COLS_NO_IMG} FROM saved_recipes WHERE user_id=$1 ORDER BY created_at DESC`],
      ['limit 3 SELECT *            (today)', `SELECT * FROM saved_recipes WHERE user_id=$1 ORDER BY created_at DESC LIMIT 3`],
      ['limit 3 without image_url', `SELECT ${COLS_NO_IMG} FROM saved_recipes WHERE user_id=$1 ORDER BY created_at DESC LIMIT 3`],
    ];
    console.log(`user with ${N} recipes, each image_url ~2 MB\n`);
    console.log('case                              | median (query + JSON.stringify) |  p95     | response bytes');
    const med = {};
    for (const [label, sql] of cases) {
      const xs = []; let bytes = 0;
      for (let i = 0; i < WARM + RUNS; i++) {
        const t = performance.now();
        const { rows } = await c.query(sql, [uid]);
        const body = JSON.stringify(rows); // = res.json(result.rows)
        const ms = performance.now() - t;
        if (i >= WARM) xs.push(ms);
        bytes = Buffer.byteLength(body);
      }
      const s = stats(xs); med[label] = { median: s.median, bytes };
      console.log(`${label.padEnd(33)} | ${s.median.toFixed(1).padStart(12)} ms              | ${s.p95.toFixed(1).padStart(7)} ms | ${(bytes / 1024 / 1024).toFixed(2)} MB (${bytes.toLocaleString()} B)`);
    }
    const L = Object.values(med);
    console.log(`\nlist:    ${(100 * (1 - L[1].median / L[0].median)).toFixed(1)}% less time, ${(100 * (1 - L[1].bytes / L[0].bytes)).toFixed(2)}% fewer bytes`);
    console.log(`limit 3: ${(100 * (1 - L[3].median / L[2].median)).toFixed(1)}% less time, ${(100 * (1 - L[3].bytes / L[2].bytes)).toFixed(2)}% fewer bytes`);
  } finally {
    await c.query('DELETE FROM users WHERE id = $1', [uid]); // cascades to saved_recipes
    await c.query('VACUUM saved_recipes');
    await c.end();
  }
})();
