// src/pages/Cook.tsx — redesigned with MobileLayout wrapper on all states
import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useToast } from '@/hooks/use-toast';
import { apiGet, apiPost } from '@/lib/api';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { cn } from '@/lib/utils';
import type { PantryItem, SavedRecipe } from '@/types/database';
import {
  ChefHat, Plus, X, Sparkles, ArrowLeft, Heart,
  Timer, Zap, Package, Clock, Flame, Leaf, Star,
  Bookmark, Play,
} from 'lucide-react';

type CookStep = 'input' | 'generating' | 'results' | 'detail';

interface RecipeIngredient { name: string; amount: string; unit: string; }
interface RecipeInstruction { step: number; instruction: string; duration_minutes?: number; }
interface RecipeNutrition { calories: number; protein: number; carbs: number; fat: number; fiber: number; }
interface GeneratedRecipe {
  title: string; description: string; cooking_time_minutes: number;
  difficulty: string; servings: number; is_quick_meal: boolean;
  cuisines: string[]; goal_alignment: string[];
  ingredients: RecipeIngredient[]; instructions: RecipeInstruction[];
  nutrition: RecipeNutrition; image_url?: string | null;
}

const FALLBACK = [
  'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&h=600&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&h=600&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&h=600&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop&auto=format',
];

function RecipeDetail({ recipe, idx, onBack, onSave, saving }: {
  recipe: GeneratedRecipe; idx: number; onBack: () => void;
  onSave: (r: GeneratedRecipe) => void; saving: boolean;
}) {
  const [tab, setTab] = useState<'ingredients' | 'steps'>('ingredients');
  const [saved, setSaved] = useState(false);
  const img = recipe.image_url || FALLBACK[idx % FALLBACK.length];

  const handleSave = () => { if (saved) return; setSaved(true); onSave(recipe); };

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
            <button onClick={handleSave} disabled={saving}
              className={cn('w-9 h-9 rounded-full flex items-center justify-center transition-colors',
                saved ? 'bg-accent text-white' : 'bg-black/40 backdrop-blur-sm text-white')}>
              <Bookmark size={17} />
            </button>
          </div>
        </div>

        <div className="-mt-5 bg-background rounded-t-3xl px-5 pt-6 pb-20">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {recipe.cuisines.map(t => (
              <span key={t} className="text-xs bg-secondary px-2.5 py-1 rounded-full text-muted-foreground capitalize">{t}</span>
            ))}
            {recipe.is_quick_meal && (
              <span className="text-xs bg-accent/10 text-accent px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
                <Zap size={9} /> Quick
              </span>
            )}
          </div>

          <h1 className="text-2xl leading-tight mb-1" style={{ fontFamily: 'Fraunces, serif' }}>{recipe.title}</h1>
          <p className="text-sm text-muted-foreground mb-5">{recipe.description}</p>

          <div className="grid grid-cols-4 gap-2 mb-6">
            {[
              { label: 'Time', value: `${recipe.cooking_time_minutes}m`, icon: <Clock size={13} /> },
              { label: 'Calories', value: `${recipe.nutrition.calories}`, icon: <Flame size={13} /> },
              { label: 'Protein', value: `${recipe.nutrition.protein}g`, icon: <Leaf size={13} /> },
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
            <div className="space-y-4 mb-6">
              {recipe.instructions.map((s, i) => (
                <div key={i} className="flex gap-3.5">
                  <div className="w-7 h-7 rounded-full bg-accent text-white flex-shrink-0 flex items-center justify-center text-xs font-bold">{s.step}</div>
                  <p className="text-sm leading-relaxed pt-1">{s.instruction}</p>
                </div>
              ))}
            </div>
          )}

          <button onClick={handleSave} disabled={saved || saving}
            className="w-full bg-foreground text-primary-foreground rounded-2xl py-4 font-semibold flex items-center justify-center gap-2.5 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50">
            <Play size={17} />
            {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Recipe'}
          </button>
        </div>
      </div>
    </MobileLayout>
  );
}

export default function Cook() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { toast } = useToast();
  const [step, setStep] = useState<CookStep>('input');
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [craving, setCraving] = useState('');
  const [selectedTime, setSelectedTime] = useState(30);
  const [quickMealsOnly, setQuickMealsOnly] = useState(false);
  const [generatedRecipes, setGeneratedRecipes] = useState<GeneratedRecipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<GeneratedRecipe | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [savingRecipe, setSavingRecipe] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    apiGet<PantryItem[]>('/api/pantry').then(setPantryItems).catch(() => {});
  }, [user]);

  const addIngredient = () => {
    const t = input.trim().toLowerCase();
    if (t && !ingredients.includes(t)) setIngredients(p => [...p, t]);
    setInput('');
  };

  const generateRecipes = async (retry = 0) => {
    if (ingredients.length === 0) {
      toast({ variant: 'destructive', description: 'Please add at least one ingredient.' });
      return;
    }
    setStep('generating');
    setGeneratedRecipes([]);
    setRetryCount(retry);
    try {
      const data = await apiPost<{ recipes: GeneratedRecipe[]; usage: { used: number; max: number; remaining: number } }>(
        '/api/generate-recipe', {
          ingredients, maxTime: quickMealsOnly ? 15 : selectedTime,
          dietaryStyle: profile?.dietary_style, allergies: profile?.allergies,
          skillLevel: profile?.skill_level, cuisines: profile?.preferred_cuisines,
          goals: profile?.monthly_goals, craving: craving.trim() || undefined,
        }
      );
      setGeneratedRecipes(data.recipes);
      setStep('results');
      setRetryCount(0);
      if (data.usage.remaining === 1) toast({ description: '1 free generation remaining today.' });
      if (data.usage.remaining === 0) toast({ description: "You've used all free generations for today." });
    } catch (error: unknown) {
      const err = error as { message?: string };
      if (err?.message?.includes('Daily limit')) {
        toast({ variant: 'destructive', title: 'Daily limit reached', description: err.message });
        setStep('input'); return;
      }
      if (retry < 2) {
        toast({ description: 'Connection slow, retrying...' });
        setTimeout(() => generateRecipes(retry + 1), Math.pow(2, retry) * 1000); return;
      }
      toast({ variant: 'destructive', description: 'Failed to generate recipes. Please try again.' });
      setStep('input'); setRetryCount(0);
    }
  };

  const saveRecipe = async (recipe: GeneratedRecipe) => {
    if (!user) return;
    setSavingRecipe(true);
    try {
      await apiPost<SavedRecipe>('/api/recipes', recipe);
      toast({ title: 'Recipe saved!', description: 'Find it in your saved recipes.' });
    } catch {
      toast({ variant: 'destructive', description: 'Failed to save recipe.' });
    } finally {
      setSavingRecipe(false);
    }
  };

  if (step === 'detail' && selectedRecipe) {
    return <RecipeDetail recipe={selectedRecipe} idx={selectedIdx} onBack={() => setStep('results')} onSave={saveRecipe} saving={savingRecipe} />;
  }

  if (step === 'generating') {
    return (
      <MobileLayout>
        <div className="flex flex-col items-center justify-center min-h-[80vh] px-8 text-center">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }} className="mb-6">
            <ChefHat size={52} className="text-accent" />
          </motion.div>
          <h2 className="text-xl font-semibold mb-2" style={{ fontFamily: 'Fraunces, serif' }}>Cooking up ideas...</h2>
          <p className="text-muted-foreground text-sm max-w-[220px]">
            {retryCount > 0 ? `Retrying... (attempt ${retryCount + 1})` : 'Our AI chef is crafting recipes tailored to your ingredients'}
          </p>
          <div className="flex gap-2 mt-8">
            {[0, 1, 2].map(i => (
              <motion.div key={i} className="w-2 h-2 rounded-full bg-accent"
                animate={{ opacity: [0.25, 1, 0.25] }} transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.22 }} />
            ))}
          </div>
        </div>
      </MobileLayout>
    );
  }

  if (step === 'results') {
    return (
      <MobileLayout>
        <div>
          <div className="flex items-center gap-3 px-5 pt-14 pb-5">
            <button onClick={() => setStep('input')} className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
              <ArrowLeft size={17} />
            </button>
            <div>
              <h1 className="text-xl font-bold" style={{ fontFamily: 'Fraunces, serif' }}>Recipe Ideas</h1>
              <p className="text-xs text-muted-foreground">Based on {ingredients.length} ingredient{ingredients.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="px-5 space-y-4 pb-6">
            {generatedRecipes.map((recipe, idx) => (
              <button key={idx} onClick={() => { setSelectedRecipe(recipe); setSelectedIdx(idx); setStep('detail'); }}
                className="w-full bg-card rounded-2xl overflow-hidden border border-border hover:border-accent/30 active:scale-[0.99] transition-all text-left">
                <div className="h-44 bg-muted overflow-hidden">
                  <img src={recipe.image_url || FALLBACK[idx % FALLBACK.length]} alt={recipe.title} className="w-full h-full object-cover" />
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-semibold text-base leading-tight">{recipe.title}</h3>
                    <span className="flex-shrink-0 text-xs bg-secondary px-2.5 py-1 rounded-full text-muted-foreground">{recipe.difficulty}</span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{recipe.description}</p>
                  <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><Clock size={12} />{recipe.cooking_time_minutes} min</span>
                    <span className="flex items-center gap-1.5"><Flame size={12} />{recipe.nutrition.calories} cal</span>
                    <div className="flex gap-1.5 ml-auto">
                      {recipe.cuisines.slice(0, 2).map(t => (
                        <span key={t} className="bg-secondary px-2 py-0.5 rounded-full capitalize">{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </button>
            ))}
            <button onClick={() => generateRecipes()}
              className="w-full rounded-2xl border-2 border-dashed border-border py-4 flex items-center justify-center gap-2 text-muted-foreground hover:border-accent hover:text-accent transition-colors">
              <Sparkles size={16} /><span className="text-sm font-medium">Generate more</span>
            </button>
          </div>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div>
        <div className="px-5 pt-14 pb-6">
          <h1 className="text-4xl leading-tight" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
            What should<br />I cook?
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">Tell us what you have — we'll do the rest</p>
        </div>

        <div className="px-5 mb-5">
          <label className="flex items-center gap-1.5 text-sm font-medium mb-2">
            <Heart size={13} className="text-accent" /> I'm craving...
          </label>
          <input type="text" placeholder="pizza, something spicy, comfort food..."
            value={craving} onChange={e => setCraving(e.target.value)}
            className="w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent/30 placeholder:text-muted-foreground transition-shadow" />
        </div>

        <div className="px-5 mb-5">
          <label className="text-sm font-medium block mb-2">Ingredients</label>
          <div className="flex gap-2">
            <input type="text" placeholder="Type an ingredient..."
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addIngredient()}
              className="flex-1 bg-secondary rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent/30 placeholder:text-muted-foreground transition-shadow" />
            <button onClick={addIngredient} disabled={!input.trim()}
              className="w-11 h-11 rounded-xl bg-accent text-white flex items-center justify-center disabled:opacity-35 hover:opacity-90 active:scale-95 transition-all">
              <Plus size={18} />
            </button>
          </div>
          {ingredients.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {ingredients.map(ing => (
                <span key={ing} className="flex items-center gap-1.5 bg-foreground text-primary-foreground text-sm px-3 py-1.5 rounded-full">
                  {ing}
                  <button onClick={() => setIngredients(p => p.filter(i => i !== ing))} className="opacity-60 hover:opacity-100">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 mb-6">
          <label className="flex items-center gap-1.5 text-sm font-medium mb-3"><Timer size={13} /> Time available</label>
          <div className="grid grid-cols-4 gap-2">
            {[{ value: 15, label: '15m', quick: true }, { value: 30, label: '30m', quick: false },
              { value: 45, label: '45m', quick: false }, { value: 60, label: '1h+', quick: false }].map(({ value, label, quick }) => (
              <button key={value} onClick={() => { setSelectedTime(value); setQuickMealsOnly(quick); }}
                className={cn('rounded-xl py-3 text-sm font-medium transition-colors flex flex-col items-center gap-1',
                  selectedTime === value ? quick ? 'bg-accent text-white' : 'bg-foreground text-primary-foreground' : 'bg-secondary text-foreground')}>
                {quick && <Zap size={11} className={selectedTime === value ? 'text-white' : 'text-accent'} />}
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 mb-6">
          <button onClick={() => setIngredients(p => [...new Set([...p, ...pantryItems.slice(0, 8).map(i => i.name.toLowerCase())])])}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-dashed border-border text-sm text-muted-foreground hover:border-accent hover:text-accent transition-colors">
            <Package size={15} />
            {pantryItems.length > 0 ? `Add from pantry (${pantryItems.length} items available)` : 'Add from pantry'}
          </button>
        </div>

        <div className="px-5 pb-6">
          <button onClick={() => generateRecipes()} disabled={ingredients.length === 0}
            className="w-full bg-foreground text-primary-foreground rounded-2xl py-4 font-semibold flex items-center justify-center gap-2.5 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-35">
            <Sparkles size={17} /> Generate Recipes
          </button>
        </div>
      </div>
    </MobileLayout>
  );
}
