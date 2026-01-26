import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ChefHat, Sparkles } from 'lucide-react';

interface RecipeLoadingSkeletonProps {
  message?: string;
}

export function RecipeLoadingSkeleton({ message = "Creating delicious recipes..." }: RecipeLoadingSkeletonProps) {
  return (
    <div className="space-y-6">
      {/* Animated header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 animate-pulse">
          <ChefHat className="h-8 w-8 text-primary animate-bounce" />
        </div>
        <div className="space-y-1">
          <p className="text-lg font-medium animate-pulse">{message}</p>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 animate-spin" />
            <span>AI is analyzing your ingredients</span>
          </div>
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-primary animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>

      {/* Skeleton cards */}
      <div className="grid gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-20" />
              </div>
              <Skeleton className="h-6 w-3/4 mt-2" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <div className="flex gap-2 pt-2">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-14 rounded-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tips while loading */}
      <div className="bg-muted/50 rounded-lg p-4 text-center">
        <p className="text-sm text-muted-foreground">
          💡 Tip: The more ingredients you add, the more creative recipes you'll get!
        </p>
      </div>
    </div>
  );
}
