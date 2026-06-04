// stub, the image generation calls will move to POST /api/generate-image

import { useState } from 'react';
// import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useRecipeImage() {
  const [isGenerating] = useState(false);
  const { toast } = useToast();

  const generateImage = async (
    _recipeId: string,
    _recipeTitle: string,
    _recipeDescription?: string,
    _ingredients?: Array<{ name: string }>
  ): Promise<string | null> => {
    toast({ description: 'Generating recipe image soon.'});
    return null;
  };
  return {generateImage, isGenerating};
}
    /*
    setIsGenerating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-recipe-image', {
        body: {
          recipeId,
          recipeTitle,
          recipeDescription,
          ingredients: ingredients?.map(i => i.name),
        },
      });

      if (error) throw error;

      if (data.image_url) {
        toast({
          description: 'Recipe image generated!',
        });
        return data.image_url;
      }
      
      return null;
    } catch (error) {
      console.error('Error generating recipe image:', error);
      // Don't show error toast for image generation - it's optional
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  return { generateImage, isGenerating };
}
*/