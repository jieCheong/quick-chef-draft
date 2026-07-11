// GET  /api/budget                - fetch the logged-in user's budget + transactions for a month (default: current)
// PUT  /api/budget                - upsert the budget amount for a month (default: current)
// POST /api/budget/transactions   - log a purchase against the current month's budget
// POST /api/budget/recommendations - AI-suggested ingredient categories that fit the remaining budget + goals

import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import pool from '../db';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { setBudgetSchema, addTransactionSchema, SetBudgetInput, AddTransactionInput } from '../schemas/budget.schema';
import { retryWithBackoff, isRetryableOpenAIError } from '../lib/retryWithBackoff';

const router = Router();
router.use(requireAuth);

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

function currentMonthYear(): { month: number; year: number } {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

// get
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { month, year } = currentMonthYear();
  const queryMonth = req.query.month ? Number(req.query.month) : month;
  const queryYear = req.query.year ? Number(req.query.year) : year;

  try {
    const budgetResult = await pool.query(
      `SELECT id, user_id, month, year, budget_amount, created_at, updated_at
       FROM monthly_budgets
       WHERE user_id = $1 AND month = $2 AND year = $3`,
      [req.userId, queryMonth, queryYear]
    );

    if (budgetResult.rows.length === 0) {
      res.json({ budget: null, transactions: [] });
      return;
    }

    const budget = budgetResult.rows[0];
    const transactionsResult = await pool.query(
      `SELECT id, user_id, budget_id, amount, description, transaction_date, created_at
       FROM budget_transactions
       WHERE budget_id = $1
       ORDER BY transaction_date DESC`,
      [budget.id]
    );

    res.json({ budget, transactions: transactionsResult.rows });
  } catch (error) {
    req.log.error({ err: error }, 'GET /api/budget failed');
    res.status(500).json({ message: 'Failed to fetch budget.' });
  }
});

// put — upsert the budget for a month (defaults to current month/year)
router.put('/', validate(setBudgetSchema), async (req: Request, res: Response): Promise<void> => {
  const input = req.body as SetBudgetInput;
  const { month: currentMonth, year: currentYear } = currentMonthYear();
  const month = input.month ?? currentMonth;
  const year = input.year ?? currentYear;

  try {
    const result = await pool.query(
      `INSERT INTO monthly_budgets (user_id, month, year, budget_amount)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, month, year)
       DO UPDATE SET budget_amount = $4, updated_at = NOW()
       RETURNING id, user_id, month, year, budget_amount, created_at, updated_at`,
      [req.userId, month, year, input.budget_amount]
    );
    res.json({ budget: result.rows[0] });
  } catch (error) {
    req.log.error({ err: error }, 'PUT /api/budget failed');
    res.status(500).json({ message: 'Failed to save budget.' });
  }
});

// post — log a purchase against the current month's budget
router.post('/transactions', validate(addTransactionSchema), async (req: Request, res: Response): Promise<void> => {
  const input = req.body as AddTransactionInput;
  const { month, year } = currentMonthYear();

  try {
    const budgetResult = await pool.query(
      `SELECT id FROM monthly_budgets WHERE user_id = $1 AND month = $2 AND year = $3`,
      [req.userId, month, year]
    );
    if (budgetResult.rows.length === 0) {
      res.status(400).json({ message: 'Set a budget before logging purchases.' });
      return;
    }

    const budgetId = budgetResult.rows[0].id;
    const result = await pool.query(
      `INSERT INTO budget_transactions (user_id, budget_id, amount, description)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, budget_id, amount, description, transaction_date, created_at`,
      [req.userId, budgetId, input.amount, input.description || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    req.log.error({ err: error }, 'POST /api/budget/transactions failed');
    res.status(500).json({ message: 'Failed to log purchase.' });
  }
});

// post — AI recommendations for ingredients that fit the remaining budget + goals
router.post('/recommendations', async (req: Request, res: Response): Promise<void> => {
  const { month, year } = currentMonthYear();

  try {
    const budgetResult = await pool.query(
      `SELECT id, budget_amount FROM monthly_budgets WHERE user_id = $1 AND month = $2 AND year = $3`,
      [req.userId, month, year]
    );
    if (budgetResult.rows.length === 0) {
      res.status(400).json({ message: 'Set a budget before getting recommendations.' });
      return;
    }
    const { id: budgetId, budget_amount: budgetAmount } = budgetResult.rows[0];

    const profileResult = await pool.query(
      `SELECT monthly_goals FROM user_profiles WHERE user_id = $1`,
      [req.userId]
    );
    const goals: string[] = profileResult.rows[0]?.monthly_goals ?? [];
    if (goals.length === 0) {
      res.status(400).json({ message: 'Set your monthly goals before getting recommendations.' });
      return;
    }

    const spentResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS spent FROM budget_transactions WHERE budget_id = $1`,
      [budgetId]
    );
    const remaining = Number(budgetAmount) - Number(spentResult.rows[0].spent);

    const prompt = `You are a grocery-budgeting nutritionist. A user has $${remaining.toFixed(2)} remaining in their monthly grocery budget and these goals: ${goals.join(', ')}.

Suggest grocery categories and specific ingredients that support their goals within that remaining budget.

RESPOND WITH ONLY VALID JSON. No markdown, no explanation, no \`\`\`json fences. Just the raw JSON object.

Required format:
{
  "recommendations": [
    {
      "category": "Proteins",
      "items": ["chicken thighs", "canned tuna"],
      "estimated_cost": 25.00
    }
  ]
}`;

    const completion = await retryWithBackoff(
      () =>
        getOpenAI().chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 800,
          temperature: 0.7,
        }),
      { maxRetries: 2, baseDelayMs: 500, shouldRetry: isRetryableOpenAIError }
    );

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('OpenAI returned empty response');

    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let parsed: { recommendations: unknown[] };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error('AI returned invalid JSON. Please try again.');
    }

    if (!parsed.recommendations || !Array.isArray(parsed.recommendations)) {
      throw new Error('AI returned no recommendations. Please try again.');
    }

    res.json({ recommendations: parsed.recommendations });
  } catch (error) {
    req.log.error(
      { err: error, retryable: isRetryableOpenAIError(error) },
      'POST /api/budget/recommendations failed'
    );
    const message = error instanceof Error ? error.message : 'Failed to get recommendations.';
    res.status(500).json({ message });
  }
});

export default router;
