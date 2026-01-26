import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ImagePlus, Loader2, ChefHat } from 'lucide-react';

interface RecipeStepCardProps {
  step: { step: number; instruction: string };
  recipeTitle: string;
  ingredients?: Array<{ name: string }>;
  imageUrl?: string;
  onGenerateImage?: () => Promise<string | null>;
  isGenerating?: boolean;
}

export function RecipeStepCard({
  step,
  recipeTitle,
  ingredients,
  imageUrl,
  onGenerateImage,
  isGenerating = false,
}: RecipeStepCardProps) {
  const [localImage, setLocalImage] = useState<string | null>(imageUrl || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (imageUrl) setLocalImage(imageUrl);
  }, [imageUrl]);

  const handleGenerateImage = async () => {
    if (!onGenerateImage || loading) return;
    setLoading(true);
    const url = await onGenerateImage();
    if (url) setLocalImage(url);
    setLoading(false);
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Image Section */}
        <div className="relative aspect-video bg-muted">
          {localImage ? (
            <img
              src={localImage}
              alt={`Step ${step.step}`}
              className="w-full h-full object-cover"
            />
          ) : loading || isGenerating ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Generating image...</span>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-4">
              <ChefHat className="h-10 w-10 text-muted-foreground/30" />
              {onGenerateImage && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateImage}
                  className="text-xs"
                >
                  <ImagePlus className="h-3 w-3 mr-1" />
                  Generate Image
                </Button>
              )}
            </div>
          )}
          
          {/* Step Number Badge */}
          <div className="absolute top-3 left-3 w-8 h-8 rounded-full bg-primary text-primary-foreground font-semibold flex items-center justify-center shadow-lg">
            {step.step}
          </div>
        </div>

        {/* Instruction */}
        <div className="p-4">
          <p className="text-sm leading-relaxed">{step.instruction}</p>
        </div>
      </CardContent>
    </Card>
  );
}
