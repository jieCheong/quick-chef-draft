import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, X, Package, Search, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { INGREDIENT_CATEGORIES, type PantryItem, type IngredientCategory } from '@/types/database';

const COMMON_ITEMS: Record<IngredientCategory, string[]> = {
  proteins: ['Chicken', 'Beef', 'Pork', 'Salmon', 'Tofu', 'Eggs'],
  vegetables: ['Onion', 'Garlic', 'Tomato', 'Bell Pepper', 'Broccoli', 'Carrot'],
  fruits: ['Lemon', 'Lime', 'Apple', 'Banana', 'Avocado'],
  dairy: ['Butter', 'Milk', 'Cheese', 'Yogurt', 'Cream'],
  grains: ['Rice', 'Pasta', 'Bread', 'Oats', 'Flour'],
  spices: ['Salt', 'Pepper', 'Cumin', 'Paprika', 'Oregano', 'Basil'],
  condiments: ['Olive Oil', 'Soy Sauce', 'Vinegar', 'Honey', 'Mustard'],
  other: ['Sugar', 'Vegetable Stock', 'Coconut Milk'],
};

export default function Pantry() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [items, setItems] = useState<PantryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<IngredientCategory>('other');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (user) {
      fetchItems();
    }
  }, [user]);

  const fetchItems = async () => {
    if (!user) return;
    
    setIsLoading(true);
    const { data, error } = await supabase
      .from('pantry_items')
      .select('*')
      .eq('user_id', user.id)
      .order('category')
      .order('name');

    if (!error && data) {
      setItems(data as unknown as PantryItem[]);
    }
    setIsLoading(false);
  };

  const addItem = async (name: string, category: IngredientCategory = selectedCategory) => {
    if (!user || !name.trim()) return;

    setIsAdding(true);
    const { error } = await supabase
      .from('pantry_items')
      .insert({
        user_id: user.id,
        name: name.trim(),
        category,
      });

    if (error) {
      toast({
        variant: 'destructive',
        description: 'Failed to add item',
      });
    } else {
      await fetchItems();
      setInputValue('');
    }
    setIsAdding(false);
  };

  const removeItem = async (id: string) => {
    const { error } = await supabase
      .from('pantry_items')
      .delete()
      .eq('id', id);

    if (!error) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addItem(inputValue);
    }
  };

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedItems = INGREDIENT_CATEGORIES.reduce((acc, cat) => {
    const categoryItems = filteredItems.filter(item => item.category === cat.value);
    if (categoryItems.length > 0) {
      acc[cat.value] = categoryItems;
    }
    return acc;
  }, {} as Record<IngredientCategory, PantryItem[]>);

  if (authLoading || isLoading) {
    return (
      <MobileLayout>
        <div className="p-4 space-y-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="p-4 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">My Pantry</h1>
          <p className="text-muted-foreground">Manage ingredients you have at home</p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search ingredients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Add New Item */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Add Ingredient</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Ingredient name..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1"
              />
              <Button 
                size="icon" 
                onClick={() => addItem(inputValue)} 
                disabled={!inputValue.trim() || isAdding}
              >
                {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>

            {/* Category Selector */}
            <div className="flex flex-wrap gap-1.5">
              {INGREDIENT_CATEGORIES.map((cat) => (
                <Badge
                  key={cat.value}
                  variant={selectedCategory === cat.value ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setSelectedCategory(cat.value)}
                >
                  {cat.emoji} {cat.label}
                </Badge>
              ))}
            </div>

            {/* Quick Add Common Items */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">Quick add:</p>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_ITEMS[selectedCategory].slice(0, 6).map((item) => {
                  const alreadyAdded = items.some(i => i.name.toLowerCase() === item.toLowerCase());
                  return (
                    <Badge
                      key={item}
                      variant="secondary"
                      className={cn(
                        'cursor-pointer',
                        alreadyAdded && 'opacity-50 cursor-not-allowed'
                      )}
                      onClick={() => !alreadyAdded && addItem(item, selectedCategory)}
                    >
                      + {item}
                    </Badge>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pantry Items */}
        {Object.keys(groupedItems).length > 0 ? (
          <div className="space-y-4">
            {Object.entries(groupedItems).map(([category, categoryItems]) => {
              const catInfo = INGREDIENT_CATEGORIES.find(c => c.value === category);
              return (
                <div key={category}>
                  <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <span>{catInfo?.emoji}</span>
                    {catInfo?.label}
                    <Badge variant="secondary" className="text-xs">{categoryItems.length}</Badge>
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {categoryItems.map((item) => (
                      <Badge
                        key={item.id}
                        variant="secondary"
                        className="pl-3 pr-1.5 py-1.5 cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => removeItem(item.id)}
                      >
                        {item.name}
                        <X className="h-3 w-3 ml-1.5" />
                      </Badge>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="p-6 text-center">
              <Package className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                {searchQuery ? 'No matching ingredients' : 'Your pantry is empty'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Add ingredients to quickly use them when generating recipes
              </p>
            </CardContent>
          </Card>
        )}

        {/* Use in Cooking */}
        {items.length > 0 && (
          <Button 
            className="w-full" 
            onClick={() => navigate('/cook')}
          >
            <Package className="h-4 w-4 mr-2" />
            Cook with Pantry Items
          </Button>
        )}
      </div>
    </MobileLayout>
  );
}
