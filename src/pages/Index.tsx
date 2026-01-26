import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { QuickBadge } from '@/components/ui/quick-badge';
import { GoalBadge } from '@/components/ui/goal-badge';
import { ChefHat, Zap, DollarSign, TrendingUp, ArrowRight } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!profileLoading && profile && !profile.onboarding_completed) {
      navigate('/onboarding');
    }
  }, [profileLoading, profile, navigate]);

  if (authLoading || profileLoading) {
    return (
      <MobileLayout>
        <div className="p-4 space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </MobileLayout>
    );
  }

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const displayName = profile?.display_name || 'Chef';

  return (
    <MobileLayout>
      <div className="p-4 space-y-6">
        {/* Header */}
        <div className="pt-2">
          <p className="text-muted-foreground">{greeting()},</p>
          <h1 className="text-2xl font-bold">{displayName} 👋</h1>
        </div>

        {/* Quick Meals Section */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-quick fill-quick" />
            <h2 className="font-semibold">Quick Meals</h2>
            <QuickBadge size="sm" />
          </div>
          <Card className="bg-gradient-to-br from-quick/10 to-primary/5 border-quick/20">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground mb-3">
                Need something fast? Get recipes ready in under 15 minutes.
              </p>
              <Button 
                size="sm" 
                onClick={() => navigate('/cook?quick=true')}
                className="bg-quick text-quick-foreground hover:bg-quick/90"
              >
                Find Quick Meals
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* Main CTA */}
        <Card 
          className="bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90 transition-colors"
          onClick={() => navigate('/cook')}
        >
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
              <ChefHat className="h-7 w-7" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">What should I cook?</h3>
              <p className="text-sm opacity-90">Get AI-powered recipe suggestions</p>
            </div>
            <ArrowRight className="h-5 w-5" />
          </CardContent>
        </Card>

        {/* Monthly Goals */}
        {profile?.monthly_goals && profile.monthly_goals.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">This Month's Goals</h2>
              <Button variant="ghost" size="sm" onClick={() => navigate('/profile')}>
                Edit
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {profile.monthly_goals.map((goal) => (
                <GoalBadge key={goal} goal={goal} />
              ))}
            </div>
          </section>
        )}

        {/* Budget Overview */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-accent" />
              <h2 className="font-semibold">Grocery Budget</h2>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/budget')}>
              Manage
            </Button>
          </div>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">This month</span>
                <TrendingUp className="h-4 w-4 text-accent" />
              </div>
              <p className="text-2xl font-bold">Set your budget</p>
              <p className="text-sm text-muted-foreground mt-1">
                Track spending and get AI recommendations
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3"
                onClick={() => navigate('/budget')}
              >
                Get Started
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* Recent Recipes Placeholder */}
        <section className="space-y-3">
          <h2 className="font-semibold">Recent Recipes</h2>
          <Card className="border-dashed">
            <CardContent className="p-6 text-center">
              <ChefHat className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                No recipes yet. Start cooking to see your history here!
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3"
                onClick={() => navigate('/cook')}
              >
                Generate Recipe
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>
    </MobileLayout>
  );
}
