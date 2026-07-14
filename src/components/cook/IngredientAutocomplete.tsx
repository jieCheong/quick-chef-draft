import { useState, useRef, useEffect } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Comprehensive ingredient database with categories
const INGREDIENT_DATABASE: Record<string, string[]> = {
  // Proteins
  proteins: [
    'egg', 'eggs', 'chicken breast', 'chicken thighs', 'chicken wings', 'ground beef', 'beef steak', 'pork chops', 'bacon', 'ham',
    'salmon', 'tuna', 'shrimp', 'cod', 'tilapia', 'tofu', 'tempeh', 'turkey', 'lamb', 'duck',
    'sausage', 'hot dog', 'pepperoni', 'salami', 'prosciutto', 'crab', 'lobster', 'scallops', 'mussels', 'clams'
  ],
  // Dairy & Cheese
  dairy: [
    'milk', 'butter', 'cream', 'heavy cream', 'sour cream', 'cream cheese', 'yogurt', 'greek yogurt',
    'cheese', 'cheddar cheese', 'mozzarella cheese', 'parmesan cheese', 'feta cheese', 'goat cheese',
    'brie cheese', 'swiss cheese', 'provolone cheese', 'blue cheese', 'gouda cheese', 'ricotta cheese',
    'cottage cheese', 'american cheese', 'pepper jack cheese', 'gruyere cheese', 'mascarpone', 'queso fresco'
  ],
  // Vegetables
  vegetables: [
    'tomato', 'onion', 'garlic', 'potato', 'carrot', 'celery', 'lettuce', 'spinach', 'kale', 'broccoli',
    'cauliflower', 'zucchini', 'cucumber', 'bell pepper', 'jalapeno', 'mushroom', 'corn', 'peas', 'green beans',
    'asparagus', 'eggplant', 'cabbage', 'brussels sprouts', 'artichoke', 'avocado', 'sweet potato', 'beet',
    'radish', 'turnip', 'leek', 'scallion', 'green onion', 'shallot', 'arugula', 'bok choy', 'edamame'
  ],
  // Fruits
  fruits: [
    'apple', 'banana', 'orange', 'lemon', 'lime', 'strawberry', 'blueberry', 'raspberry', 'blackberry',
    'grape', 'mango', 'pineapple', 'watermelon', 'cantaloupe', 'honeydew', 'peach', 'pear', 'plum',
    'cherry', 'kiwi', 'papaya', 'coconut', 'pomegranate', 'fig', 'date', 'apricot', 'grapefruit', 'tangerine'
  ],
  // Grains & Carbs
  grains: [
    'rice', 'brown rice', 'white rice', 'basmati rice', 'jasmine rice', 'pasta', 'spaghetti', 'penne',
    'fettuccine', 'macaroni', 'bread', 'flour', 'tortilla', 'flour tortilla', 'corn tortilla', 'naan',
    'pita bread', 'bagel', 'croissant', 'oats', 'quinoa', 'couscous', 'bulgur', 'barley', 'cornmeal',
    'breadcrumbs', 'pizza dough', 'pie crust', 'noodles', 'ramen noodles', 'udon noodles', 'rice noodles'
  ],
  // Spices & Herbs
  spices: [
    'salt', 'pepper', 'black pepper', 'paprika', 'cumin', 'coriander', 'turmeric', 'cinnamon', 'nutmeg',
    'oregano', 'basil', 'thyme', 'rosemary', 'parsley', 'cilantro', 'mint', 'dill', 'chives', 'bay leaf',
    'curry powder', 'chili powder', 'cayenne', 'ginger', 'garlic powder', 'onion powder', 'italian seasoning'
  ],
  // Condiments & Sauces
  condiments: [
    'olive oil', 'vegetable oil', 'sesame oil', 'coconut oil', 'vinegar', 'balsamic vinegar', 'soy sauce',
    'worcestershire sauce', 'hot sauce', 'sriracha', 'ketchup', 'mustard', 'mayonnaise', 'honey', 'maple syrup',
    'tomato sauce', 'marinara', 'pesto', 'salsa', 'guacamole', 'hummus', 'tahini', 'teriyaki sauce',
    'fish sauce', 'oyster sauce', 'hoisin sauce', 'bbq sauce', 'ranch dressing', 'caesar dressing'
  ],
  // Legumes & Beans
  legumes: [
    'black beans', 'kidney beans', 'pinto beans', 'chickpeas', 'lentils', 'white beans', 'navy beans',
    'cannellini beans', 'lima beans', 'split peas', 'black-eyed peas', 'refried beans'
  ],
  // Nuts & Seeds
  nuts: [
    'almonds', 'walnuts', 'pecans', 'cashews', 'peanuts', 'pistachios', 'macadamia nuts', 'hazelnuts',
    'pine nuts', 'sunflower seeds', 'pumpkin seeds', 'sesame seeds', 'chia seeds', 'flax seeds',
    'peanut butter', 'almond butter'
  ]
};

// Flatten all ingredients for searching
const ALL_INGREDIENTS = Object.values(INGREDIENT_DATABASE).flat();

interface IngredientAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onAddIngredient: (ingredient: string) => void;
  existingIngredients: string[];
  placeholder?: string;
  className?: string;
  isLoading?: boolean;
}

export function IngredientAutocomplete({
  value,
  onChange,
  onAddIngredient,
  existingIngredients,
  placeholder = "Type an ingredient...",
  className,
  isLoading = false
}: IngredientAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter suggestions based on input
  useEffect(() => {
    if (value.trim().length > 0) {
      const searchTerm = value.toLowerCase().trim();
      const filtered = ALL_INGREDIENTS
        .filter(ingredient => 
          ingredient.toLowerCase().includes(searchTerm) &&
          !existingIngredients.includes(ingredient.toLowerCase())
        )
        .sort((a, b) => {
          // Prioritize items that start with the search term
          const aStarts = a.toLowerCase().startsWith(searchTerm);
          const bStarts = b.toLowerCase().startsWith(searchTerm);
          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;
          return a.localeCompare(b);
        })
        .slice(0, 10); // Limit to 10 suggestions
      
      setSuggestions(filtered);
      setIsOpen(filtered.length > 0);
      setHighlightedIndex(0);
    } else {
      setSuggestions([]);
      setIsOpen(false);
    }
  }, [value, existingIngredients]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' && value.trim()) {
        e.preventDefault();
        onAddIngredient(value.trim());
        onChange('');
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (suggestions[highlightedIndex]) {
          onAddIngredient(suggestions[highlightedIndex]);
          onChange('');
          setIsOpen(false);
        } else if (value.trim()) {
          onAddIngredient(value.trim());
          onChange('');
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
      case 'Tab':
        if (suggestions[highlightedIndex]) {
          e.preventDefault();
          onAddIngredient(suggestions[highlightedIndex]);
          onChange('');
          setIsOpen(false);
        }
        break;
    }
  };

  const handleSelectSuggestion = (ingredient: string) => {
    onAddIngredient(ingredient);
    onChange('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div className={cn("relative flex gap-2", className)}>
      <div className="relative flex-1">
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          autoComplete="off"
          className="w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent/30 placeholder:text-muted-foreground transition-shadow"
        />

        {/* Dropdown */}
        {isOpen && suggestions.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute top-full left-0 right-0 mt-2 z-50 bg-card border border-border rounded-xl shadow-lg overflow-hidden"
          >
            <div className="max-h-[200px] overflow-y-auto p-1">
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => handleSelectSuggestion(suggestion)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm rounded-lg transition-colors capitalize",
                    "hover:bg-secondary",
                    index === highlightedIndex && "bg-accent/10 text-accent"
                  )}
                >
                  {/* Highlight matching part */}
                  {highlightMatch(suggestion, value)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          if (value.trim()) {
            onAddIngredient(value.trim());
            onChange('');
          }
        }}
        disabled={!value.trim() || isLoading}
        className="w-11 h-11 rounded-xl bg-accent text-white flex items-center justify-center disabled:opacity-35 hover:opacity-90 active:scale-95 transition-all flex-shrink-0"
      >
        {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
      </button>
    </div>
  );
}

// Helper function to highlight matching text
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase().trim();
  const index = lowerText.indexOf(lowerQuery);
  
  if (index === -1) return text;
  
  return (
    <>
      {text.slice(0, index)}
      <span className="font-semibold text-accent">
        {text.slice(index, index + lowerQuery.length)}
      </span>
      {text.slice(index + lowerQuery.length)}
    </>
  );
}
