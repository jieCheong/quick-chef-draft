import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '@/hooks/useProfile';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ChefHat, ArrowRight, ArrowLeft, Check, Loader2 } from 'lucide-react';
import { 
  DIETARY_STYLES, 
  SKILL_LEVELS, 
  MONTHLY_GOALS, 
  CUISINES, 
  COMMON_ALLERGIES,
  type DietaryStyle,
  type SkillLevel,
  type MonthlyGoal
} from '@/types/database';

const TOTAL_STEPS = 5;

export default function Onboarding() {
  const navigate = useNavigate();
  const { completeOnboarding } = useProfile();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [dietaryStyle, setDietaryStyle] = useState<DietaryStyle>('omnivore');
  const [allergies, setAllergies] = useState<string[]>([]);
  const [skillLevel, setSkillLevel] = useState<SkillLevel>('beginner');
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [goals, setGoals] = useState<MonthlyGoal[]>([]);

  const progress = (step / TOTAL_STEPS) * 100;

  const toggleAllergy = (allergy: string) => {
    setAllergies(prev =>
      prev.includes(allergy)
        ? prev.filter(a => a !== allergy)
        : [...prev, allergy]
    );
  };

  const toggleCuisine = (cuisine: string) => {
    setCuisines(prev =>
      prev.includes(cuisine)
        ? prev.filter(c => c !== cuisine)
        : [...prev, cuisine]
    );
  };

  const toggleGoal = (goal: MonthlyGoal) => {
    setGoals(prev => {
      if (prev.includes(goal)) {
        return prev.filter(g => g !== goal);
      }
      if (prev.length >= 3) {
        toast({
          description: 'You can select up to 3 goals',
        });
        return prev;
      }
      return [...prev, goal];
    });
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleComplete = async () => {
    setIsLoading(true);
    const { error } = await completeOnboarding({
      display_name: displayName || undefined,
      dietary_style: dietaryStyle,
      allergies,
      skill_level: skillLevel,
      preferred_cuisines: cuisines,
      monthly_goals: goals,
    });
    setIsLoading(false);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save preferences. Please try again.',
      });
    } else {
      toast({
        title: 'Welcome to QuickChef! 🎉',
        description: 'Your preferences have been saved.',
      });
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
            <ChefHat className="h-5 w-5" />
          </div>
          <span className="font-semibold">QuickChef</span>
        </div>
        <span className="text-sm text-muted-foreground">Step {step} of {TOTAL_STEPS}</span>
      </div>

      {/* Progress */}
      <Progress value={progress} className="h-2 mb-8" />

      {/* Content */}
      <div className="flex-1 flex flex-col">
        {/* Step 1: Name */}
        {step === 1 && (
          <Card className="flex-1 flex flex-col animate-fade-in">
            <CardHeader>
              <CardTitle>What should we call you?</CardTitle>
              <CardDescription>This is optional, but it helps personalize your experience.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="space-y-2">
                <Label htmlFor="name">Your name</Label>
                <Input
                  id="name"
                  placeholder="Enter your name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="text-lg"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Dietary Style */}
        {step === 2 && (
          <Card className="flex-1 flex flex-col animate-fade-in">
            <CardHeader>
              <CardTitle>What's your dietary style?</CardTitle>
              <CardDescription>We'll customize recipes based on your preferences.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="grid grid-cols-2 gap-3">
                {DIETARY_STYLES.map((style) => (
                  <button
                    key={style.value}
                    onClick={() => setDietaryStyle(style.value)}
                    className={cn(
                      'p-4 rounded-xl border-2 text-left transition-all',
                      dietaryStyle === style.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    <span className="font-medium">{style.label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Allergies */}
        {step === 3 && (
          <Card className="flex-1 flex flex-col animate-fade-in">
            <CardHeader>
              <CardTitle>Any allergies or restrictions?</CardTitle>
              <CardDescription>Select all that apply. We'll avoid these in recipes.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="flex flex-wrap gap-2">
                {COMMON_ALLERGIES.map((allergy) => (
                  <button
                    key={allergy}
                    onClick={() => toggleAllergy(allergy)}
                    className={cn(
                      'px-4 py-2 rounded-full border-2 text-sm font-medium transition-all',
                      allergies.includes(allergy)
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    {allergy}
                  </button>
                ))}
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                {allergies.length === 0 ? 'No allergies selected' : `${allergies.length} selected`}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Skill Level & Cuisines */}
        {step === 4 && (
          <Card className="flex-1 flex flex-col animate-fade-in overflow-hidden">
            <CardHeader>
              <CardTitle>Cooking experience & preferences</CardTitle>
              <CardDescription>Tell us about your skill level and favorite cuisines.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto space-y-6">
              <div className="space-y-3">
                <Label>Skill Level</Label>
                <div className="space-y-2">
                  {SKILL_LEVELS.map((level) => (
                    <button
                      key={level.value}
                      onClick={() => setSkillLevel(level.value)}
                      className={cn(
                        'w-full p-4 rounded-xl border-2 text-left transition-all',
                        skillLevel === level.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      )}
                    >
                      <span className="font-medium">{level.label}</span>
                      <p className="text-sm text-muted-foreground">{level.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label>Favorite Cuisines</Label>
                <div className="flex flex-wrap gap-2">
                  {CUISINES.map((cuisine) => (
                    <button
                      key={cuisine}
                      onClick={() => toggleCuisine(cuisine)}
                      className={cn(
                        'px-3 py-1.5 rounded-full border text-sm transition-all',
                        cuisines.includes(cuisine)
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border hover:border-primary/50'
                      )}
                    >
                      {cuisine}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 5: Monthly Goals */}
        {step === 5 && (
          <Card className="flex-1 flex flex-col animate-fade-in">
            <CardHeader>
              <CardTitle>Set your monthly goals</CardTitle>
              <CardDescription>Select up to 3 goals. We'll recommend recipes and ingredients that support them.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="space-y-3">
                {MONTHLY_GOALS.map((goal) => (
                  <button
                    key={goal.value}
                    onClick={() => toggleGoal(goal.value)}
                    className={cn(
                      'w-full p-4 rounded-xl border-2 text-left transition-all flex items-center gap-4',
                      goals.includes(goal.value)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    <span className="text-2xl">{goal.emoji}</span>
                    <span className="font-medium flex-1">{goal.label}</span>
                    {goals.includes(goal.value) && (
                      <Check className="h-5 w-5 text-primary" />
                    )}
                  </button>
                ))}
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                {goals.length}/3 goals selected
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-3 mt-6 safe-bottom">
        {step > 1 && (
          <Button variant="outline" onClick={handleBack} className="flex-1">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        )}
        {step < TOTAL_STEPS ? (
          <Button onClick={handleNext} className="flex-1">
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={handleComplete} className="flex-1" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Get Started
                <Check className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
