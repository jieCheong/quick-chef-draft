// Times the two auth primitives exactly as the server uses them.
//   node bench/auth-timing.js
// Current cost = BCRYPT_COST (12) in routes/auth.ts; it was 10 until this change.
// JWT: jsonwebtoken HS256, same library as middleware/auth.ts (jwt.verify).
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { stats } = require('./common');

const time = async (n, fn) => {
  const xs = [];
  for (let i = 0; i < n; i++) { const t = performance.now(); await fn(); xs.push(performance.now() - t); }
  return stats(xs);
};
const show = (label, s) => console.log(`${label.padEnd(34)} n=${String(s.n).padStart(5)}  median ${s.median.toFixed(3)} ms   p95 ${s.p95.toFixed(3)} ms   mean ${s.mean.toFixed(3)} ms`);

(async () => {
  const secret = 'bench-secret';
  const token = jwt.sign({ userId: '00000000-0000-0000-0000-000000000000', email: 'a@b.test' }, secret, { expiresIn: '7d' });
  for (let i = 0; i < 500; i++) jwt.verify(token, secret); // warm JIT
  show('jwt.verify (HS256)', await time(5000, async () => jwt.verify(token, secret)));

  const pw = 'correct horse battery staple';
  for (const cost of [10, 11, 12]) {
    const hash = bcrypt.hashSync(pw, cost);
    show(`bcryptjs.hash    cost ${cost}${cost === 12 ? ' (current)' : ''}`, await time(20, () => bcrypt.hash(pw, cost)));
    show(`bcryptjs.compare cost ${cost}${cost === 12 ? ' (current)' : ''}`, await time(20, () => bcrypt.compare(pw, hash)));
  }
})();
