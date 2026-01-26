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
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ingredients, maxTime, dietaryStyle, allergies, skillLevel, cuisines, goals }: RecipeRequest = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are a professional chef and nutritionist. Generate creative, delicious recipes based on the user's available ingredients and preferences.

IMPORTANT RULES:
- Only use the ingredients provided (you can assume basic pantry staples like salt, pepper, oil)
- Respect dietary restrictions and allergies
- Match recipes to the user's skill level
- If goals are provided, prioritize recipes that support those nutritional goals
- Be accurate with nutrition estimates

For each recipe, provide:
- A creative, appetizing title
- Brief description
- Accurate cooking time
- Difficulty level (easy, medium, hard)
- Servings (default 2-4)
- Detailed ingredient list with amounts
- Step-by-step instructions
- Nutrition estimates (calories, protein, carbs, fat, fiber)
- Which monthly goals the recipe supports

OUTPUT FORMAT: Return a JSON object with a "recipes" array containing 2-3 recipe objects.`;

    const userPrompt = `Generate 2-3 recipes using these ingredients: ${ingredients.join(", ")}

Constraints:
- Maximum cooking time: ${maxTime} minutes
${dietaryStyle ? `- Dietary style: ${dietaryStyle}` : ""}
${allergies?.length ? `- Must avoid: ${allergies.join(", ")}` : ""}
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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

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
