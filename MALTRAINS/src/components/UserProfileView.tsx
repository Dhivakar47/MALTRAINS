import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  User, Mail, Phone, Building2, Briefcase, Calendar,
  MapPin, Shield, AlertCircle, IdCard, UserCheck, Train,
} from 'lucide-react';

interface UserProfileViewProps {
  open: boolean;
  onClose: () => void;
}

const InfoCard = ({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value?: string | null;
}) => {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/[0.07] transition-colors">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary/70" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">{label}</span>
      </div>
      <p className="text-sm text-white/90 font-medium break-words pl-6">{value}</p>
    </div>
  );
};

export const UserProfileView = ({ open, onClose }: UserProfileViewProps) => {
  const { user, isAdmin, role } = useAuth();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['user-profile-full', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await (supabase as any)
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user && open,
  });

  const displayName = profile?.full_name || user?.user_metadata?.display_name || user?.email || 'User';
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  };

  const formatGender = (g?: string) => {
    if (!g) return null;
    if (g === 'prefer_not_to_say') return 'Prefer not to say';
    return g.charAt(0).toUpperCase() + g.slice(1);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl w-full bg-[#13151a] border-white/10 text-white p-0 overflow-hidden max-h-[90vh] flex flex-col">
        
        {/* Banner */}
        <div className="relative h-48 flex-shrink-0 bg-gradient-to-br from-primary/40 via-primary/15 to-info/20 overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-info/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />
          </div>
          {/* MALTRAINS watermark */}
          <div className="absolute top-4 right-5 flex items-center gap-1.5 opacity-30">
            <Train className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-[0.25em]">MALTRAINS</span>
          </div>
          {/* Grid lines decorative */}
          <div className="absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)', backgroundSize: '40px 40px' }}
          />
          {/* Avatar */}
          <div className="absolute bottom-0 translate-y-1/2 left-8">
            <div className="relative">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center text-white text-3xl font-extrabold ring-4 ring-[#13151a] shadow-2xl">
                {initials}
              </div>
              <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-success border-[3px] border-[#13151a] rounded-full" />
              {isAdmin && (
                <div className="absolute -top-2 -right-2 w-7 h-7 bg-amber-400 rounded-full flex items-center justify-center shadow-lg">
                  <Shield className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Name + Role Section */}
        <div className="pt-16 px-8 pb-4 flex items-end justify-between border-b border-white/5 flex-shrink-0">
          <div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">{displayName}</h2>
            <p className="text-sm text-white/40 mt-0.5">{user?.email}</p>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <Badge className={`text-xs font-bold uppercase tracking-widest px-3 py-1 ${
              isAdmin
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                : 'bg-primary/15 text-primary border border-primary/20'
            }`}>
              {isAdmin ? '⚡ Admin' : `👤 ${role || 'Staff'}`}
            </Badge>
            {profile?.department && (
              <Badge className="text-xs font-medium px-3 py-1 bg-white/5 text-white/50 border border-white/10">
                {profile.department}
              </Badge>
            )}
          </div>
        </div>

        <DialogHeader className="px-8 pt-5 pb-2 flex-shrink-0">
          <DialogTitle className="text-xs text-white/25 uppercase tracking-[0.2em] font-bold">
            Employee Information
          </DialogTitle>
        </DialogHeader>

        {/* Info Grid */}
        <div className="px-8 pb-8 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : profile ? (
            <div className="grid grid-cols-2 gap-3">
              <InfoCard icon={IdCard}      label="Employee ID"       value={profile.employee_id || `EMP-${user?.id?.slice(0, 6).toUpperCase()}`} />
              <InfoCard icon={Mail}        label="Email Address"     value={user?.email} />
              <InfoCard icon={Phone}       label="Phone Number"      value={profile.phone_number} />
              <InfoCard icon={Building2}   label="Department"        value={profile.department} />
              <InfoCard icon={Briefcase}   label="Designation"       value={profile.designation} />
              <InfoCard icon={User}        label="Gender"            value={formatGender(profile.gender)} />
              <InfoCard icon={Calendar}    label="Date of Birth"     value={formatDate(profile.date_of_birth)} />
              <InfoCard icon={Calendar}    label="Joined Date"       value={formatDate(profile.joined_date)} />
              <InfoCard icon={AlertCircle} label="Emergency Contact" value={profile.emergency_contact} />
              <InfoCard icon={MapPin}      label="Residential Address" value={profile.address} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-white/20">
              <UserCheck className="w-12 h-12" />
              <p className="text-sm">No profile data found.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
