/* This is STUB. The shape is correct (same interface the rest of the app expects),
   but signIn/signUp/signOut don't call the real API yet.
   It lets the app load so I can verify the UI still works while I build backend
 */
import { useState, createContext, useContext, ReactNode } from 'react';
// My user type will come here later
// import { User, Session } from '@supabase/supabase-js';
// import { supabase } from '@/integrations/supabase/client';

export interface User {
  id: string;
  email: string;
  display_name?: string;
}

interface AuthContextType {
  user: User | null;
  // session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  // signInWithGoogle: () => Promise<{ error: Error | null }>;
  // signInWithApple: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

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
  const [loading] = useState(false); // false rn bc not checking real session yet

  /* Stub functions
     return right shap ({error}) so Auth page doesn't crash for now
  */
  /*
  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);
  */

  const signUp = async (email: string, password: string, displayName?: string): Promise<{ error: Error | null }> => {
    /*const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: displayName,
        },
      },
    });
    */
    return { error: new Error('Not implemented') };
  };

  const signIn = async (email: string, password: string): Promise<{error: Error | null}> => {
    /*const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });*/
    return { error: new Error('Not implemented') };
  };
  /*
  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    return { error: error as Error | null };
  };

  const signInWithApple = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    return { error: error as Error | null };
  };
  */
  const signOut = async (): Promise<void> => {
    //await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signUp,
        signIn,
        signOut,
      }}
    >
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
