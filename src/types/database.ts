// Custom type definitions for the app

export type DietaryStyle = 'omnivore' | 'vegetarian' | 'vegan' | 'pescatarian' | 'keto' | 'paleo';

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';

export type MonthlyGoal = 'high_protein' | 'lose_weight' | 'gain_muscle' | 'low_calorie' | 'budget_friendly' | 'quick_meals' | 'meal_prep';

export type IngredientCategory = 'proteins' | 'vegetables' | 'fruits' | 'dairy' | 'grains' | 'spices' | 'condiments' | 'other';

export interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  dietary_style: DietaryStyle;
  allergies: string[];
  skill_level: SkillLevel;
  preferred_cuisines: string[];
  monthly_goals: MonthlyGoal[];
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface PantryItem {
  id: string;
  user_id: string;
  name: string;
  category: IngredientCategory;
  quantity: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecipeIngredient {
  name: string;
  amount: string;
  unit: string;
}

export interface RecipeInstruction {
  step: number;
  instruction: string;
  image_url?: string | null;
}

export interface RecipeNutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface SavedRecipe {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  cooking_time_minutes: number;
  difficulty: string;
  servings: number;
  ingredients: RecipeIngredient[];
  instructions: RecipeInstruction[];
  nutrition: RecipeNutrition;
  cuisines: string[];
  goal_alignment: MonthlyGoal[];
  is_quick_meal: boolean;
  is_trending: boolean;
  created_at: string;
  updated_at: string;
}

export interface MonthlyBudget {
  id: string;
  user_id: string;
  month: number;
  year: number;
  budget_amount: number;
  created_at: string;
  updated_at: string;
}

export interface BudgetTransaction {
  id: string;
  user_id: string;
  budget_id: string;
  amount: number;
  description: string | null;
  transaction_date: string;
  created_at: string;
}

export interface BudgetRecommendation {
  category: string;
  items: string[];
  estimated_cost: number;
}

export const DIETARY_STYLES: { value: DietaryStyle; label: string }[] = [
  { value: 'omnivore', label: 'Omnivore' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'pescatarian', label: 'Pescatarian' },
  { value: 'keto', label: 'Keto' },
  { value: 'paleo', label: 'Paleo' },
];

export const SKILL_LEVELS: { value: SkillLevel; label: string; description: string }[] = [
  { value: 'beginner', label: 'Beginner', description: 'Just starting out' },
  { value: 'intermediate', label: 'Intermediate', description: 'Comfortable in the kitchen' },
  { value: 'advanced', label: 'Advanced', description: 'Experienced home chef' },
];

export const MONTHLY_GOALS: { value: MonthlyGoal; label: string; emoji: string; color: string }[] = [
  { value: 'high_protein', label: 'High protein', emoji: '💪', color: 'goal-protein' },
  { value: 'lose_weight', label: 'Lose weight', emoji: '⚖️', color: 'goal-veggies' },
  { value: 'gain_muscle', label: 'Gain muscle', emoji: '🏋️', color: 'goal-protein' },
  { value: 'low_calorie', label: 'Low calorie', emoji: '🥗', color: 'goal-veggies' },
  { value: 'budget_friendly', label: 'Budget friendly', emoji: '💰', color: 'goal-cuisines' },
  { value: 'quick_meals', label: 'Quick meals', emoji: '⚡', color: 'goal-keto' },
  { value: 'meal_prep', label: 'Meal prep', emoji: '🍱', color: 'goal-fiber' },
];

export const CUISINES = [
  'Italian', 'Mexican', 'Chinese', 'Japanese', 'Indian', 'Thai',
  'Mediterranean', 'French', 'American', 'Korean', 'Vietnamese', 'Greek',
  'Middle Eastern', 'Spanish', 'Brazilian', 'Ethiopian'
];

export const COMMON_ALLERGIES = [
  'Nuts', 'Peanuts', 'Dairy', 'Eggs', 'Gluten', 'Shellfish',
  'Fish', 'Soy', 'Sesame', 'Wheat'
];

export const INGREDIENT_CATEGORIES: { value: IngredientCategory; label: string; emoji: string }[] = [
  { value: 'proteins', label: 'Proteins', emoji: '🥩' },
  { value: 'vegetables', label: 'Vegetables', emoji: '🥦' },
  { value: 'fruits', label: 'Fruits', emoji: '🍎' },
  { value: 'dairy', label: 'Dairy', emoji: '🧀' },
  { value: 'grains', label: 'Grains', emoji: '🌾' },
  { value: 'spices', label: 'Spices', emoji: '🌶️' },
  { value: 'condiments', label: 'Condiments', emoji: '🍯' },
  { value: 'other', label: 'Other', emoji: '📦' },
];

export const TIME_OPTIONS = [
  { value: 15, label: 'Under 15 min', badge: '⚡ Quick' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '1 hour+' },
];
