import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RecipeRequest {
  ingredients: string[];
  maxTime: number;
  dietaryStyle?: string;
  allergies?: string[];
  skillLevel?: string;
  cuisines?: string[];
  goals?: string[];
  craving?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ingredients, maxTime, dietaryStyle, allergies, skillLevel, cuisines, goals, craving }: RecipeRequest = await req.json();

    const QuickChef_API_KEY = Deno.env.get("QuickChef_API_KEY");
    if (!QuickChef_API_KEY) {
      throw new Error("QuickChef_API_KEY is not configured");
    }

    const systemPrompt = `You are a creative, resourceful chef and nutritionist. Generate delicious recipes based on the user's available ingredients and preferences.

IMPORTANT RULES:
- Primarily use the ingredients provided, but you CAN suggest creative substitutions
- If the user is craving something specific (like pizza), get creative with available ingredients to make something similar
- For example: no pizza dough? Use tortilla, naan, or bread as a base for "pizza-style" dishes
- No pasta? Rice noodles or zucchini noodles work. No rice? Cauliflower rice or quinoa
- Be creative and resourceful - home cooks often need to improvise!
- Respect dietary restrictions and allergies absolutely (no substitutions that violate these)
- Match recipes to the user's skill level
- If goals are provided, prioritize recipes that support those nutritional goals
- Be accurate with nutrition estimates
- When suggesting substitutions, note them clearly in the recipe

SUBSTITUTION PHILOSOPHY:
- Think like a resourceful home cook
- Common substitutions: tortilla for pizza dough, Greek yogurt for sour cream, cauliflower for rice/potatoes
- Bread can become pizza base, croutons, breadcrumbs, or French toast
- Eggs can bind, leaven, or be the star protein
- Be creative but practical

For each recipe, provide:
- A creative, appetizing title (can reference what it's inspired by, e.g., "Tortilla Pizza Margherita")
- Brief description mentioning any clever substitutions used
- Accurate cooking time
- Difficulty level (easy, medium, hard)
- Servings (default 2-4)
- Detailed ingredient list with amounts
- Step-by-step instructions
- Nutrition estimates (calories, protein, carbs, fat, fiber)
- Which monthly goals the recipe supports
- Note any substitutions made

OUTPUT FORMAT: Return a JSON object with a "recipes" array containing 2-3 recipe objects.`;

    let userPrompt = `Generate 2-3 creative recipes using these ingredients: ${ingredients.join(", ")}`;

    if (craving) {
      userPrompt += `\n\nIMPORTANT: The user is craving: "${craving}". Try to create recipes that satisfy this craving using the available ingredients. Be creative with substitutions if needed!`;
    }

    userPrompt += `\n
Constraints:
- Maximum cooking time: ${maxTime} minutes
${dietaryStyle ? `- Dietary style: ${dietaryStyle}` : ""}
${allergies?.length ? `- Must avoid (allergies): ${allergies.join(", ")}` : ""}
${skillLevel ? `- Skill level: ${skillLevel}` : ""}
${cuisines?.length ? `- Preferred cuisines: ${cuisines.join(", ")}` : ""}
${goals?.length ? `- Monthly goals to support: ${goals.join(", ")}` : ""}

Return JSON with this exact structure:
{
  "recipes": [
    {
      "title": "Recipe Name",
      "description": "Brief appetizing description",
      "image_url": null,
      "cooking_time_minutes": 15,
      "difficulty": "easy",
      "servings": 2,
      "ingredients": [
        { "name": "chicken breast", "amount": "2", "unit": "pieces" }
      ],
      "instructions": [
        { "step": 1, "instruction": "Detailed step description" }
      ],
      "nutrition": { "calories": 350, "protein": 30, "carbs": 20, "fat": 15, "fiber": 5 },
      "cuisines": ["Italian"],
      "goal_alignment": ["more_protein"],
      "is_quick_meal": true
    }
  ]
}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000); // 55 second timeout

    const response = await fetch("https://ai.gateway.QuickChef.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${QuickChef_API_KEY}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Failed to generate recipes");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error("No response from AI");
    }

    const recipes = JSON.parse(content);

    return new Response(JSON.stringify(recipes), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-recipes:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
