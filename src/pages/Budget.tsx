// src/pages/Budget.tsx — redesigned UI, real API calls preserved
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useToast } from '@/hooks/use-toast';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { cn } from '@/lib/utils';
import { TrendingUp, Plus, DollarSign } from 'lucide-react';
import type { MonthlyBudget, BudgetTransaction } from '@/types/database';

const CATEGORY_COLORS: Record<string, string> = {
  Proteins: '#C85A28', Produce: '#6BAD7E', Dairy: '#6B9FD4',
  Pantry: '#B06BBD', Other: '#D4A056',
};

export default function Budget() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { toast } = useToast();
  const [budget, setBudget] = useState<MonthlyBudget | null>(null);
  const [transactions, setTransactions] = useState<BudgetTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [budgetInput, setBudgetInput] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txDesc, setTxDesc] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isAddingTx, setIsAddingTx] = useState(false);

  const now = new Date();
  const monthLabel = now.toLocaleString('default', { month: 'long', year: 'numeric' });

  useEffect(() => {
    if (!user) return;
    apiGet<{ budget: MonthlyBudget | null; transactions: BudgetTransaction[] }>('/api/budget')
      .then(data => {
        setBudget(data.budget);
        setTransactions(data.transactions || []);
        if (data.budget) setBudgetInput(String(data.budget.budget_amount));
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [user]);

  const saveBudget = async () => {
    if (!budgetInput) return;
    setIsSaving(true);
    try {
      const data = await apiPut<{ budget: MonthlyBudget }>('/api/budget', { amount: parseFloat(budgetInput) });
      setBudget(data.budget);
      toast({ description: 'Budget updated!' });
    } catch {
      toast({ variant: 'destructive', description: 'Failed to save budget.' });
    } finally {
      setIsSaving(false);
    }
  };

  const addTransaction = async () => {
    if (!txAmount || !budget) return;
    setIsAddingTx(true);
    try {
      const data = await apiPost<{ transaction: BudgetTransaction }>('/api/budget/transactions', {
        amount: parseFloat(txAmount), description: txDesc || 'Grocery purchase',
      });
      setTransactions(p => [data.transaction, ...p]);
      setTxAmount(''); setTxDesc('');
      toast({ description: 'Purchase logged!' });
    } catch {
      toast({ variant: 'destructive', description: 'Failed to log transaction.' });
    } finally {
      setIsAddingTx(false);
    }
  };

  const spent = transactions.reduce((sum, t) => sum + t.amount, 0);
  const budgetAmount = budget?.budget_amount || 0;
  const pct = budgetAmount > 0 ? Math.min(Math.round((spent / budgetAmount) * 100), 100) : 0;
  const remaining = budgetAmount - spent;

  return (
    <MobileLayout>
      <div>
        <div className="px-5 pt-14 pb-5">
          <h1 className="text-4xl" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>Budget</h1>
          <p className="text-muted-foreground mt-1 text-sm">{monthLabel}</p>
        </div>

        {/* Set budget */}
        {!budget && (
          <div className="px-5 mb-6">
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-sm font-medium mb-3">Set your monthly budget</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="number" placeholder="250" value={budgetInput}
                    onChange={e => setBudgetInput(e.target.value)}
                    className="w-full bg-secondary rounded-xl pl-8 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent/30" />
                </div>
                <button onClick={saveBudget} disabled={isSaving || !budgetInput}
                  className="px-4 rounded-xl bg-accent text-white text-sm font-medium disabled:opacity-50 hover:opacity-90">
                  Set
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Overview card */}
        {budget && (
          <div className="px-5 mb-6">
            <div className="bg-foreground text-primary-foreground rounded-2xl p-5">
              <div className="flex justify-between items-start mb-5">
                <div>
                  <p className="text-xs opacity-60 mb-1 uppercase tracking-wider">Spent</p>
                  <p className="text-4xl font-bold" style={{ fontFamily: 'Fraunces, serif' }}>${spent.toFixed(0)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs opacity-60 mb-1 uppercase tracking-wider">Budget</p>
                  <p className="text-2xl font-semibold">${budgetAmount}</p>
                </div>
              </div>
              <div className="bg-white/15 rounded-full h-1.5 mb-2.5 overflow-hidden">
                <div className="bg-accent h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex justify-between text-xs opacity-60">
                <span>{pct}% used</span>
                <span>${remaining.toFixed(0)} remaining</span>
              </div>
            </div>
          </div>
        )}

        {/* Log a purchase */}
        {budget && (
          <div className="px-5 mb-6">
            <h2 className="font-semibold text-sm tracking-wide uppercase text-muted-foreground mb-3">Log Purchase</h2>
            <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <div className="flex gap-2">
                <div className="relative w-28">
                  <DollarSign size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="number" placeholder="0.00" value={txAmount}
                    onChange={e => setTxAmount(e.target.value)}
                    className="w-full bg-secondary rounded-xl pl-7 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent/30" />
                </div>
                <input type="text" placeholder="Description (optional)" value={txDesc}
                  onChange={e => setTxDesc(e.target.value)}
                  className="flex-1 bg-secondary rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent/30 placeholder:text-muted-foreground" />
              </div>
              <button onClick={addTransaction} disabled={isAddingTx || !txAmount}
                className="w-full bg-foreground text-primary-foreground rounded-xl py-2.5 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 hover:opacity-90">
                <Plus size={14} /> Log Purchase
              </button>
            </div>
          </div>
        )}

        {/* Recent transactions */}
        {transactions.length > 0 && (
          <div className="px-5 mb-6">
            <h2 className="font-semibold text-sm tracking-wide uppercase text-muted-foreground mb-3">Recent</h2>
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              {transactions.slice(0, 5).map((t, i) => (
                <div key={t.id} className={cn('px-4 py-3.5 flex items-center gap-3', i > 0 && 'border-t border-border')}>
                  <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />
                  <span className="flex-1 text-sm">{t.description || 'Grocery purchase'}</span>
                  <span className="text-sm font-semibold">${t.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status tip */}
        {budget && (
          <div className="px-5 pb-6">
            <div className={cn('border rounded-2xl p-4 flex gap-3',
              pct > 90 ? 'bg-destructive/10 border-destructive/20' : 'bg-accent/10 border-accent/20')}>
              <TrendingUp size={18} className={cn('flex-shrink-0 mt-0.5', pct > 90 ? 'text-destructive' : 'text-accent')} />
              <div>
                <p className={cn('text-sm font-semibold mb-0.5', pct > 90 ? 'text-destructive' : 'text-accent')}>
                  {pct > 90 ? 'Over Budget' : 'On Track'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {pct > 90
                    ? `You've used ${pct}% of your budget this month.`
                    : `At this rate you'll finish $${Math.abs(remaining).toFixed(0)} ${remaining >= 0 ? 'under' : 'over'} budget. Keep it up!`}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
