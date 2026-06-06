
import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { apiPost, apiGet } from '@/lib/api';

// types
export interface User {
  id: string;
  email: string;
  display_name?: string;
  onboarding_completed?: boolean;
}

interface AuthResponse {
  user: User;
  token: string;
}

interface MeResponse {
  user: User;
}

interface AuthContextType {
  user: User | null;
  // session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  // google and apple auth are stub for now
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInWithApple: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

// Token helpers
const TOKEN_KEY = 'qc_token';
const saveToken = (token: string) =>
localStorage.setItem(TOKEN_KEY, token);
const clearToken = () => localStorage.removeItem(TOKEN_KEY);
const getToken = () => localStorage.getItem(TOKEN_KEY);

/* Context - a react way of sharing state across the component tree
   without passing props down manually at every level
   how it works:
   1. AuthProvider wraps the whole app in App.tsx
   2. AuthProvider hold the user state and auth functions
   3. Any component that calls useAuth() gets that shared state
*/
// no props needed here, just the shared state and functions
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// provider - holds the shared state and functions, and wraps the app
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // const [session, setSession] = useState<Session | null>(null);
  // const [loading, setLoading] = useState(true);
  const [loading, setLoading] = useState(true); 

  useEffect(() => {
    const restoreSession = async () => {
      const token = getToken();

      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const data = await apiGet<MeResponse>('/api/auth/me');
        setUser(data.user);
      } catch {
        clearToken();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    restoreSession();
  }, []);

  // signin
  const signIn = async (
    email: string,
    password: string
  ): Promise<{error: Error | null}> => {
    try {
      const data = await apiPost<AuthResponse>
      ('/api/auth/login', {email, password});
      saveToken(data.token);
      setUser(data.user);

      return {error: null};
    } catch (err) {
      return {error: err instanceof Error ? err : new Error('Sign in failed')};
    }
  };
  // signup
    const signUp = async (
      email: string,
      password: string,
      displayName?: string
    ): Promise<{error:Error | null}> => {
      try {
        const data = await apiPost<AuthResponse> ('/api/auth/register', {
          email,
          password,
          display_name: displayName,
        });
        saveToken(data.token);
        setUser(data.user);

        return {error: null};
      } catch (err) {
        return { error: err instanceof Error ? err: new Error('Sign up failed')};
      }
    };

    // signOut
    const signOut = async (): Promise<void> => {
      clearToken();
      setUser(null);
    };
  
  const signInWithGoogle = async (): Promise<{ error: Error | null }> => {
    return { error: new Error('Google sign-in coming soon:)') };
  };

  const signInWithApple = async (): Promise<{ error: Error | null }> => {
    return { error: new Error('Apple sign-in coming soon:)') };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signUp,
        signIn,
        signOut,
        signInWithGoogle,
        signInWithApple,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

/* Hook
    the component facing API, ANy component imports and calls:
    const { user, signIn, signOut} = useAuth();
*/
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
