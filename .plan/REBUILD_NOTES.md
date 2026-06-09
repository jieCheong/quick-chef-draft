PRODUCTION DEPLOY CHECKLIST
─────────────────────────────────────────
Railway environment variables:
  ☐ NODE_ENV = production
  ☐ DATABASE_URL = (Neon URL)
  ☐ JWT_SECRET = (your secret)
  ☐ CORS_ORIGIN = (frontend URL)
  ☐ OPENAI_API_KEY = (OpenAI key)  ← most likely missing

Tests against live Railway URL:
  ☐ GET  /health              → {"status":"ok"}
  ☐ GET  /api/viral-recipes   → [] or rows
  ☐ POST /api/auth/login      → token
  ☐ GET  /api/profile         → profile data
  ☐ GET  /api/pantry          → items array
  ☐ POST /api/generate-recipe → 3 recipes (tomorrow!)

Frontend:
  ☐ .env.local points to Railway URL
  ☐ App works end-to-end in browser against production