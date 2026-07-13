// src/pages/Index.tsx
//
// Home page — redesigned UI with real data from the backend.
// Visual design from Figma redesign (Fraunces font, warm accent, card layouts).
// All API calls and hooks preserved from the original implementation.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { apiGet } from '@/lib/api';
import { MobileLayout } from '@/components/layout/MobileLayout';
import {
  ChefHat, Package, Bookmark, ChevronRight,
  Zap, Clock, Flame, TrendingUp, Plus,
} from 'lucide-react';
import type { SavedRecipe } from '@/types/database';

// Fallback image for recipes that have no image_url yet.
// Phase 2 will add real DALL-E images — this keeps the UI looking
// complete in the meantime.
const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&h=600&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&h=600&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&h=600&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop&auto=format',
];

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

  // Redirect to onboarding if the user hasn't completed setup yet.
  useEffect(() => {
    if (!profileLoading && profile && !profile.onboarding_completed) {
      navigate('/onboarding');
    }
  }, [profileLoading, profile, navigate]);

  // Fetch the 3 most recent saved recipes for the "Recent" section.
  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      try {
        const data = await apiGet<SavedRecipe[]>('/api/recipes?limit=3');
        setRecentRecipes(data);
      } catch {
        // Fail silently — home page still works without recent recipes
      } finally {
        setLoadingRecent(false);
      }
    };
    fetch();
  }, [user]);

  // Fetch viral/trending recipes — public endpoint, no auth needed.
  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await apiGet<ViralRecipe[]>('/api/viral-recipes');
        setViralRecipes(data);
      } catch {
        // Fail silently
      } finally {
        setLoadingViral(false);
      }
    };
    fetch();
  }, []);

  // Time-based greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'Chef';

  // Show a minimal loading state while profile loads to prevent flash
  if (profileLoading) {
    return (
      <MobileLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="px-5 pt-14 pb-6">
        <p className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
          {greeting}
        </p>
        <h1 className="text-4xl mt-1" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
          {displayName} 👋
        </h1>
      </div>

      {/* ── Main CTA ────────────────────────────────────────────────────────── */}
      <div className="px-5 mb-6">
        <button
          onClick={() => navigate('/cook')}
          className="w-full bg-foreground text-primary-foreground rounded-2xl p-5 flex items-center gap-4 hover:opacity-90 active:scale-[0.98] transition-all"
        >
          <div className="w-12 h-12 rounded-xl bg-accent/25 flex items-center justify-center flex-shrink-0">
            <ChefHat size={22} className="text-accent" />
          </div>
          <div className="flex-1 text-left">
            <p className="font-semibold text-base leading-tight">What should I cook?</p>
            <p className="text-sm opacity-60 mt-0.5">Get AI recipe ideas</p>
          </div>
          <ChevronRight size={18} className="opacity-40" />
        </button>
      </div>

      {/* ── Quick stats ─────────────────────────────────────────────────────── */}
      <div className="px-5 mb-6">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border border-border rounded-2xl p-3.5">
            <div className="text-muted-foreground mb-2">
              <Bookmark size={15} />
            </div>
            <p className="text-xl font-bold">{recentRecipes.length > 0 ? recentRecipes.length : '—'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Saved</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-3.5">
            <div className="text-muted-foreground mb-2">
              <Zap size={15} />
            </div>
            <p className="text-xl font-bold">2</p>
            <p className="text-xs text-muted-foreground mt-0.5">Daily left</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-3.5">
            <div className="text-muted-foreground mb-2">
              <TrendingUp size={15} />
            </div>
            <p className="text-xl font-bold">{viralRecipes.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Trending</p>
          </div>
        </div>
      </div>

      {/* ── Recent recipes ──────────────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center justify-between px-5 mb-3">
          <h2 className="font-semibold text-sm tracking-wide uppercase text-muted-foreground">
            Recent
          </h2>
          <button
            onClick={() => navigate('/saved')}
            className="text-accent text-sm font-medium hover:opacity-80"
          >
            See all
          </button>
        </div>

        {loadingRecent ? (
          <div className="flex gap-3 px-5">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="flex-shrink-0 w-40 h-36 bg-muted rounded-2xl animate-pulse"
              />
            ))}
          </div>
        ) : recentRecipes.length > 0 ? (
          <div className="flex gap-3 px-5 overflow-x-auto pb-1">
            {recentRecipes.map((recipe, idx) => (
              <button
                key={recipe.id}
                onClick={() => navigate('/saved')}
                className="flex-shrink-0 w-40 bg-card rounded-2xl overflow-hidden border border-border text-left hover:border-accent/30 active:scale-[0.98] transition-all"
              >
                <div className="h-24 bg-muted overflow-hidden">
                  <img
                    src={recipe.image_url || FALLBACK_IMAGES[idx % FALLBACK_IMAGES.length]}
                    alt={recipe.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-3">
                  <p className="font-medium text-sm leading-tight line-clamp-2">
                    {recipe.title}
                  </p>
                  <div className="flex items-center gap-1 mt-1.5 text-muted-foreground">
                    <Clock size={11} />
                    <span className="text-xs">{recipe.cooking_time_minutes} min</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          // Empty state — encourage first generation
          <div className="px-5">
            <button
              onClick={() => navigate('/cook')}
              className="w-full rounded-2xl border-2 border-dashed border-border py-5 flex flex-col items-center gap-1.5 text-muted-foreground hover:border-accent hover:text-accent transition-colors"
            >
              <Plus size={18} />
              <span className="text-sm font-medium">Generate your first recipe</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Trending This Week ──────────────────────────────────────────────── */}
      {(loadingViral || viralRecipes.length > 0) && (
        <div className="mb-6">
          <div className="px-5 mb-3">
            <h2 className="font-semibold text-sm tracking-wide uppercase text-muted-foreground">
              Trending This Week
            </h2>
          </div>

          {loadingViral ? (
            <div className="flex gap-3 px-5">
              {[1, 2].map(i => (
                <div
                  key={i}
                  className="flex-shrink-0 w-44 h-36 bg-muted rounded-2xl animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="flex gap-3 px-5 overflow-x-auto pb-1">
              {viralRecipes.map((recipe, idx) => (
                <button
                  key={recipe.id}
                  onClick={() => navigate('/cook')}
                  className="flex-shrink-0 w-44 bg-card rounded-2xl overflow-hidden border border-border text-left hover:border-accent/30 active:scale-[0.98] transition-all"
                >
                  <div className="h-24 bg-muted overflow-hidden">
                    {recipe.image_url ? (
                      <img
                        src={recipe.image_url}
                        alt={recipe.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <img
                        src={FALLBACK_IMAGES[idx % FALLBACK_IMAGES.length]}
                        alt={recipe.title}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-medium text-xs leading-tight line-clamp-2 mb-1">
                      {recipe.title}
                    </p>
                    {recipe.nutrition && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span className="flex items-center gap-1 text-[10px]">
                          <Flame size={9} />
                          {recipe.nutrition.calories} cal
                        </span>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Monthly goals ───────────────────────────────────────────────────── */}
      {profile?.monthly_goals && profile.monthly_goals.length > 0 && (
        <div className="px-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm tracking-wide uppercase text-muted-foreground">
              Your Goals
            </h2>
            <button
              onClick={() => navigate('/profile')}
              className="text-accent text-sm font-medium hover:opacity-80"
            >
              Edit
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {profile.monthly_goals.map(goal => (
              <span
                key={goal}
                className="text-xs bg-accent/10 text-accent px-3 py-1.5 rounded-full font-medium"
              >
                {goal.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Quick Access ────────────────────────────────────────────────────── */}
      <div className="px-5">
        <h2 className="font-semibold text-sm tracking-wide uppercase text-muted-foreground mb-3">
          Quick Access
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/pantry')}
            className="bg-card border border-border rounded-2xl p-4 text-left hover:border-foreground/20 transition-colors"
          >
            <Package size={18} className="text-accent mb-3" />
            <p className="font-semibold text-sm">My Pantry</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage ingredients
            </p>
          </button>
          <button
            onClick={() => navigate('/cook')}
            className="bg-foreground text-primary-foreground rounded-2xl p-4 text-left hover:opacity-90 transition-opacity"
          >
            <Zap size={18} className="mb-3" />
            <p className="font-semibold text-sm">Quick Meals</p>
            <p className="text-xs opacity-70 mt-0.5">Under 15 minutes</p>
          </button>
        </div>
      </div>
    </MobileLayout>
  );
}
