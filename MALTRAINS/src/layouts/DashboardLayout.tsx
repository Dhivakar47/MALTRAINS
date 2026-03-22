import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { LoginModal } from '@/components/LoginModal';
import { ChatbotPanel } from '@/components/ChatbotPanel';
import { UserProfileSetup } from '@/components/UserProfileSetup';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Train } from 'lucide-react';

export const DashboardLayout = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const queryClient = useQueryClient();

  // Check if user has a completed profile
  const { data: profile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await (supabase as any)
        .from('user_profiles')
        .select('is_profile_complete')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) {
        console.warn('Profile check error:', error.message);
        return null;
      }
      return data;
    },
    enabled: !!user && isAuthenticated,
  });

  if (isLoading || (isAuthenticated && isLoadingProfile)) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-muted-foreground animate-pulse text-sm">Initializing Login...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginModal />;
  }

  // Show profile setup if profile is missing or incomplete
  const profileComplete = profile?.is_profile_complete === true;
  if (!profileComplete) {
    return (
      <UserProfileSetup
        onComplete={() => {
          queryClient.invalidateQueries({ queryKey: ['user-profile', user?.id] });
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="ml-64">
        <DashboardHeader />
        <main className="p-6">
          <Outlet />
        </main>
        <ChatbotPanel />
      </div>
    </div>
  );
};
