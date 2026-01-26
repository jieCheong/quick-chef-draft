import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useRecipeImage } from '@/hooks/useRecipeImage';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { QuickBadge } from '@/components/ui/quick-badge';
import { GoalBadge } from '@/components/ui/goal-badge';
import { RecipeCard } from '@/components/recipe/RecipeCard';
import { RecipeStepCard } from '@/components/recipe/RecipeStepCard';
import { IngredientAutocomplete } from '@/components/cook/IngredientAutocomplete';
import { RecipeLoadingSkeleton } from '@/components/cook/RecipeLoadingSkeleton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  ChefHat, Plus, X, Package, Clock, Sparkles, Loader2, Zap, 
  ArrowLeft, Bookmark, ChevronRight, Heart, ImagePlus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TIME_OPTIONS, type SavedRecipe, type PantryItem, type RecipeIngredient, type RecipeInstruction, type RecipeNutrition, type MonthlyGoal } from '@/types/database';

type GeneratedRecipe = Omit<SavedRecipe, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

export default function Cook() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { profile } = useProfile();
  const { toast } = useToast();
  const { generateImage, isGenerating: isGeneratingImage } = useRecipeImage();

  const [ingredients, setIngredients] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [selectedTime, setSelectedTime] = useState<number>(searchParams.get('quick') ? 15 : 30);
  const [quickMealsOnly, setQuickMealsOnly] = useState(searchParams.get('quick') === 'true');
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [isLoadingPantry, setIsLoadingPantry] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedRecipes, setGeneratedRecipes] = useState<GeneratedRecipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<GeneratedRecipe | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [savingRecipe, setSavingRecipe] = useState(false);
  const [craving, setCraving] = useState('');
  const [stepImages, setStepImages] = useState<Record<number, string>>({});
  const [generatingStepImage, setGeneratingStepImage] = useState<number | null>(null);
  const [recipeImage, setRecipeImage] = useState<string | null>(null);
  const [generatingRecipeImage, setGeneratingRecipeImage] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (user) {
      fetchPantryItems();
    }
  }, [user]);

  const fetchPantryItems = async () => {
    if (!user) return;
    
    setIsLoadingPantry(true);
    const { data, error } = await supabase
      .from('pantry_items')
      .select('*')
      .eq('user_id', user.id)
      .order('name');

    if (!error && data) {
      setPantryItems(data as unknown as PantryItem[]);
    }
    setIsLoadingPantry(false);
  };

  const addIngredient = (ingredient: string) => {
    const trimmed = ingredient.trim().toLowerCase();
    if (trimmed && !ingredients.includes(trimmed)) {
      setIngredients([...ingredients, trimmed]);
    }
    setInputValue('');
  };

  const removeIngredient = (ingredient: string) => {
    setIngredients(ingredients.filter(i => i !== ingredient));
  };

  const addFromPantry = () => {
    const pantryIngredients = pantryItems.map(item => item.name.toLowerCase());
    const newIngredients = [...new Set([...ingredients, ...pantryIngredients])];
    setIngredients(newIngredients);
    toast({
      description: `Added ${pantryItems.length} items from your pantry`,
    });
  };

  const generateRecipes = async (retry = 0) => {
    if (ingredients.length === 0) {
      toast({
        variant: 'destructive',
        description: 'Please add at least one ingredient',
      });
      return;
    }

    setIsGenerating(true);
    setGeneratedRecipes([]);
    setRetryCount(retry);

    try {
      // Use fetch with longer timeout instead of supabase.functions.invoke
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-recipes`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            ingredients,
            maxTime: quickMealsOnly ? 15 : selectedTime,
            dietaryStyle: profile?.dietary_style,
            allergies: profile?.allergies,
            skillLevel: profile?.skill_level,
            cuisines: profile?.preferred_cuisines,
            goals: profile?.monthly_goals,
            craving: craving.trim() || undefined,
          }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data = await response.json();
      setGeneratedRecipes(data.recipes);
      setRetryCount(0);
      setIsGenerating(false);
    } catch (error: any) {
      console.error('Error generating recipes:', error);
      
      // Auto-retry with exponential backoff (max 2 retries)
      if (retry < 2 && error?.name !== 'AbortError') {
        const delay = Math.pow(2, retry) * 1000; // 1s, 2s
        toast({
          description: `Connection slow, retrying...`,
        });
        setTimeout(() => generateRecipes(retry + 1), delay);
        return;
      }
      
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error?.name === 'AbortError' 
          ? 'Request timed out. Please try again.'
          : 'Failed to generate recipes. Please try again.',
      });
      setRetryCount(0);
      setIsGenerating(false);
    }
  };

  const saveRecipe = async (recipe: GeneratedRecipe, withImage = false) => {
    if (!user) return;

    setSavingRecipe(true);
    try {
      const { data, error } = await supabase
        .from('saved_recipes')
        .insert({
          user_id: user.id,
          title: recipe.title,
          description: recipe.description,
          image_url: recipe.image_url,
          cooking_time_minutes: recipe.cooking_time_minutes,
          difficulty: recipe.difficulty,
          servings: recipe.servings,
          ingredients: recipe.ingredients as any,
          instructions: recipe.instructions as any,
          nutrition: recipe.nutrition as any,
          cuisines: recipe.cuisines,
          goal_alignment: recipe.goal_alignment,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Recipe saved!',
        description: withImage ? 'Generating image...' : 'You can find it in your saved recipes.',
      });

      // Generate image in the background if requested
      if (withImage && data) {
        generateImage(
          data.id,
          recipe.title,
          recipe.description || undefined,
          recipe.ingredients
        );
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        description: 'Failed to save recipe. Please try again.',
      });
    } finally {
      setSavingRecipe(false);
    }
  };

  const generateRecipeMainImage = async (recipe: GeneratedRecipe) => {
    setGeneratingRecipeImage(true);
    try {
      const ingredientList = recipe.ingredients.slice(0, 5).map(i => i.name).join(", ");
      const prompt = `Professional, appetizing food photography of ${recipe.title}. ${recipe.description || ""} Main ingredients: ${ingredientList}. Styled on a modern plate, soft natural lighting, shallow depth of field, restaurant quality. Ultra high resolution.`;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-recipe-image`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            recipeId: 'temp',
            recipeTitle: recipe.title,
            recipeDescription: recipe.description,
            ingredients: recipe.ingredients.map(i => i.name),
          }),
        }
      );

      const data = await response.json();
      if (data.image_url) {
        setRecipeImage(data.image_url);
      }
    } catch (error) {
      console.error('Error generating recipe image:', error);
    } finally {
      setGeneratingRecipeImage(false);
    }
  };

  const generateStepImage = async (step: { step: number; instruction: string }, recipe: GeneratedRecipe) => {
    setGeneratingStepImage(step.step);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-step-images`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            recipeTitle: recipe.title,
            stepNumber: step.step,
            stepInstruction: step.instruction,
            ingredients: recipe.ingredients.map(i => i.name),
          }),
        }
      );

      const data = await response.json();
      if (data.image_url) {
        setStepImages(prev => ({ ...prev, [step.step]: data.image_url }));
        return data.image_url;
      }
      return null;
    } catch (error) {
      console.error('Error generating step image:', error);
      return null;
    } finally {
      setGeneratingStepImage(null);
    }
  };

  // Reset images when selecting a new recipe
  useEffect(() => {
    if (selectedRecipe) {
      setStepImages({});
      setRecipeImage(null);
    }
  }, [selectedRecipe?.title]);

  // Recipe Detail View
  if (selectedRecipe) {
    return (
      <MobileLayout showNav={false}>
        <div className="min-h-screen">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
            <div className="flex items-center justify-between p-4">
              <Button variant="ghost" size="icon" onClick={() => setSelectedRecipe(null)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => saveRecipe(selectedRecipe)}
                disabled={savingRecipe}
              >
                {savingRecipe ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Bookmark className="h-4 w-4 mr-1" />
                    Save
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Recipe Content */}
          <div className="p-4 space-y-6">
            {/* Hero Image */}
            <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
              {recipeImage ? (
                <img
                  src={recipeImage}
                  alt={selectedRecipe.title}
                  className="w-full h-full object-cover"
                />
              ) : generatingRecipeImage ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Generating image...</span>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                  <ChefHat className="h-12 w-12 text-muted-foreground/30" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => generateRecipeMainImage(selectedRecipe)}
                  >
                    <ImagePlus className="h-4 w-4 mr-2" />
                    Generate Recipe Image
                  </Button>
                </div>
              )}
            </div>

            {/* Title */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                {selectedRecipe.is_quick_meal && <QuickBadge />}
              </div>
              <h1 className="text-2xl font-bold">{selectedRecipe.title}</h1>
              {selectedRecipe.description && (
                <p className="text-muted-foreground mt-2">{selectedRecipe.description}</p>
              )}
            </div>

            {/* Quick Info */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{selectedRecipe.cooking_time_minutes} min</span>
              </div>
              <Badge variant="secondary">{selectedRecipe.difficulty}</Badge>
              <span>{selectedRecipe.servings} servings</span>
            </div>

            {/* Goal Alignment */}
            {selectedRecipe.goal_alignment.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedRecipe.goal_alignment.map(goal => (
                  <GoalBadge key={goal} goal={goal} />
                ))}
              </div>
            )}

            {/* Nutrition */}
            {selectedRecipe.nutrition && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Nutrition</CardTitle>
                </CardHeader>
                <CardContent>
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

            {/* Ingredients */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Ingredients</CardTitle>
              </CardHeader>
              <CardContent>
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

            {/* Step-by-Step Instructions with Images */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Step-by-Step Instructions</h3>
              <div className="space-y-4">
                {selectedRecipe.instructions.map((step, idx) => (
                  <RecipeStepCard
                    key={idx}
                    step={step}
                    recipeTitle={selectedRecipe.title}
                    ingredients={selectedRecipe.ingredients}
                    imageUrl={stepImages[step.step]}
                    isGenerating={generatingStepImage === step.step}
                    onGenerateImage={() => generateStepImage(step, selectedRecipe)}
                  />
                ))}
              </div>
            </div>

            {/* Save Buttons */}
            <div className="space-y-2">
              <Button 
                className="w-full" 
                size="lg"
                onClick={() => saveRecipe(selectedRecipe, true)}
                disabled={savingRecipe}
              >
                {savingRecipe ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ImagePlus className="h-4 w-4 mr-2" />
                )}
                Save with AI Image
              </Button>
              <Button 
                variant="outline"
                className="w-full" 
                size="lg"
                onClick={() => saveRecipe(selectedRecipe, false)}
                disabled={savingRecipe}
              >
                <Bookmark className="h-4 w-4 mr-2" />
                Save without Image
              </Button>
            </div>
          </div>
        </div>
      </MobileLayout>
    );
  }

  // Loading View
  if (isGenerating) {
    return (
      <MobileLayout>
        <div className="p-4">
          <RecipeLoadingSkeleton 
            message={retryCount > 0 ? `Retrying (attempt ${retryCount + 1})...` : "Creating delicious recipes..."} 
          />
        </div>
      </MobileLayout>
    );
  }

  // Generated Recipes View
  if (generatedRecipes.length > 0) {
    return (
      <MobileLayout>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setGeneratedRecipes([])}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <h2 className="font-semibold">Recipe Suggestions</h2>
            <div className="w-16" />
          </div>

          <p className="text-sm text-muted-foreground text-center">
            Here are {generatedRecipes.length} recipes based on your ingredients
          </p>

          <div className="grid gap-4">
            {generatedRecipes.map((recipe, idx) => (
              <RecipeCard
                key={idx}
                recipe={recipe as unknown as SavedRecipe}
                onClick={() => setSelectedRecipe(recipe)}
              />
            ))}
          </div>

          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => generateRecipes()}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Generate More Recipes
          </Button>
        </div>
      </MobileLayout>
    );
  }

  // Main Input View
  return (
    <MobileLayout>
      <div className="p-4 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">What should I cook?</h1>
          <p className="text-muted-foreground">Add ingredients you have on hand</p>
        </div>

        {/* Craving Input */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-primary" />
            <label className="text-sm font-medium">What are you craving?</label>
          </div>
          <Textarea
            placeholder="e.g., pizza, something spicy, comfort food, tacos..."
            value={craving}
            onChange={(e) => setCraving(e.target.value)}
            className="min-h-[60px] resize-none"
          />
          <p className="text-xs text-muted-foreground">
            We'll get creative with your ingredients to satisfy your craving!
          </p>
        </div>

        {/* Ingredient Input */}
        <div className="space-y-3">
          <IngredientAutocomplete
            value={inputValue}
            onChange={setInputValue}
            onAddIngredient={addIngredient}
            existingIngredients={ingredients}
            placeholder="Type an ingredient..."
          />

          {/* Add from Pantry */}
          {!isLoadingPantry && pantryItems.length > 0 && (
            <Button variant="outline" size="sm" onClick={addFromPantry} className="w-full">
              <Package className="h-4 w-4 mr-2" />
              Add from Pantry ({pantryItems.length} items)
            </Button>
          )}
        </div>

        {/* Selected Ingredients */}
        {ingredients.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">{ingredients.length} ingredients</p>
            <div className="flex flex-wrap gap-2">
              {ingredients.map((ingredient) => (
                <Badge
                  key={ingredient}
                  variant="secondary"
                  className="pl-3 pr-1 py-1.5 text-sm cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => removeIngredient(ingredient)}
                >
                  {ingredient}
                  <X className="h-3 w-3 ml-1" />
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Time Selector */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Time available</p>
            <Button
              variant={quickMealsOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setQuickMealsOnly(!quickMealsOnly);
                if (!quickMealsOnly) setSelectedTime(15);
              }}
              className={cn(
                quickMealsOnly && 'bg-quick text-quick-foreground hover:bg-quick/90'
              )}
            >
              <Zap className="h-3 w-3 mr-1 fill-current" />
              Quick Only
            </Button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {TIME_OPTIONS.map((option) => (
              <Button
                key={option.value}
                variant={selectedTime === option.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setSelectedTime(option.value);
                  if (option.value > 15) setQuickMealsOnly(false);
                }}
                disabled={quickMealsOnly && option.value > 15}
                className={cn(
                  'flex-col h-auto py-2',
                  selectedTime === option.value && option.value === 15 && 'bg-quick text-quick-foreground hover:bg-quick/90'
                )}
              >
                <Clock className="h-4 w-4 mb-1" />
                <span className="text-xs">{option.label}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Generate Button */}
        <Button 
          className="w-full" 
          size="lg"
          onClick={() => generateRecipes()}
          disabled={ingredients.length === 0 || isGenerating}
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Generating recipes...
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5 mr-2" />
              Generate Recipes
            </>
          )}
        </Button>

        {/* Loading Animation */}
        {isGenerating && (
          <Card className="animate-pulse-soft">
            <CardContent className="p-6 text-center">
              <ChefHat className="h-12 w-12 mx-auto text-primary mb-3 animate-bounce" />
              <p className="text-sm text-muted-foreground">
                Our AI chef is cooking up some recipes...
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </MobileLayout>
  );
}
