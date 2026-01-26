import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { GoalBadge } from '@/components/ui/goal-badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  DollarSign, Target, Plus, TrendingUp, TrendingDown, 
  Sparkles, Loader2, Check, ShoppingCart
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { MONTHLY_GOALS, type MonthlyGoal, type MonthlyBudget, type BudgetTransaction } from '@/types/database';

interface AIRecommendation {
  categories: { name: string; percentage: number; amount: number }[];
  ingredients: { name: string; estimatedCost: number; goalAlignment: MonthlyGoal[] }[];
  tips: string[];
}

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
  const [recommendations, setRecommendations] = useState<AIRecommendation | null>(null);
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

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
    if (!user) return;
    
    setIsLoading(true);
    
    // Fetch current month's budget
    const { data: budgetData } = await supabase
      .from('monthly_budgets')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .single();

    if (budgetData) {
      setBudget(budgetData as unknown as MonthlyBudget);
      setBudgetAmount(budgetData.budget_amount.toString());

      // Fetch transactions
      const { data: transData } = await supabase
        .from('budget_transactions')
        .select('*')
        .eq('budget_id', budgetData.id)
        .order('transaction_date', { ascending: false });

      if (transData) {
        setTransactions(transData as unknown as BudgetTransaction[]);
      }
    }
    
    setIsLoading(false);
  };

  const saveBudget = async () => {
    if (!user || !budgetAmount) return;

    setIsSaving(true);
    
    if (budget) {
      // Update existing
      const { error } = await supabase
        .from('monthly_budgets')
        .update({ budget_amount: parseFloat(budgetAmount) })
        .eq('id', budget.id);

      if (!error) {
        setBudget({ ...budget, budget_amount: parseFloat(budgetAmount) });
        toast({ description: 'Budget updated!' });
      }
    } else {
      // Create new
      const { data, error } = await supabase
        .from('monthly_budgets')
        .insert({
          user_id: user.id,
          month: currentMonth,
          year: currentYear,
          budget_amount: parseFloat(budgetAmount),
        })
        .select()
        .single();

      if (!error && data) {
        setBudget(data as unknown as MonthlyBudget);
        toast({ description: 'Budget set!' });
      }
    }
    
    setIsSaving(false);
  };

  const addTransaction = async () => {
    if (!user || !budget || !transactionAmount) return;

    setIsAddingTransaction(true);
    
    const { data, error } = await supabase
      .from('budget_transactions')
      .insert({
        user_id: user.id,
        budget_id: budget.id,
        amount: parseFloat(transactionAmount),
        description: transactionDesc || 'Grocery purchase',
      })
      .select()
      .single();

    if (!error && data) {
      setTransactions([data as unknown as BudgetTransaction, ...transactions]);
      setTransactionAmount('');
      setTransactionDesc('');
      toast({ description: 'Purchase logged!' });
    }
    
    setIsAddingTransaction(false);
  };

  const getRecommendations = async () => {
    if (!budget || !profile?.monthly_goals?.length) return;

    setIsLoadingRecs(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('budget-recommendations', {
        body: {
          budgetAmount: budget.budget_amount,
          goals: profile.monthly_goals,
          dietaryStyle: profile.dietary_style,
          allergies: profile.allergies,
        },
      });

      if (error) throw error;
      
      // Check if response contains an error message
      if (data?.error) {
        throw new Error(data.error);
      }
      
      setRecommendations(data);
    } catch (error: any) {
      console.error('Error getting recommendations:', error);
      const errorMessage = error?.message || 'Failed to get recommendations';
      toast({
        variant: 'destructive',
        title: 'AI Recommendations Error',
        description: errorMessage.includes('credits') 
          ? 'AI credits exhausted. Please add credits in Settings → Workspace → Usage.'
          : errorMessage.includes('Rate limit')
          ? 'Too many requests. Please try again in a minute.'
          : 'Failed to get recommendations. Please try again.',
      });
    } finally {
      setIsLoadingRecs(false);
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
            <CardContent>
              {recommendations ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-2">Suggested ingredients:</p>
                    <div className="space-y-2">
                      {recommendations.ingredients.slice(0, 6).map((ing, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{ing.name}</span>
                            {ing.goalAlignment.map(g => (
                              <span key={g} className="text-xs">
                                {MONTHLY_GOALS.find(m => m.value === g)?.emoji}
                              </span>
                            ))}
                          </div>
                          <span className="text-sm text-muted-foreground">~${ing.estimatedCost}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {recommendations.tips.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">Tips:</p>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {recommendations.tips.map((tip, idx) => (
                          <li key={idx}>• {tip}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={getRecommendations}
                  disabled={isLoadingRecs}
                >
                  {isLoadingRecs ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Get Recommendations
                </Button>
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
