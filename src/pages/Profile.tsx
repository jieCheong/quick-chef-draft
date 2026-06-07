import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { GoalBadge } from '@/components/ui/goal-badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { 
  User, Settings, LogOut, ChevronRight, Check, Loader2, 
  Target, UtensilsCrossed, AlertTriangle, Globe, ChefHat
} from 'lucide-react';
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

export default function Profile() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { profile, loading: profileLoading, updateProfile } = useProfile();
  const { toast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Edit state
  const [displayName, setDisplayName] = useState('');
  const [dietaryStyle, setDietaryStyle] = useState<DietaryStyle>('omnivore');
  const [allergies, setAllergies] = useState<string[]>([]);
  const [skillLevel, setSkillLevel] = useState<SkillLevel>('beginner');
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [goals, setGoals] = useState<MonthlyGoal[]>([]);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setDietaryStyle(profile.dietary_style);
      setAllergies(profile.allergies);
      setSkillLevel(profile.skill_level);
      setCuisines(profile.preferred_cuisines);
      setGoals(profile.monthly_goals);
    }
  }, [profile]);

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
        toast({ description: 'You can select up to 3 goals' });
        return prev;
      }
      return [...prev, goal];
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    const { error } = await updateProfile({
      display_name: displayName || undefined,
      dietary_style: dietaryStyle,
      allergies,
      skill_level: skillLevel,
      preferred_cuisines: cuisines,
      monthly_goals: goals,
    });
    setIsSaving(false);

    if (error) {
      toast({
        variant: 'destructive',
        description: 'Failed to save changes',
      });
    } else {
      toast({ description: 'Profile updated!' });
      setIsEditing(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (profileLoading) {
    return (
      <MobileLayout>
        <div className="p-4 space-y-4">
          <Skeleton className="h-20 w-20 rounded-full mx-auto" />
          <Skeleton className="h-6 w-32 mx-auto" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </MobileLayout>
    );
  }

  if (isEditing) {
    return (
      <MobileLayout>
        <div className="p-4 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Edit Profile</h1>
            <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
          </div>

          {/* Display Name */}
          <div className="space-y-2">
            <Label>Display Name</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          {/* Dietary Style */}
          <div className="space-y-2">
            <Label>Dietary Style</Label>
            <div className="grid grid-cols-2 gap-2">
              {DIETARY_STYLES.map((style) => (
                <button
                  key={style.value}
                  onClick={() => setDietaryStyle(style.value)}
                  className={cn(
                    'p-3 rounded-lg border text-left text-sm transition-all',
                    dietaryStyle === style.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border'
                  )}
                >
                  {style.label}
                </button>
              ))}
            </div>
          </div>

          {/* Allergies */}
          <div className="space-y-2">
            <Label>Allergies & Restrictions</Label>
            <div className="flex flex-wrap gap-2">
              {COMMON_ALLERGIES.map((allergy) => (
                <Badge
                  key={allergy}
                  variant={allergies.includes(allergy) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleAllergy(allergy)}
                >
                  {allergy}
                </Badge>
              ))}
            </div>
          </div>

          {/* Skill Level */}
          <div className="space-y-2">
            <Label>Cooking Skill</Label>
            <div className="space-y-2">
              {SKILL_LEVELS.map((level) => (
                <button
                  key={level.value}
                  onClick={() => setSkillLevel(level.value)}
                  className={cn(
                    'w-full p-3 rounded-lg border text-left transition-all',
                    skillLevel === level.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border'
                  )}
                >
                  <span className="font-medium text-sm">{level.label}</span>
                  <p className="text-xs text-muted-foreground">{level.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Cuisines */}
          <div className="space-y-2">
            <Label>Favorite Cuisines</Label>
            <div className="flex flex-wrap gap-1.5">
              {CUISINES.map((cuisine) => (
                <Badge
                  key={cuisine}
                  variant={cuisines.includes(cuisine) ? 'default' : 'outline'}
                  className="cursor-pointer text-xs"
                  onClick={() => toggleCuisine(cuisine)}
                >
                  {cuisine}
                </Badge>
              ))}
            </div>
          </div>

          {/* Monthly Goals */}
          <div className="space-y-2">
            <Label>Monthly Goals (up to 3)</Label>
            <div className="space-y-2">
              {MONTHLY_GOALS.map((goal) => (
                <button
                  key={goal.value}
                  onClick={() => toggleGoal(goal.value)}
                  className={cn(
                    'w-full p-3 rounded-lg border text-left transition-all flex items-center gap-3',
                    goals.includes(goal.value)
                      ? 'border-primary bg-primary/5'
                      : 'border-border'
                  )}
                >
                  <span className="text-xl">{goal.emoji}</span>
                  <span className="text-sm font-medium flex-1">{goal.label}</span>
                  {goals.includes(goal.value) && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <Button className="w-full" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Changes
          </Button>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="p-4 space-y-6">
        {/* Profile Header */}
        <div className="text-center space-y-2">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <User className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-xl font-bold">{profile?.display_name || 'Chef'}</h1>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="text-center">
            <CardContent className="p-3">
              <UtensilsCrossed className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Diet</p>
              <p className="text-sm font-medium capitalize">{profile?.dietary_style}</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-3">
              <ChefHat className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Skill</p>
              <p className="text-sm font-medium capitalize">{profile?.skill_level}</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-3">
              <Target className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Goals</p>
              <p className="text-sm font-medium">{profile?.monthly_goals?.length || 0}</p>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Goals */}
        {profile?.monthly_goals && profile.monthly_goals.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">This Month's Goals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {profile.monthly_goals.map((goal) => (
                  <GoalBadge key={goal} goal={goal} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Allergies */}
        {profile?.allergies && profile.allergies.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Allergies
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {profile.allergies.map((allergy) => (
                  <Badge key={allergy} variant="destructive">{allergy}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Favorite Cuisines */}
        {profile?.preferred_cuisines && profile.preferred_cuisines.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Favorite Cuisines
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {profile.preferred_cuisines.map((cuisine) => (
                  <Badge key={cuisine} variant="secondary">{cuisine}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="space-y-2">
          <Button 
            variant="outline" 
            className="w-full justify-between"
            onClick={() => setIsEditing(true)}
          >
            <span className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Edit Preferences
            </span>
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button 
            variant="outline" 
            className="w-full justify-between text-destructive hover:text-destructive"
            onClick={handleSignOut}
          >
            <span className="flex items-center gap-2">
              <LogOut className="h-4 w-4" />
              Sign Out
            </span>
          </Button>
        </div>
      </div>
    </MobileLayout>
  );
}
