import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  X, ChevronLeft, ChevronRight, Volume2, VolumeX, 
  Play, Pause, Loader2, ImagePlus, ChefHat 
} from 'lucide-react';

interface CookingModeProps {
  recipe: {
    title: string;
    instructions: Array<{ step: number; instruction: string }>;
    ingredients: Array<{ name: string }>;
  };
  stepImages: Record<number, string>;
  onGenerateStepImage: (step: { step: number; instruction: string }) => Promise<string | null>;
  generatingStepImage: number | null;
  onClose: () => void;
}

export function CookingMode({
  recipe,
  stepImages,
  onGenerateStepImage,
  generatingStepImage,
  onClose,
}: CookingModeProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);

  const totalSteps = recipe.instructions.length;
  const step = recipe.instructions[currentStep];
  const progress = ((currentStep + 1) / totalSteps) * 100;

  // Speak the current step
  const speakStep = useCallback((text: string) => {
    if (!voiceEnabled || !('speechSynthesis' in window)) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    synthRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [voiceEnabled]);

  // Auto-speak when step changes
  useEffect(() => {
    if (step && voiceEnabled && !isPaused) {
      speakStep(`Step ${step.step}. ${step.instruction}`);
    }
    return () => {
      window.speechSynthesis.cancel();
    };
  }, [currentStep, voiceEnabled, isPaused, speakStep, step]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const goToNextStep = () => {
    if (currentStep < totalSteps - 1) {
      window.speechSynthesis.cancel();
      setCurrentStep(currentStep + 1);
    }
  };

  const goToPrevStep = () => {
    if (currentStep > 0) {
      window.speechSynthesis.cancel();
      setCurrentStep(currentStep - 1);
    }
  };

  const toggleVoice = () => {
    if (voiceEnabled) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
    setVoiceEnabled(!voiceEnabled);
  };

  const togglePause = () => {
    if (isPaused) {
      window.speechSynthesis.resume();
    } else {
      window.speechSynthesis.pause();
    }
    setIsPaused(!isPaused);
  };

  const replayVoice = () => {
    if (step) {
      speakStep(`Step ${step.step}. ${step.instruction}`);
    }
  };

  const handleGenerateImage = async () => {
    if (step) {
      await onGenerateStepImage(step);
    }
  };

  const currentImage = stepImages[step?.step];

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
        <div className="text-center">
          <h2 className="font-semibold text-sm">{recipe.title}</h2>
          <p className="text-xs text-muted-foreground">
            Step {currentStep + 1} of {totalSteps}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={toggleVoice}>
          {voiceEnabled ? (
            <Volume2 className="h-5 w-5" />
          ) : (
            <VolumeX className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Progress Bar */}
      <Progress value={progress} className="h-1 rounded-none" />

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-4 space-y-4">
          {/* Step Image */}
          <div className="relative aspect-video bg-muted rounded-xl overflow-hidden">
            {currentImage ? (
              <img
                src={currentImage}
                alt={`Step ${step.step}`}
                className="w-full h-full object-cover"
              />
            ) : generatingStepImage === step.step ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Generating image...</span>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                <ChefHat className="h-12 w-12 text-muted-foreground/30" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateImage}
                >
                  <ImagePlus className="h-4 w-4 mr-2" />
                  Generate Image
                </Button>
              </div>
            )}

            {/* Step Number Badge */}
            <div className="absolute top-4 left-4 w-12 h-12 rounded-full bg-primary text-primary-foreground font-bold text-xl flex items-center justify-center shadow-lg">
              {step.step}
            </div>
          </div>

          {/* Instruction Card */}
          <Card className="border-2">
            <CardContent className="p-6">
              <p className="text-lg leading-relaxed">{step.instruction}</p>
            </CardContent>
          </Card>

          {/* Voice Controls */}
          {voiceEnabled && 'speechSynthesis' in window && (
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={togglePause}
                disabled={!isSpeaking && !isPaused}
              >
                {isPaused ? (
                  <>
                    <Play className="h-4 w-4 mr-1" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="h-4 w-4 mr-1" />
                    Pause
                  </>
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={replayVoice}>
                <Volume2 className="h-4 w-4 mr-1" />
                Replay
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="border-t bg-background p-4">
        <div className="flex items-center justify-between gap-4">
          <Button
            variant="outline"
            size="lg"
            onClick={goToPrevStep}
            disabled={currentStep === 0}
            className="flex-1"
          >
            <ChevronLeft className="h-5 w-5 mr-1" />
            Previous
          </Button>
          
          {currentStep === totalSteps - 1 ? (
            <Button
              size="lg"
              onClick={onClose}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              Done! 🎉
            </Button>
          ) : (
            <Button
              size="lg"
              onClick={goToNextStep}
              className="flex-1"
            >
              Next
              <ChevronRight className="h-5 w-5 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
