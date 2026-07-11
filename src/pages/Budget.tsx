import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { GoalBadge } from '@/components/ui/goal-badge';
import { useToast } from '@/hooks/use-toast';
import { apiGet, apiPut, apiPost } from '@/lib/api';

import {
  DollarSign, Target, Plus, TrendingUp, TrendingDown,
  Sparkles, Loader2, Check, ShoppingCart
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { type MonthlyBudget, type BudgetTransaction, type BudgetRecommendation } from '@/types/database';

export default function Budget() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { profile } = useProfile();
  const { toast } = useToast();

  const [budget, setBudget] = useState<MonthlyBudget | null>(null);
  const [transactions, setTransactions] = useState<BudgetTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [budgetAmount, setBudgetAmount] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [transactionAmount, setTransactionAmount] = useState('');
  const [transactionDesc, setTransactionDesc] = useState('');
  const [isAddingTransaction, setIsAddingTransaction] = useState(false);
  const [recommendations, setRecommendations] = useState<BudgetRecommendation[] | null>(null);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (user) {
      fetchBudgetData();
    }
  }, [user]);

  const fetchBudgetData = async () => {
    setIsLoading(true);
    try {
      const data = await apiGet<{ budget: MonthlyBudget | null; transactions: BudgetTransaction[] }>('/api/budget');
      setBudget(data.budget);
      setTransactions(data.transactions);
    } catch {
      toast({ variant: 'destructive', description: 'Failed to load budget.' });
    } finally {
      setIsLoading(false);
    }
  };

  const saveBudget = async () => {
    if (!budgetAmount) return;
    setIsSaving(true);
    try {
      const amount = parseFloat(budgetAmount);
      const data = await apiPut<{ budget: MonthlyBudget }>('/api/budget', { budget_amount: amount });
      setBudget(data.budget);
      setBudgetAmount('');
      toast({ description: budget ? 'Budget updated!' : 'Budget set!' });
    } catch (err) {
      toast({ variant: 'destructive', description: err instanceof Error ? err.message : 'Failed to save budget.' });
    } finally {
      setIsSaving(false);
    }
  };

  const addTransaction = async () => {
    if (!budget || !transactionAmount) return;
    setIsAddingTransaction(true);
    try {
      const newTransaction = await apiPost<BudgetTransaction>('/api/budget/transactions', {
        amount: parseFloat(transactionAmount),
        description: transactionDesc || undefined,
      });
      setTransactions([newTransaction, ...transactions]);
      setTransactionAmount('');
      setTransactionDesc('');
      toast({ description: 'Purchase logged!' });
    } catch (err) {
      toast({ variant: 'destructive', description: err instanceof Error ? err.message : 'Failed to log purchase.' });
    } finally {
      setIsAddingTransaction(false);
    }
  };

  const getRecommendations = async () => {
    setIsLoadingRecommendations(true);
    try {
      const data = await apiPost<{ recommendations: BudgetRecommendation[] }>('/api/budget/recommendations', {});
      setRecommendations(data.recommendations);
    } catch (err) {
      toast({ variant: 'destructive', description: err instanceof Error ? err.message : 'Failed to get recommendations.' });
    } finally {
      setIsLoadingRecommendations(false);
    }
  };

  const totalSpent = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
  const remaining = budget ? budget.budget_amount - totalSpent : 0;
  const percentUsed = budget ? (totalSpent / budget.budget_amount) * 100 : 0;

  if (authLoading || isLoading) {
    return (
      <MobileLayout>
        <div className="p-4 space-y-4">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="p-4 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Grocery Budget</h1>
          <p className="text-muted-foreground">
            {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Budget Setup/Overview */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Monthly Budget
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={budgetAmount}
                  onChange={(e) => setBudgetAmount(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Button onClick={saveBudget} disabled={isSaving || !budgetAmount}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              </Button>
            </div>

            {budget && (
              <>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Spent: ${totalSpent.toFixed(2)}</span>
                    <span>Remaining: ${remaining.toFixed(2)}</span>
                  </div>
                  <Progress 
                    value={Math.min(percentUsed, 100)} 
                    className={cn(
                      'h-3',
                      percentUsed > 90 && 'bg-destructive/20'
                    )}
                  />
                </div>

                <div className="flex items-center gap-2">
                  {percentUsed > 90 ? (
                    <>
                      <TrendingDown className="h-4 w-4 text-destructive" />
                      <span className="text-sm text-destructive">Budget almost used up</span>
                    </>
                  ) : (
                    <>
                      <TrendingUp className="h-4 w-4 text-accent" />
                      <span className="text-sm text-accent">{Math.round(100 - percentUsed)}% remaining</span>
                    </>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Monthly Goals */}
        {profile?.monthly_goals && profile.monthly_goals.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4" />
                Your Goals
              </CardTitle>
              <CardDescription>We'll recommend ingredients that support these</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {profile.monthly_goals.map((goal) => (
                  <GoalBadge key={goal} goal={goal} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* AI Recommendations */}
        {budget && profile?.monthly_goals?.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                AI Recommendations
              </CardTitle>
              <CardDescription>Ingredients that fit your budget and goals</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={getRecommendations}
                disabled={isLoadingRecommendations}
              >
                {isLoadingRecommendations ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                {recommendations ? 'Refresh Recommendations' : 'Get Recommendations'}
              </Button>

              {recommendations && (
                <div className="space-y-3 pt-1">
                  {recommendations.map((rec, i) => (
                    <div key={i} className="rounded-lg border p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{rec.category}</span>
                        <span className="text-sm text-muted-foreground">${Number(rec.estimated_cost).toFixed(2)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{rec.items.join(', ')}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Log Purchase */}
        {budget && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Log Purchase
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    placeholder="Amount"
                    value={transactionAmount}
                    onChange={(e) => setTransactionAmount(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Input
                  placeholder="Description (optional)"
                  value={transactionDesc}
                  onChange={(e) => setTransactionDesc(e.target.value)}
                  className="flex-1"
                />
              </div>
              <Button 
                className="w-full"
                onClick={addTransaction}
                disabled={!transactionAmount || isAddingTransaction}
              >
                {isAddingTransaction ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Add Purchase
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Transaction History */}
        {transactions.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-medium">Recent Purchases</h3>
            <div className="space-y-2">
              {transactions.slice(0, 10).map((trans) => (
                <div key={trans.id} className="flex items-center justify-between py-2 border-b">
                  <div>
                    <p className="text-sm font-medium">{trans.description || 'Purchase'}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(trans.transaction_date).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="font-medium">${Number(trans.amount).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
