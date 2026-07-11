// server/src/schemas/budget.schema.ts

import { z } from 'zod';

export const setBudgetSchema = z.object({
  budget_amount: z.number().positive('Budget amount must be greater than 0.').max(1_000_000),
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2020).max(2100).optional(),
});

export const addTransactionSchema = z.object({
  amount: z.number().positive('Amount must be greater than 0.').max(1_000_000),
  description: z.string().trim().max(200).optional(),
});

export type SetBudgetInput = z.infer<typeof setBudgetSchema>;
export type AddTransactionInput = z.infer<typeof addTransactionSchema>;
