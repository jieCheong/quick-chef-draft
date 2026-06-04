/* Stub for now
 */

import { useState, useEffect } from 'react';
// import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Profile, DietaryStyle, SkillLevel, MonthlyGoal } from '@/types/database';

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    setLoading(false);
  }, [user]);

  const updateProfile = async (updates: Partial<Omit<Profile, 'id' | 'user_id' | 'created_at' | 'updated_at'>>): Promise<{ error: Error | null }> => {
    return { error: new Error('Not implemented') };
  };
  /*
  const fetchProfile = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      setProfile(data as unknown as Profile);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<Omit<Profile, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => {
    if (!user) return { error: new Error('Not authenticated') };

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates as any)
        .eq('user_id', user.id);

      if (error) throw error;

      await fetchProfile();
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };
  */
  const completeOnboarding = async (data: {
    dietary_style: DietaryStyle;
    allergies: string[];
    skill_level: SkillLevel;
    preferred_cuisines: string[];
    monthly_goals: MonthlyGoal[];
    display_name?: string;
  }): Promise<{ error: Error | null }> => {
    return updateProfile({
      ...data,
      onboarding_completed: true,
    });
  };

  return {
    profile,
    loading,
    error,
    updateProfile,
    completeOnboarding,
    refetch: () => Promise.resolve(),
  };
}
