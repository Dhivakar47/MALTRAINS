import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User as SupaUser, Session } from '@supabase/supabase-js';
import { toast } from '@/hooks/use-toast';

export type AppRole = 'admin' | 'supervisor' | 'planner' | 'user';

interface AuthContextType {
  user: SupaUser | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  role: AppRole | null;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, displayName: string, requestedRole?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<SupaUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [role, setRole] = useState<AppRole | null>(null);

  const fetchRole = async (userId: string, userEmail?: string) => {
    // 1. Check user metadata for requested_role (stored in auth token, bypasses RLS)
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    console.log('AuthContext: fetchRole checking metadata for:', userId);
    if (currentUser?.user_metadata?.requested_role === 'admin') {
      console.log('AuthContext: Role set to admin from metadata');
      setRole('admin');
      return;
    }

    // 2. Check if user's email is in admin_registrations (approved)
    if (userEmail) {
      try {
        const { data: adminData, error: adminError } = await supabase
          .from('admin_registrations' as any)
          .select('email, status')
          .eq('email', userEmail)
          .eq('status', 'approved');

        if (adminError) {
          console.warn('admin_registrations query error (likely RLS):', adminError.message);
        }

        if (adminData && adminData.length > 0) {
          setRole('admin');
          return;
        }
      } catch (err) {
        console.warn('admin_registrations check failed:', err);
      }
    }

    // 3. Fallback: check user_roles table
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    // 4. Check if user is a deactivated staff member
    if (userEmail && currentUser?.user_metadata?.requested_role !== 'admin') {
      try {
        const { data: staffData } = await supabase
          .from('staff_members' as any)
          .select('is_active')
          .eq('email', userEmail)
          .maybeSingle();

        if (staffData && (staffData as any).is_active === false) {
          console.warn('AuthContext: User is deactivated staff. Blocking access.');
          setRole(null);
          await supabase.auth.signOut();
          toast({
            title: "Account Deactivated",
            description: "Your access has been suspended by an administrator.",
            variant: "destructive"
          });
          return;
        }
      } catch (err) {
        console.warn('Staff activation check skipped:', err);
      }
    }

    if (roleData && roleData.length > 0) {
      const priority: AppRole[] = ['admin', 'supervisor', 'planner', 'user'];
      const roles = roleData.map(r => r.role as AppRole);
      const topRole = priority.find(p => roles.includes(p)) || roles[0];
      setRole(topRole);
    } else {
      setRole(null);
    }
  };

  useEffect(() => {
    console.log('AuthContext: Initializing auth system...');

    // Safety timeout: If Supabase doesn't respond within 5 seconds, clear loading state
    const initializationTimeout = setTimeout(() => {
      if (isLoading) {
        console.warn('AuthContext: Initialization timed out. Forcing isLoading to false.');
        setIsLoading(false);
      }
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('AuthContext: Auth state changed. Event:', _event, 'Session:', !!session);
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRole(session.user.id, session.user.email);
      } else {
        setRole(null);
      }
      setIsLoading(false);
      clearTimeout(initializationTimeout);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('AuthContext: Initial session fetch complete. Session:', !!session);
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRole(session.user.id, session.user.email);
      }
      setIsLoading(false);
      clearTimeout(initializationTimeout);
    }).catch(err => {
      console.error('AuthContext: Error during initial session fetch:', err);
      setIsLoading(false);
      clearTimeout(initializationTimeout);
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(initializationTimeout);
    };
  }, []);

  const login = async (email: string, password: string) => {
    console.log('AuthContext: Attempting login for:', email);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        console.error('AuthContext: Login error:', error.message);
        return { success: false, error: error.message };
      }

      console.log('AuthContext: Login successful for:', email, 'Session:', !!data.session);

      // Manually update state to ensure UI reacts immediately
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
        fetchRole(data.session.user.id, data.session.user.email);
      }

      return { success: true };
    } catch (err: any) {
      console.error('AuthContext: Unexpected login error:', err);
      return {
        success: false,
        error: err.message || 'An unexpected error occurred during login.'
      };
    }
  };

  const register = async (email: string, password: string, displayName: string, requestedRole?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          display_name: displayName,
          requested_role: requestedRole
        },
      },
    });
    if (error) return { success: false, error: error.message };
    return { success: true, user: data.user, session: data.session };
  };

  const logout = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date().toISOString();

      // Auto-record exit time for any staff that are marked 'present' but haven't checked out today
      await supabase
        .from('staff_attendance')
        .update({ check_out_time: now } as any)
        .eq('status', 'present')
        .is('check_out_time', null)
        .gte('created_at', `${today}T00:00:00Z`);
    } catch (err) {
      console.warn('Auto check-out on logout failed:', err);
    } finally {
      await supabase.auth.signOut();
    }
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  };

  return (
    <AuthContext.Provider value={{ user, session, isAuthenticated: !!session, isLoading, role, isAdmin: role === 'admin', login, register, logout, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
