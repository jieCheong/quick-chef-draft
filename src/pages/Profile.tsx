// src/pages/Profile.tsx — redesigned UI, real API calls preserved
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useToast } from '@/hooks/use-toast';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { DIETARY_STYLES, MONTHLY_GOALS, type DietaryStyle } from '@/types/database';

const SKILL_OPTS = ['beginner', 'intermediate', 'advanced'] as const;

const formatLabel = (s: string) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

export default function Profile() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { profile, loading, updateProfile } = useProfile();
  const { toast } = useToast();

  const toggle = async (field: 'allergies' | 'preferred_cuisines' | 'monthly_goals', value: string) => {
    if (!profile) return;
    const current: string[] = (profile[field] as string[]) || [];
    const updated = current.includes(value) ? current.filter(i => i !== value) : [...current, value];
    const { error } = await updateProfile({ [field]: updated });
    if (error) toast({ variant: 'destructive', description: 'Failed to update.' });
  };

  const setSkill = async (level: string) => {
    if (!profile) return;
    const { error } = await updateProfile({ skill_level: level as typeof SKILL_OPTS[number] });
    if (error) toast({ variant: 'destructive', description: 'Failed to update.' });
  };

  const setDiet = async (diet: DietaryStyle) => {
    if (!profile) return;
    const { error } = await updateProfile({ dietary_style: diet });
    if (error) toast({ variant: 'destructive', description: 'Failed to update.' });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (loading) {
    return (
      <MobileLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div>
        <div className="px-5 pt-14 pb-5">
          <h1 className="text-4xl" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>Profile</h1>
        </div>

        {/* Avatar */}
        <div className="px-5 mb-6 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-accent/15 flex items-center justify-center text-2xl">
            👩‍🍳
          </div>
          <div>
            <p className="font-bold text-lg">{profile?.display_name || user?.email?.split('@')[0] || 'Chef'}</p>
            <p className="text-muted-foreground text-sm">{user?.email}</p>
          </div>
        </div>

        {/* Dietary preference */}
        <div className="px-5 mb-6">
          <h3 className="font-semibold mb-3 text-sm">Dietary Style</h3>
          <div className="flex flex-wrap gap-2">
            {DIETARY_STYLES.map(({ value, label }) => (
              <button key={value} onClick={() => setDiet(value)}
                className={cn('flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors border',
                  profile?.dietary_style === value
                    ? 'bg-foreground text-primary-foreground border-foreground'
                    : 'bg-card border-border text-foreground')}>
                {profile?.dietary_style === value && <Check size={12} />}
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Goals */}
        <div className="px-5 mb-6">
          <h3 className="font-semibold mb-3 text-sm">Monthly Goals</h3>
          <div className="flex flex-wrap gap-2">
            {MONTHLY_GOALS.map(({ value, label }) => (
              <button key={value} onClick={() => toggle('monthly_goals', value)}
                className={cn('px-3 py-2 rounded-xl text-sm font-medium transition-colors border',
                  profile?.monthly_goals?.includes(value)
                    ? 'bg-accent text-accent-foreground border-accent'
                    : 'bg-card border-border text-foreground')}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Skill level */}
        <div className="px-5 mb-6">
          <h3 className="font-semibold mb-3 text-sm">Cooking Skill</h3>
          <div className="flex gap-2">
            {SKILL_OPTS.map(level => (
              <button key={level} onClick={() => setSkill(level)}
                className={cn('flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors capitalize',
                  profile?.skill_level === level
                    ? 'bg-foreground text-primary-foreground border-foreground'
                    : 'bg-card border-border text-foreground')}>
                {formatLabel(level)}
              </button>
            ))}
          </div>
        </div>

        {/* Sign out */}
        <div className="px-5 pb-6">
          <button onClick={handleSignOut}
            className="w-full rounded-2xl border border-border py-3.5 text-sm font-medium text-muted-foreground hover:text-destructive hover:border-destructive transition-colors">
            Sign Out
          </button>
        </div>
      </div>
    </MobileLayout>
  );
}
