

# QuickChef MVP - AI-Powered Cooking Assistant

## Overview
A native mobile app that helps users discover personalized recipes based on ingredients they have, their dietary preferences, and health goals. Features quick meal highlighting and smart monthly goal-based grocery budgeting. Clean, minimal design focused on simplicity and ease of use.

---

## 🔐 Authentication & Onboarding

### Sign Up / Sign In Screen
- Clean, minimal login page with the QuickChef logo
- **Email & Password** registration and login
- **Google Sign-in** button for quick access
- **Apple Sign-in** button (important for iOS App Store)
- Smooth redirect to onboarding for new users

### Onboarding Flow (First-time Users)
A simple 4-5 step wizard to capture preferences:
1. **Dietary Style** - Omnivore, Vegetarian, Vegan, Pescatarian, Keto, Halal, etc.
2. **Allergies & Restrictions** - Multi-select common allergens (nuts, dairy, gluten, shellfish, etc.)
3. **Cooking Skill Level** - Beginner, Intermediate, Advanced
4. **Preferred Cuisines** - Select favorites (Italian, Asian, Mexican, Mediterranean, etc.)
5. **Monthly Goals** - Select up to 3 goals (keto, try different cuisines, eat more veggies, more protein, more fiber)

---

## 🏠 Main Experience

### Home Screen
- Warm greeting with user's name
- **⚡ Quick Meals Section** - Prominent carousel highlighting recipes under 15 minutes with a lightning bolt badge
- Quick action button: **"What should I cook?"**
- Recent/saved recipes carousel
- Current month's goals displayed as tags
- Monthly budget status indicator (remaining vs. spent)

### Recipe Generation Flow
1. **Ingredient Input**
   - Text input to add ingredients quickly
   - Auto-suggestions as user types
   - One-tap "Add from Pantry" to pull saved ingredients
   - Visual ingredient tags that can be removed
   - **Time available** selector with **"Under 15 min"** as the first highlighted option
   - Quick filter toggle: "Quick Meals Only (< 15 min)"

2. **AI Recipe Generation**
   - Loading state with subtle animation
   - Displays **2-3 recipe options** as cards
   - **Quick meal recipes get a special "⚡ Quick" badge**
   - Each card shows:
     - Recipe name & photo placeholder
     - Cooking time estimate (highlighted if under 15 min)
     - Difficulty indicator
     - Calorie & macro summary (protein, carbs, fat, fiber)
     - Ingredients used from your list
     - **Goal alignment indicator** (shows which of your monthly goals this recipe supports)

3. **Recipe Detail View**
   - Hero image/placeholder
   - **Quick badge** if under 15 minutes
   - Full ingredient list with quantities
   - Step-by-step cooking instructions (numbered)
   - Nutrition breakdown panel (calories, protein, carbs, fat, fiber)
   - Goal tags showing alignment with monthly objectives
   - **Save to Favorites** button
   - **Cook Now** button

---

## 🎯 Monthly Goals & Budget

### Goals Setup Screen
- Set up to **3 monthly goals** from options:
  - 🥑 Keto diet
  - 🌍 Try different cuisines
  - 🥬 Eat more veggies
  - 💪 More protein
  - 🌾 More fiber
- Goals can be changed at any time during the month
- Visual progress indicators for each goal

### Grocery Budget Screen
- **Budget Input** - User enters their monthly grocery budget amount
- **AI-Powered Recommendations** - Based on selected goals, AI suggests:
  - Recommended ingredient categories
  - Specific ingredients to focus on
  - Estimated quantities needed for the month
  - Total estimated cost fitting within budget
- **Simple Total Breakdown** - Shows how budget maps to ingredients that support your goals

### Budget Tracking
- **Log Purchases** - Simple input to record grocery spending
- **Remaining Budget** - Visual indicator showing budget remaining for the month
- **Spending Summary** - See how much you've spent vs. your monthly limit
- Reset automatically at the start of each month

### Goal-Aligned Ingredient Suggestions
- When generating recipes, AI prioritizes ingredients that support your monthly goals
- Pantry suggestions aligned with current goals
- "Suggested for your goals" section when adding to pantry

---

## 🥫 My Pantry

### Saved Ingredients Screen
- Users can maintain a persistent list of what they typically have at home
- Add/remove ingredients easily
- Categories for organization (Proteins, Vegetables, Dairy, Grains, Spices, etc.)
- Quick-add common items
- **"Goal-recommended" badges** on ingredients that support monthly objectives
- This list can be pulled into recipe generation with one tap

---

## 💾 Saved Recipes

### Favorites Screen
- Grid or list view of saved AI-generated recipes
- **Filter by Quick Meals (< 15 min)**
- Search/filter by cuisine, time, or dietary tags
- Filter by goal alignment
- Tap to view full recipe
- Option to regenerate similar recipes

---

## 👤 Profile & Settings

### Profile Screen
- View/edit dietary preferences
- Update allergies and restrictions  
- Change cuisine preferences
- Cooking skill level
- **Monthly Goals Management** - View and update current goals
- **Budget Settings** - View/update monthly budget amount
- Account settings (email, password, sign out)
- App preferences

---

## Technical Approach

### Backend (Lovable Cloud)
- **User Authentication** - Email/password + Google + Apple via Supabase Auth
- **Database Tables:**
  - `profiles` - User preferences, dietary info, skill level, monthly goals
  - `pantry_items` - User's saved ingredients
  - `saved_recipes` - AI-generated recipes users have favorited
  - `monthly_budgets` - User's budget amount and tracking per month
  - `budget_transactions` - Individual purchase logs for tracking spending
- **AI Integration** - Lovable AI gateway for:
  - Recipe generation with goal alignment
  - Ingredient recommendations based on goals + budget

### Native Mobile
- Built as a responsive web app first
- Configured with Capacitor for iOS/Android deployment
- PWA-ready for installable web version
- Mobile-optimized UI throughout

### Design System
- Clean white backgrounds with subtle gray accents
- Soft rounded corners on cards and buttons
- Clear typography hierarchy
- **⚡ Lightning bolt icon** for quick meals
- Food-inspired accent color (warm orange or fresh green)
- Goal-aligned color coding for visual consistency
- Generous whitespace for a calm, focused experience

---

## What's NOT in MVP (Future Phases)
- Multi-day meal planning
- Shopping list generator (automatic)
- Ingredient substitution suggestions
- Image-based ingredient detection
- Voice interaction
- Nutrition app sync
- Community/social features
- Weekly budget breakdowns
- Category-based budget allocation

