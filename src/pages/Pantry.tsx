// src/pages/Pantry.tsx — redesigned UI, real API calls preserved
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { apiGet, apiPost, apiDelete } from '@/lib/api';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { cn } from '@/lib/utils';
import { INGREDIENT_CATEGORIES, type PantryItem, type IngredientCategory } from '@/types/database';
import { Plus, X, Package, Search } from 'lucide-react';

export default function Pantry() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<PantryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [input, setInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<IngredientCategory>('other');
  const [search, setSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      try {
        const data = await apiGet<PantryItem[]>('/api/pantry');
        setItems(data);
      } catch {
        toast({ variant: 'destructive', description: 'Failed to load pantry items.' });
      } finally {
        setIsLoading(false);
      }
    };
    fetch();
  }, [user]);

  const addItem = async () => {
    if (!input.trim()) return;
    setIsAdding(true);
    try {
      const newItem = await apiPost<PantryItem>('/api/pantry', { name: input.trim(), category: selectedCategory });
      setItems(p => [...p, newItem]);
      setInput('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to add item.';
      toast({ variant: 'destructive', description: msg });
    } finally {
      setIsAdding(false);
    }
  };

  const removeItem = async (id: string) => {
    const prev = items;
    setItems(p => p.filter(i => i.id !== id));
    try {
      await apiDelete(`/api/pantry/${id}`);
    } catch {
      setItems(prev);
      toast({ variant: 'destructive', description: 'Failed to remove item.' });
    }
  };

  const filtered = search
    ? items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    : items;

  const grouped = INGREDIENT_CATEGORIES.reduce((acc, cat) => {
    const catItems = filtered.filter(i => i.category === cat.value);
    if (catItems.length > 0) acc[cat.value] = catItems;
    return acc;
  }, {} as Record<string, PantryItem[]>);

  return (
    <MobileLayout>
      <div>
        <div className="px-5 pt-14 pb-5">
          <h1 className="text-4xl" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>My Pantry</h1>
          <p className="text-muted-foreground mt-1 text-sm">{items.length} ingredients tracked</p>
        </div>

        {/* Search */}
        <div className="px-5 mb-4">
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder="Search ingredients..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-secondary rounded-xl pl-9 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent/30 placeholder:text-muted-foreground" />
          </div>
        </div>

        {/* Add item */}
        <div className="px-5 mb-5">
          <div className="flex gap-2 mb-3">
            <input type="text" placeholder="Add an ingredient..." value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addItem()}
              className="flex-1 bg-secondary rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent/30 placeholder:text-muted-foreground" />
            <button onClick={addItem} disabled={!input.trim() || isAdding}
              className="w-11 h-11 rounded-xl bg-accent text-white flex items-center justify-center disabled:opacity-35 hover:opacity-90 active:scale-95 transition-all">
              <Plus size={18} />
            </button>
          </div>
          {/* Category pills */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {INGREDIENT_CATEGORIES.map(cat => (
              <button key={cat.value} onClick={() => setSelectedCategory(cat.value)}
                className={cn('flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors',
                  selectedCategory === cat.value ? 'bg-foreground text-primary-foreground' : 'bg-secondary text-muted-foreground')}>
                {cat.emoji} {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Items */}
        <div className="px-5 space-y-6 pb-6">
          {isLoading ? (
            [1, 2, 3].map(i => <div key={i} className="h-20 bg-muted rounded-2xl animate-pulse" />)
          ) : Object.entries(grouped).length > 0 ? (
            Object.entries(grouped).map(([cat, catItems]) => {
              const catInfo = INGREDIENT_CATEGORIES.find(c => c.value === cat);
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between mb-2.5">
                    <h3 className="text-sm font-semibold">{catInfo?.emoji} {catInfo?.label}</h3>
                    <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{catItems.length}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {catItems.map(item => (
                      <button key={item.id} onClick={() => removeItem(item.id)}
                        className="flex items-center gap-1.5 bg-card border border-border text-sm px-3 py-1.5 rounded-full hover:border-destructive hover:text-destructive transition-colors group">
                        {item.name}
                        <X size={11} className="opacity-35 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12">
              <Package size={32} className="mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                {search ? 'No matching ingredients' : 'Your pantry is empty'}
              </p>
            </div>
          )}

          {items.length > 0 && (
            <button onClick={() => navigate('/cook')}
              className="w-full bg-foreground text-primary-foreground rounded-2xl py-3.5 text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
              <Package size={15} /> Cook with pantry items
            </button>
          )}
        </div>
      </div>
    </MobileLayout>
  );
}
