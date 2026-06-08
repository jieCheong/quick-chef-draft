import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { QuickBadge } from '@/components/ui/quick-badge';
import { GoalBadge } from '@/components/ui/goal-badge';
import { apiGet } from '@/lib/api';
import { ChefHat, Zap, Clock, Flame, Bookmark, TrendingUp, ArrowRight } from 'lucide-react';
import type { SavedRecipe } from '@/types/database';

interface ViralRecipe {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  tags: string[];
  nutrition: { calories: number; protein: number } | null;
}

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();

  const [recentRecipes, setRecentRecipes] = useState<SavedRecipe[]>([]);
  const [viralRecipes, setViralRecipes] = useState<ViralRecipe[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [loadingViral, setLoadingViral] = useState(true);

  useEffect(() => {
    if (!profileLoading && profile && !profile.onboarding_completed) {
      navigate('/onboarding');
    }
  }, [profileLoading, profile, navigate]);

  // fetch recent saved recipes
  useEffect(() => {
    if (!user) return;
    const fetchRecent = async () => {
      try {
        const data = await apiGet<SavedRecipe[]>('/api/recipes?limit=3');
        setRecentRecipes(data);
      } catch {

      } finally {
        setLoadingRecent(false);
      }
    };
    fetchRecent();
    }, [user]);

    useEffect(() => {
      const fetchViral = async () => {
        try {
          const data = await apiGet<ViralRecipe[]>('/api/viral-recipes');
          setViralRecipes(data);
        } catch {

        } finally {
          setLoadingViral(false);
        }
      };
      fetchViral();
    }, []);

  if (profileLoading) {
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

  const displayName = profile?.display_name || user?.email?.split('@')[0] ||'Chef';

  return (
    <MobileLayout>
      <div className="p-4 space-y-6">
        {/* Header */}
        <div className="pt-2">
          <p className="text-muted-foreground">{greeting()},</p>
          <h1 className="text-2xl font-bold">{displayName} 👋</h1>
        </div>

          <Card 
            className="bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90 transition-colors"
            onClick={() => navigate('/cook')}
            >
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
                <ChefHat className="h-7 w-7" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">What should I cook?
                </h3>
                <p className="text-sm opacity-90">Get AI-powered recipe suggestions</p>
                </div>
                <ArrowRight className="h-5 w-5" />
              </CardContent>
            </Card>

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

        {/* Viral Recipes - Trending this week */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
            <h2 className="font-semibold">Trending This Week
            </h2>
          </div>

          {loadingViral ? (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-32 w-40 flex-shrink-0 rounded-xl" />
              ))}
              </div>
          ) : viralRecipes.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4">
              {viralRecipes.map((recipe) => (
                <Card
                  key={recipe.id}
                  className="flex-shrink-0 w-44 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate('/cook')}
                  >
                    {recipe.image_url ? (
                      <div className="h-24 rounded-t-lg overflow-hidden">
                        <img
                          src={recipe.image_url}
                          alt={recipe.title}
                          className="w-full h-full object-cover"
                          />
                      </div>
                    ) : (
                      <div className="h-24 rounded-t-lg bg-gradient-to-br from-orange-100 to-red-100 flex items-center justify-center">
                        <Flame className="h-8 w-8 text-orange-400"/>
                        </div>
                    )}
                    <CardContent className="p-2">
                      <p className="text-xs font-medium line-clamp-2">{recipe.title}</p>
                      {recipe.nutrition && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {recipe.nutrition.calories} cal · {recipe.nutrition.protein}g protein
                        </p>
                      )}
                      </CardContent>
                  </Card>
              ))}

              </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="p-4 text-center">
                <Flame className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Trending recipes coming soon
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add rows to viral_recipes in Neon to show content here.
                </p>
              </CardContent>
            </Card>
          )}
        </section>        

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

        {/* Recent Recipes Placeholder */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
          <h2 className="font-semibold">Recent Recipes</h2>
          {recentRecipes.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => navigate('/saved')}>
              See all
              </Button>
          )}
          </div>
          {loadingRecent ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ): recentRecipes.length > 0 ? (
            <div className="space-y-2">
              {recentRecipes.map((recipe) => (
                <Card
                  key={recipe.id}
                  className="cursor-pointer hover:shadow-sm transition-shadow"
                  onClick={() => navigate('/saved')}
                  >
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <ChefHat className="h-5 w-5 text-primary"/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {recipe.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {recipe.cooking_time_minutes} min 
                        </span>
                        {recipe.is_quick_meal && <QuickBadge size="sm" />}
                      </div>
                    </div>
                    <Bookmark className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </CardContent>
                  </Card>
              ))}
              </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="p-6 text-center">
                <ChefHat className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3"/>
                <p className="text-sm text-muted-foreground">
                  No recipes yet. Start cooking!
                </p>
                <Button
                  variant='outline'
                  size='sm'
                  className='mt-3'
                  onClick={() => navigate('/cook')}
                  >
                    Generate Recipe 
                  </Button> 
                </CardContent>
              </Card>
          )}
          </section>
        </div>
        </MobileLayout>
  );
}