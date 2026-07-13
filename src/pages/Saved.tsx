// src/pages/Saved.tsx — redesigned UI, real API calls preserved
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { apiGet, apiDelete } from '@/lib/api';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { cn } from '@/lib/utils';
import { Plus, Bookmark, Clock, Flame, X } from 'lucide-react';
import type { SavedRecipe } from '@/types/database';

const FALLBACK = [
  'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&h=600&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&h=600&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&h=600&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop&auto=format',
];

const FILTERS = ['All', 'Quick', 'Easy', 'Healthy'];

export default function SavedRecipes() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    if (!user) return;
    apiGet<SavedRecipe[]>('/api/recipes')
      .then(setRecipes)
      .catch(() => toast({ variant: 'destructive', description: 'Failed to load saved recipes.' }))
      .finally(() => setIsLoading(false));
  }, [user]);

  const deleteRecipe = async (id: string) => {
    const prev = recipes;
    setRecipes(p => p.filter(r => r.id !== id));
    try {
      await apiDelete(`/api/recipes/${id}`);
      toast({ description: 'Recipe removed.' });
    } catch {
      setRecipes(prev);
      toast({ variant: 'destructive', description: 'Failed to delete recipe.' });
    }
  };

  const displayed = filter === 'All' ? recipes
    : filter === 'Quick' ? recipes.filter(r => r.is_quick_meal)
    : filter === 'Easy' ? recipes.filter(r => r.difficulty?.toLowerCase() === 'easy')
    : recipes.filter(r => r.goal_alignment?.some(g => g.toLowerCase().includes('protein') || g.toLowerCase().includes('calorie')));

  return (
    <MobileLayout>
      <div>
        <div className="px-5 pt-14 pb-5">
          <h1 className="text-4xl" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>Saved</h1>
          <p className="text-muted-foreground mt-1 text-sm">{recipes.length} recipes bookmarked</p>
        </div>

        {/* Filters */}
        <div className="flex gap-2 px-5 mb-5 overflow-x-auto pb-1">
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn('flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors',
                filter === f ? 'bg-foreground text-primary-foreground' : 'bg-secondary text-muted-foreground')}>
              {f}
            </button>
          ))}
        </div>

        <div className="px-5 space-y-3 pb-6">
          {isLoading ? (
            [1, 2, 3].map(i => <div key={i} className="h-24 bg-muted rounded-2xl animate-pulse" />)
          ) : displayed.length > 0 ? (
            displayed.map((recipe, idx) => (
              <div key={recipe.id} className="bg-card rounded-2xl overflow-hidden border border-border flex">
                <div className="w-28 flex-shrink-0 bg-muted">
                  <img
                    src={recipe.image_url || FALLBACK[idx % FALLBACK.length]}
                    alt={recipe.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-semibold text-sm leading-tight">{recipe.title}</h3>
                    <button onClick={() => deleteRecipe(recipe.id)} className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0">
                      <X size={14} />
                    </button>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock size={11} />{recipe.cooking_time_minutes} min</span>
                    {recipe.nutrition && <span className="flex items-center gap-1"><Flame size={11} />{recipe.nutrition.calories} cal</span>}
                  </div>
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {recipe.cuisines?.slice(0, 2).map(t => (
                      <span key={t} className="text-[10px] bg-secondary px-2 py-0.5 rounded-full text-muted-foreground capitalize">{t}</span>
                    ))}
                    {recipe.is_quick_meal && (
                      <span className="text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded-full">Quick</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <Bookmark size={32} className="mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                {filter !== 'All' ? 'No matching recipes' : 'No saved recipes yet'}
              </p>
            </div>
          )}

          <button onClick={() => navigate('/cook')}
            className="w-full rounded-2xl border-2 border-dashed border-border py-5 flex flex-col items-center gap-1.5 text-muted-foreground hover:border-accent hover:text-accent transition-colors">
            <Plus size={18} />
            <span className="text-sm font-medium">Generate a new recipe</span>
          </button>
        </div>
      </div>
    </MobileLayout>
  );
}
