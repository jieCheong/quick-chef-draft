import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { RecipeCard } from '@/components/recipe/RecipeCard';
import { QuickBadge } from '@/components/ui/quick-badge';
import { GoalBadge } from '@/components/ui/goal-badge';
import { supabase } from '@/integrations/supabase/client';
import { Search, BookmarkCheck, Zap, Filter, ChefHat, Clock, ArrowLeft, Bookmark, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { SavedRecipe, MonthlyGoal } from '@/types/database';

export default function SavedRecipes() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [quickFilter, setQuickFilter] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<SavedRecipe | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (user) {
      fetchRecipes();
    }
  }, [user]);

  const fetchRecipes = async () => {
    if (!user) return;
    
    setIsLoading(true);
    const { data, error } = await supabase
      .from('saved_recipes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setRecipes(data as unknown as SavedRecipe[]);
    }
    setIsLoading(false);
  };

  const deleteRecipe = async (id: string) => {
    const { error } = await supabase
      .from('saved_recipes')
      .delete()
      .eq('id', id);

    if (!error) {
      setRecipes(recipes.filter(r => r.id !== id));
      setSelectedRecipe(null);
      toast({ description: 'Recipe removed from favorites' });
    }
  };

  const filteredRecipes = recipes.filter(recipe => {
    const matchesSearch = recipe.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesQuick = !quickFilter || recipe.is_quick_meal;
    return matchesSearch && matchesQuick;
  });

  // Recipe Detail View
  if (selectedRecipe) {
    return (
      <MobileLayout showNav={false}>
        <div className="min-h-screen">
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
            <div className="flex items-center justify-between p-4">
              <Button variant="ghost" size="icon" onClick={() => setSelectedRecipe(null)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <Button 
                variant="destructive" 
                size="sm"
                onClick={() => deleteRecipe(selectedRecipe.id)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Remove
              </Button>
            </div>
          </div>

          <div className="p-4 space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                {selectedRecipe.is_quick_meal && <QuickBadge />}
              </div>
              <h1 className="text-2xl font-bold">{selectedRecipe.title}</h1>
              {selectedRecipe.description && (
                <p className="text-muted-foreground mt-2">{selectedRecipe.description}</p>
              )}
            </div>

            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{selectedRecipe.cooking_time_minutes} min</span>
              </div>
              <Badge variant="secondary">{selectedRecipe.difficulty}</Badge>
              <span>{selectedRecipe.servings} servings</span>
            </div>

            {selectedRecipe.goal_alignment.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedRecipe.goal_alignment.map(goal => (
                  <GoalBadge key={goal} goal={goal} />
                ))}
              </div>
            )}

            {selectedRecipe.nutrition && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-medium mb-3">Nutrition</h3>
                  <div className="grid grid-cols-5 gap-2 text-center">
                    <div>
                      <p className="text-lg font-semibold">{selectedRecipe.nutrition.calories}</p>
                      <p className="text-xs text-muted-foreground">cal</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold">{selectedRecipe.nutrition.protein}g</p>
                      <p className="text-xs text-muted-foreground">protein</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold">{selectedRecipe.nutrition.carbs}g</p>
                      <p className="text-xs text-muted-foreground">carbs</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold">{selectedRecipe.nutrition.fat}g</p>
                      <p className="text-xs text-muted-foreground">fat</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold">{selectedRecipe.nutrition.fiber}g</p>
                      <p className="text-xs text-muted-foreground">fiber</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium mb-3">Ingredients</h3>
                <ul className="space-y-2">
                  {selectedRecipe.ingredients.map((ing, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                      <span>
                        <strong>{ing.amount} {ing.unit}</strong> {ing.name}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium mb-3">Instructions</h3>
                <ol className="space-y-4">
                  {selectedRecipe.instructions.map((step, idx) => (
                    <li key={idx} className="flex gap-3">
                      <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center flex-shrink-0">
                        {step.step}
                      </span>
                      <p className="text-sm leading-relaxed">{step.instruction}</p>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </div>
        </div>
      </MobileLayout>
    );
  }

  if (authLoading || isLoading) {
    return (
      <MobileLayout>
        <div className="p-4 space-y-4">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-12 w-full" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="p-4 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Saved Recipes</h1>
          <p className="text-muted-foreground">Your favorite recipes</p>
        </div>

        {/* Search & Filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search recipes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant={quickFilter ? 'default' : 'outline'}
            size="icon"
            onClick={() => setQuickFilter(!quickFilter)}
            className={cn(quickFilter && 'bg-quick text-quick-foreground hover:bg-quick/90')}
          >
            <Zap className="h-4 w-4" />
          </Button>
        </div>

        {/* Filter Info */}
        {quickFilter && (
          <div className="flex items-center gap-2">
            <QuickBadge size="sm" />
            <span className="text-sm text-muted-foreground">Showing quick meals only</span>
          </div>
        )}

        {/* Recipes Grid */}
        {filteredRecipes.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {filteredRecipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onClick={() => setSelectedRecipe(recipe)}
              />
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="p-6 text-center">
              <BookmarkCheck className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                {searchQuery || quickFilter ? 'No matching recipes found' : 'No saved recipes yet'}
              </p>
              {!searchQuery && !quickFilter && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-3"
                  onClick={() => navigate('/cook')}
                >
                  Generate Recipes
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </MobileLayout>
  );
}
