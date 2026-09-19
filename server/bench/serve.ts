// Starts the API the way src/index.ts does, minus the startup viral-recipe
// rotation and cron (which would make unrelated OpenAI calls on an empty DB).
// Used to run load-test/rate-limit-race.js against a throwaway local database.
//
//   DATABASE_URL=postgresql://postgres:postgres@localhost:5433/quickchef_bench PORT=3003 \
//     npx ts-node-dev --transpile-only bench/serve.ts
//
// APP_MODULE (optional) points at a different copy of app.ts, e.g. an older
// checkout, to prove the k6 test fails on the pre-fix code.
//
// Refuses to start unless DATABASE_URL is local: dotenv fills a missing
// DATABASE_URL from server/.env, which is the production Neon URL.
import dotenv from 'dotenv';
import path from 'path';
dotenv.config();

const url = process.env.DATABASE_URL ?? '';
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error('Refusing to start: DATABASE_URL is not a local database.');
  process.exit(1);
}

const appModule = process.env.APP_MODULE ? path.resolve(process.env.APP_MODULE) : path.resolve(__dirname, '../src/app');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildApp } = require(appModule);
const PORT = process.env.PORT || 3003;
buildApp().listen(PORT, () => console.log(`bench server on http://localhost:${PORT} (db: ${new URL(url).pathname})`));
