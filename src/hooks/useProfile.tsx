// fetches the profile on mount

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { apiGet, apiPatch } from '@/lib/api';
import type { Profile, DietaryStyle, SkillLevel, MonthlyGoal } from '@/types/database';

// shape the server returns
interface ProfileResponse {
  profile: Profile;
}

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<ProfileResponse>('/api/profile');
      setProfile(data.profile);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load profile'));
    } finally {
      setLoading(false);
    }
  }, []);

  // fetch profile whenever the logged in user changes
  // when user logs in -> user becomes non-null -> fetch their profile
  // when user logs out -> user becomes null -> clear profile from state
  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    fetchProfile();
  }, [user, fetchProfile]);

  // updateProfile
  // sends only the changed fields to PATCH /api/profile
  // on success, merges the returned profile into local state so the UI updates immediately without needing full refetch
  const updateProfile = async (updates: Partial<Omit<Profile, 'id' | 'user_id' | 'created_at' | 'updated_at'>>): Promise<{ error: Error | null}> => {
    try {
      const data = await apiPatch<ProfileResponse>('/api/profile', updates);

      // Merge - dont replace so any fields not in the update are preserved
        setProfile(prev => prev ? {...prev, ...data.profile} : data.profile);

      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Failed to update profile') };
    }
  };
  
  // completeOnboarding
  // called from Onboarding.tsx on the final step
  // sets onboarding_completed: true along with all the user's preferences
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
    refetch: fetchProfile,
  };
}
