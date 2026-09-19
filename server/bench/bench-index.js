// Three-state index benchmark for GET /api/recipes  (routes/recipes.ts:15)
//   node bench/bench-index.js
//
//   A  no index on user_id                      (background only)
//   B  idx_saved_recipes_user_id (user_id)      <- what production has today
//   C  idx_saved_recipes_user_created           (user_id, created_at DESC)
//
// Headline comparison is B -> C. Two query shapes, matching the two frontend
// callers:  list  = Saved.tsx  GET /api/recipes
//           limit3 = Index.tsx GET /api/recipes?limit=3
//
// Two measurements per run:
//   exec    = "Execution Time" from EXPLAIN (ANALYZE, BUFFERS): server-side plan
//             execution only (no network, no row serialization).
//   client  = wall-clock of the real SELECT * through node-postgres, incl. transfer.
// States are cycled ROUNDS times (A,B,C,A,B,C,...) so drift hits every state equally.
const fs = require('fs');
const path = require('path');
const { connect, stats } = require('./common');

const ROUNDS = 3, WARM = 20, RUNS = 100;
const VARIANTS = { list: '', limit3: ' LIMIT 3' };
const drop = (c) => Promise.all(['idx_saved_recipes_user_id', 'idx_saved_recipes_user_created'].map((i) => c.query(`DROP INDEX IF EXISTS ${i}`)));
const STATES = {
  A: async (c) => { await drop(c); },
  B: async (c) => { await drop(c); await c.query('CREATE INDEX idx_saved_recipes_user_id ON saved_recipes(user_id)'); },
  C: async (c) => { await drop(c); await c.query('CREATE INDEX idx_saved_recipes_user_created ON saved_recipes(user_id, created_at DESC)'); },
};

// "Sort > Bitmap Heap Scan > Bitmap Index Scan" style summary of a plan tree
function shape(node) {
  const name = node['Node Type'] + (node['Index Name'] ? `(${node['Index Name']})` : '');
  const kids = (node.Plans || []).map(shape);
  return kids.length ? `${name} > ${kids.join(' + ')}` : name;
}
const buffers = (n) => (n['Shared Hit Blocks'] || 0) + (n['Shared Read Blocks'] || 0);

(async () => {
  const c = await connect();
  const users = (await c.query('SELECT user_id FROM saved_recipes GROUP BY user_id ORDER BY count(*), user_id')).rows
    .map((r) => r.user_id).filter((_, i) => i % 3 === 0); // 45 users spread across the 25-50 recipe range
  const rows = (await c.query('SELECT count(*)::int n FROM saved_recipes')).rows[0].n;
  console.log(`saved_recipes rows: ${rows}; sampling ${users.length} users; ${ROUNDS} rounds x ${RUNS} runs per state/variant\n`);

  const acc = {}; // acc[state][variant] = { exec:[], plan:[], client:[], buf:[], shapes:{} }
  const idxBytes = {};
  for (let round = 1; round <= ROUNDS; round++) {
    for (const [state, apply] of Object.entries(STATES)) {
      await apply(c);
      await c.query('VACUUM ANALYZE saved_recipes');
      const sz = await c.query(`SELECT COALESCE(sum(pg_relation_size(indexrelid)),0)::int b FROM pg_index WHERE indrelid='saved_recipes'::regclass AND NOT indisprimary`);
      idxBytes[state] = sz.rows[0].b;
      for (const [variant, lim] of Object.entries(VARIANTS)) {
        const slot = ((acc[state] ||= {})[variant] ||= { exec: [], plan: [], client: [], buf: [], shapes: {} });
        const explain = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT * FROM saved_recipes WHERE user_id = $1 ORDER BY created_at DESC${lim}`;
        const plain = `SELECT * FROM saved_recipes WHERE user_id = $1 ORDER BY created_at DESC${lim}`;
        for (let i = 0; i < WARM + RUNS; i++) {
          const u = users[i % users.length];
          const ex = (await c.query(explain, [u])).rows[0]['QUERY PLAN'][0];
          const t0 = performance.now();
          await c.query(plain, [u]);
          const ms = performance.now() - t0;
          if (i < WARM) continue;
          slot.exec.push(ex['Execution Time']); slot.plan.push(ex['Planning Time']); slot.client.push(ms);
          slot.buf.push(buffers(ex.Plan));
          const sh = shape(ex.Plan); slot.shapes[sh] = (slot.shapes[sh] || 0) + 1;
        }
      }
    }
  }

  const out = { rows, users: users.length, rounds: ROUNDS, runsPerRound: RUNS, indexBytes: idxBytes, results: {} };
  const f = (x) => x.toFixed(3);
  for (const variant of Object.keys(VARIANTS)) {
    console.log(`=== ${variant.toUpperCase()}  (SELECT * FROM saved_recipes WHERE user_id=$1 ORDER BY created_at DESC${VARIANTS[variant]}) ===`);
    console.log('state |   n | exec median | exec p95 | plan median | client median | client p95 | avg buffers | index size');
    for (const state of Object.keys(STATES)) {
      const s = acc[state][variant];
      const e = stats(s.exec), p = stats(s.plan), cl = stats(s.client);
      const buf = s.buf.reduce((a, b) => a + b, 0) / s.buf.length;
      const top = Object.entries(s.shapes).sort((a, b) => b[1] - a[1])[0];
      (out.results[variant] ||= {})[state] = { exec: e, plan: p, client: cl, avgBuffers: buf, topShape: top[0], topShapeShare: top[1] / s.exec.length };
      console.log(`  ${state}   | ${String(e.n).padStart(3)} | ${f(e.median).padStart(8)} ms | ${f(e.p95).padStart(5)} ms | ${f(p.median).padStart(6)} ms  | ${f(cl.median).padStart(8)} ms  | ${f(cl.p95).padStart(6)} ms | ${buf.toFixed(1).padStart(10)}  | ${(idxBytes[state] / 1024).toFixed(0)} kB`);
    }
    for (const state of Object.keys(STATES)) {
      const t = out.results[variant][state];
      console.log(`  plan ${state}: ${t.topShape}  (${(t.topShapeShare * 100).toFixed(0)}% of runs)`);
    }
    const r = out.results[variant];
    const imp = (a, b, k) => ((1 - r[b][k].median / r[a][k].median) * 100).toFixed(1);
    out.results[variant].improvement = {
      B_to_C_exec_pct: +imp('B', 'C', 'exec'), B_to_C_client_pct: +imp('B', 'C', 'client'),
      A_to_B_exec_pct: +imp('A', 'B', 'exec'), A_to_C_exec_pct: +imp('A', 'C', 'exec'),
    };
    const i = out.results[variant].improvement;
    console.log(`  >> B->C: exec ${i.B_to_C_exec_pct}%  client ${i.B_to_C_client_pct}%   (context: A->B ${i.A_to_B_exec_pct}%, A->C ${i.A_to_C_exec_pct}%)\n`);
  }

  await STATES.B(c); // leave the bench DB in today's production state
  await c.end();
  fs.mkdirSync(path.join(__dirname, 'results'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'results', 'index-bench.json'), JSON.stringify(out, null, 2));
})();
