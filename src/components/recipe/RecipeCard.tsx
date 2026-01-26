import { Clock, Users, ChefHat } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { QuickBadge } from '@/components/ui/quick-badge';
import { GoalBadge } from '@/components/ui/goal-badge';
import { cn } from '@/lib/utils';
import type { SavedRecipe, MonthlyGoal } from '@/types/database';

interface RecipeCardProps {
  recipe: SavedRecipe;
  onClick?: () => void;
  className?: string;
}

export function RecipeCard({ recipe, onClick, className }: RecipeCardProps) {
  return (
    <Card
      className={cn(
        'overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]',
        className
      )}
      onClick={onClick}
    >
      <div className="relative aspect-[4/3] bg-muted">
        {recipe.image_url ? (
          <img
            src={recipe.image_url}
            alt={recipe.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ChefHat className="h-12 w-12 text-muted-foreground/50" />
          </div>
        )}
        {recipe.is_quick_meal && (
          <div className="absolute top-2 left-2">
            <QuickBadge size="sm" />
          </div>
        )}
      </div>
      <CardContent className="p-3">
        <h3 className="font-semibold text-sm line-clamp-2 mb-2">{recipe.title}</h3>
        
        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {recipe.cooking_time_minutes} min
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {recipe.servings}
          </span>
          <span className="capitalize">{recipe.difficulty}</span>
        </div>

        {recipe.nutrition && (
          <div className="flex gap-2 text-[10px] text-muted-foreground mb-2">
            <span>{recipe.nutrition.calories} cal</span>
            <span>•</span>
            <span>{recipe.nutrition.protein}g protein</span>
          </div>
        )}

        {recipe.goal_alignment.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {recipe.goal_alignment.slice(0, 2).map((goal) => (
              <GoalBadge key={goal} goal={goal} size="sm" showEmoji={false} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
