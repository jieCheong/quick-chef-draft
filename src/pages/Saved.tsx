// src/pages/Saved.tsx — redesigned UI, real API calls preserved
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { cn } from '@/lib/utils';
import {
  Plus, Bookmark, Clock, Flame, X, ArrowLeft, Leaf, Star,
  Zap, Loader2, Image as ImageIcon, Trash2,
} from 'lucide-react';
import type { SavedRecipe, RecipeInstruction } from '@/types/database';

const FALLBACK = [
  'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&h=600&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&h=600&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&h=600&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop&auto=format',
];

const FILTERS = ['All', 'Quick', 'Trendy', 'Healthy'];

function SavedRecipeDetail({ recipe, idx, onBack, onDelete, onInstructionsUpdated }: {
  recipe: SavedRecipe; idx: number; onBack: () => void;
  onDelete: (id: string) => void;
  onInstructionsUpdated: (id: string, instructions: RecipeInstruction[]) => void;
}) {
  const { toast } = useToast();
  const [tab, setTab] = useState<'ingredients' | 'steps'>('ingredients');
  const [instructions, setInstructions] = useState<RecipeInstruction[]>(recipe.instructions);
  const [generatingSteps, setGeneratingSteps] = useState<Set<number>>(new Set());
  const img = recipe.image_url || FALLBACK[idx % FALLBACK.length];
  const isFirstRender = useRef(true);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const instructionsRef = useRef(instructions);
  const hasPendingWrite = useRef(false);
  instructionsRef.current = instructions;

  const generateStepImage = async (s: RecipeInstruction) => {
    setGeneratingSteps(prev => new Set(prev).add(s.step));
    try {
      const data = await apiPost<{ image_url: string }>('/api/generate-image', {
        recipeTitle: recipe.title,
        stepInstruction: s.instruction,
        stepNumber: s.step,
      });
      setInstructions(prev => prev.map(i => i.step === s.step ? { ...i, image_url: data.image_url } : i));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate image.';
      toast({ variant: 'destructive', description: message });
    } finally {
      setGeneratingSteps(prev => {
        const next = new Set(prev);
        next.delete(s.step);
        return next;
      });
    }
  };

  // Fires the actual write of whatever the latest instructions are right
  // now. Called both from the debounced timer below and immediately on
  // unmount, so a pending write is never silently dropped just because
  // the user navigated away before the debounce delay elapsed.
  const flushPersist = () => {
    if (!hasPendingWrite.current) return;
    hasPendingWrite.current = false;
    const current = instructionsRef.current;
    apiPatch(`/api/recipes/${recipe.id}`, { instructions: current })
      .then(() => onInstructionsUpdated(recipe.id, current))
      .catch(() => toast({ variant: 'destructive', description: 'Failed to save generated image to this recipe.' }));
  };

  // Persist the full instructions array whenever it changes, debounced.
  // Steps generate in parallel, so several completions can land within
  // milliseconds of each other — PATCHing separately per-step risked a
  // slower-arriving request overwriting a newer one's image (observed live:
  // 3/3 images generated but only 2/3 persisted). Debouncing coalesces
  // near-simultaneous completions into a single write of the latest,
  // fully-merged state instead of racing independent requests.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    hasPendingWrite.current = true;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(flushPersist, 800);
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instructions]);

  // Flush any still-pending write immediately when the user navigates away
  // from this recipe (back button or delete) — otherwise a debounce window
  // shorter than the time-to-navigate would silently lose a generated image.
  useEffect(() => {
    return () => flushPersist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-generate every step's image as soon as the Steps tab opens.
  useEffect(() => {
    if (tab !== 'steps') return;
    instructions.forEach(s => {
      if (!s.image_url && !generatingSteps.has(s.step)) {
        generateStepImage(s);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const handleDelete = () => {
    onDelete(recipe.id);
    onBack();
  };

  return (
    <MobileLayout showNav={false}>
      <div>
        <div className="relative h-64 bg-muted">
          <img src={img} alt={recipe.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent" />
          <div className="absolute top-14 inset-x-0 px-5 flex items-center justify-between">
            <button onClick={onBack} className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white">
              <ArrowLeft size={17} />
            </button>
            <button onClick={handleDelete} className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-destructive transition-colors">
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        <div className="-mt-5 bg-background rounded-t-3xl px-5 pt-6 pb-20">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {recipe.cuisines?.map(t => (
              <span key={t} className="text-xs bg-secondary px-2.5 py-1 rounded-full text-muted-foreground capitalize">{t}</span>
            ))}
            {recipe.is_quick_meal && (
              <span className="text-xs bg-accent/10 text-accent px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
                <Zap size={9} /> Quick
              </span>
            )}
          </div>

          <h1 className="text-2xl leading-tight mb-1" style={{ fontFamily: 'Fraunces, serif' }}>{recipe.title}</h1>
          {recipe.description && <p className="text-sm text-muted-foreground mb-5">{recipe.description}</p>}

          <div className="grid grid-cols-4 gap-2 mb-6">
            {[
              { label: 'Time', value: `${recipe.cooking_time_minutes}m`, icon: <Clock size={13} /> },
              { label: 'Calories', value: `${recipe.nutrition?.calories ?? '—'}`, icon: <Flame size={13} /> },
              { label: 'Protein', value: `${recipe.nutrition?.protein ?? '—'}g`, icon: <Leaf size={13} /> },
              { label: 'Difficulty', value: recipe.difficulty, icon: <Star size={13} /> },
            ].map(({ label, value, icon }) => (
              <div key={label} className="bg-secondary rounded-xl p-2.5 text-center">
                <div className="flex justify-center text-accent mb-1">{icon}</div>
                <p className="font-semibold text-xs">{value}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-1 bg-secondary p-1 rounded-xl mb-5">
            {(['ingredients', 'steps'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={cn('flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors',
                  tab === t ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground')}>
                {t}
              </button>
            ))}
          </div>

          {tab === 'ingredients' ? (
            <div className="space-y-1 mb-6">
              {recipe.ingredients.map((ing, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                  <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-[10px] font-semibold text-muted-foreground flex-shrink-0">{i + 1}</div>
                  <span className="text-sm"><span className="font-medium">{ing.amount} {ing.unit}</span> {ing.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-5 mb-6">
              {instructions.map((s, i) => (
                <div key={i} className="space-y-2.5">
                  <div className="flex gap-3.5">
                    <div className="w-7 h-7 rounded-full bg-accent text-white flex-shrink-0 flex items-center justify-center text-xs font-bold">{s.step}</div>
                    <p className="text-sm leading-relaxed pt-1">{s.instruction}</p>
                  </div>
                  {s.image_url ? (
                    <img src={s.image_url} alt={`Step ${s.step}`} className="w-full h-40 object-cover rounded-xl" />
                  ) : generatingSteps.has(s.step) ? (
                    <div className="w-full h-40 rounded-xl bg-secondary flex items-center justify-center">
                      <Loader2 size={20} className="animate-spin text-accent" />
                    </div>
                  ) : (
                    <button
                      onClick={() => generateStepImage(s)}
                      className="w-full py-2.5 rounded-xl border border-dashed border-border text-xs font-medium text-muted-foreground hover:border-accent hover:text-accent transition-colors flex items-center justify-center gap-1.5"
                    >
                      <ImageIcon size={13} /> Generate image
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </MobileLayout>
  );
}

export default function SavedRecipes() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [selectedRecipe, setSelectedRecipe] = useState<SavedRecipe | null>(null);

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

  const updateInstructions = (id: string, instructions: RecipeInstruction[]) => {
    setRecipes(prev => prev.map(r => r.id === id ? { ...r, instructions } : r));
  };

  const displayed = filter === 'All' ? recipes
    : filter === 'Quick' ? recipes.filter(r => r.is_quick_meal)
    : filter === 'Trendy' ? recipes.filter(r => r.is_trending)
    : recipes.filter(r => r.goal_alignment?.some(g => g.toLowerCase().includes('protein') || g.toLowerCase().includes('calorie')));

  if (selectedRecipe) {
    return (
      <SavedRecipeDetail
        recipe={selectedRecipe}
        idx={displayed.findIndex(r => r.id === selectedRecipe.id)}
        onBack={() => setSelectedRecipe(null)}
        onDelete={deleteRecipe}
        onInstructionsUpdated={updateInstructions}
      />
    );
  }

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
              <div
                key={recipe.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedRecipe(recipe)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedRecipe(recipe); }}
                className="w-full bg-card rounded-2xl overflow-hidden border border-border flex text-left hover:border-accent/30 active:scale-[0.99] transition-all cursor-pointer"
              >
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
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteRecipe(recipe.id); }}
                      className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                    >
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
                    {recipe.is_trending && (
                      <span className="text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded-full">Trendy</span>
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
