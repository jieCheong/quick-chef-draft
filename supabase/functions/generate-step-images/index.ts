import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StepImageRequest {
  recipeTitle: string;
  stepNumber: number;
  stepInstruction: string;
  ingredients?: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipeTitle, stepNumber, stepInstruction, ingredients }: StepImageRequest = await req.json();

    const QuickChef_API_KEY = Deno.env.get("QuickChef_API_KEY");
    if (!QuickChef_API_KEY) {
      throw new Error("QuickChef_API_KEY is not configured");
    }

    const ingredientContext = ingredients?.slice(0, 3).join(", ") || "";
    
    const prompt = `Professional cooking photography, step ${stepNumber} of making ${recipeTitle}: ${stepInstruction}. ${ingredientContext ? `Using ${ingredientContext}.` : ""} Overhead or 45-degree angle shot, clean kitchen background, hands visible if cooking action, soft natural lighting, high-end food magazine style. Ultra high resolution.`;

    console.log("Generating step image:", prompt);

    const response = await fetch("https://ai.gateway.QuickChef.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${QuickChef_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"]
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("Failed to generate image");
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      throw new Error("No image generated");
    }

    return new Response(JSON.stringify({ image_url: imageUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-step-images:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
