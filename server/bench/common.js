// Shared helpers for the bench scripts.
//
// SAFETY: these scripts TRUNCATE and bulk-insert. connect() refuses to run
// unless the target is a local Postgres and the database is literally named
// quickchef_bench, so pointing DATABASE_URL (Neon) at it by accident is a no-op.
// dotenv is deliberately NOT loaded — server/.env holds the production URL.
const { Client } = require('pg');

const URL_ =
  process.env.BENCH_DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5433/quickchef_bench';

async function connect() {
  const u = new URL(URL_);
  const localHost = ['localhost', '127.0.0.1', '::1'].includes(u.hostname);
  if (!localHost || u.pathname !== '/quickchef_bench') {
    console.error(`Refusing to run: ${u.hostname}${u.pathname} is not local quickchef_bench.`);
    process.exit(1);
  }
  const c = new Client({ connectionString: URL_ });
  await c.connect();
  return c;
}

// Deterministic PRNG (mulberry32) so every seed run produces identical data.
function rng(seed) {
  let a = seed >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const ri = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  return { rand, ri, pick, shuffle };
}

const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
function stats(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  return { n: s.length, min: s[0], median: pct(s, 50), p95: pct(s, 95), max: s[s.length - 1], mean };
}

module.exports = { connect, rng, stats };
