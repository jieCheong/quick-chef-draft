import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BudgetRequest {
  budgetAmount: number;
  goals: string[];
  dietaryStyle?: string;
  allergies?: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { budgetAmount, goals, dietaryStyle, allergies }: BudgetRequest = await req.json();

    const QuickChef_API_KEY = Deno.env.get("QuickChef_API_KEY");
    if (!QuickChef_API_KEY) {
      throw new Error("QuickChef_API_KEY is not configured");
    }

    const systemPrompt = `You are a nutritionist and budget-conscious meal planner. Help users plan their monthly grocery budget based on their health goals.

Goals explained:
- keto: Focus on high-fat, low-carb foods (avocados, nuts, fatty fish, eggs, cheese)
- try_different_cuisines: Suggest ingredients for various global cuisines
- eat_more_veggies: Prioritize fresh vegetables, leafy greens, plant-based options
- more_protein: Focus on lean proteins, legumes, Greek yogurt, eggs
- more_fiber: Whole grains, legumes, vegetables, fruits with skin

Provide practical, budget-friendly suggestions that align with the user's goals.`;

    const userPrompt = `Create a monthly grocery recommendation for a $${budgetAmount} budget.

Goals: ${goals.join(", ")}
${dietaryStyle ? `Dietary style: ${dietaryStyle}` : ""}
${allergies?.length ? `Must avoid: ${allergies.join(", ")}` : ""}

Return JSON with this exact structure:
{
  "categories": [
    { "name": "Proteins", "percentage": 30, "amount": 90 }
  ],
  "ingredients": [
    { "name": "Chicken breast", "estimatedCost": 15, "goalAlignment": ["more_protein"] }
  ],
  "tips": [
    "Buy chicken in bulk and freeze portions"
  ]
}

Include 8-10 key ingredients that support the goals, with realistic cost estimates.
Provide 3-4 practical money-saving tips.`;

    const response = await fetch("https://ai.gateway.QuickChef.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${QuickChef_API_KEY}`,
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
      throw new Error("Failed to get recommendations");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error("No response from AI");
    }

    const recommendations = JSON.parse(content);

    return new Response(JSON.stringify(recommendations), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in budget-recommendations:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
