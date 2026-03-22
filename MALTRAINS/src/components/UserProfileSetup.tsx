import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Train, User, Phone, Building2, Calendar, MapPin, Shield, CheckCircle, Briefcase } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

interface UserProfileSetupProps {
  onComplete: () => void;
}

export const UserProfileSetup = ({ onComplete }: UserProfileSetupProps) => {
  const { user, isAdmin } = useAuth();
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const [fullName, setFullName] = useState(user?.user_metadata?.display_name || '');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [address, setAddress] = useState('');

  const departments = isAdmin
    ? ['Operations', 'Administration', 'Safety & Security', 'Engineering', 'IT & Systems', 'HR & Finance']
    : ['Train Operations', 'Platform Management', 'Ticketing', 'Maintenance', 'Security', 'Customer Service'];

  const designations = isAdmin
    ? ['Station Manager', 'Operations Supervisor', 'Chief Engineer', 'IT Manager', 'HR Manager', 'Safety Officer']
    : ['Train Operator', 'Platform Staff', 'Ticketing Agent', 'Maintenance Technician', 'Security Guard', 'Customer Care'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (step === 1) {
      if (!fullName || !phone || !department || !designation) {
        toast({ title: 'Missing Info', description: 'Please fill all required fields.', variant: 'destructive' });
        return;
      }
      setStep(2);
      return;
    }

    // Step 2 — Save profile
    setIsLoading(true);
    try {
      const { error } = await (supabase as any)
        .from('user_profiles')
        .upsert({
          user_id: user.id,
          full_name: fullName,
          phone_number: phone,
          department,
          designation,
          date_of_birth: dob || null,
          gender: gender || null,
          emergency_contact: emergencyContact || null,
          address: address || null,
          role: isAdmin ? 'admin' : 'user',
          is_profile_complete: true,
        });

      if (error) throw error;

      toast({ title: '✅ Profile Complete!', description: 'Your profile has been saved successfully.' });
      onComplete();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to save profile.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const totalSteps = 2;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0a0c]">
      {/* Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/15 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-info/10 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-lg relative z-10">
        {/* Header */}
        <div className="text-center mb-8 space-y-3">
          <div className="relative inline-block">
            <div className="absolute -inset-2 bg-gradient-to-r from-primary/40 to-info/40 rounded-2xl blur-lg opacity-50 animate-pulse" />
            <div className="relative w-16 h-16 bg-gradient-to-br from-[#1e2028] to-[#0f1014] rounded-2xl flex items-center justify-center ring-1 ring-white/10">
              {isAdmin ? <Shield className="w-8 h-8 text-primary" /> : <User className="w-8 h-8 text-primary" />}
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {isAdmin ? 'Admin Profile Setup' : 'Employee Profile Setup'}
            </h1>
            <p className="text-white/40 text-sm mt-1">
              Please complete your profile to continue
            </p>
          </div>
          {/* Progress Bar */}
          <div className="flex items-center gap-2 justify-center pt-1">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-500 ${i + 1 <= step ? 'bg-primary w-10' : 'bg-white/15 w-6'}`}
              />
            ))}
            <span className="text-[10px] text-white/30 ml-2 uppercase tracking-widest">Step {step} of {totalSteps}</span>
          </div>
        </div>

        <Card className="border-white/10 bg-[#16181d]/80 backdrop-blur-2xl shadow-2xl ring-1 ring-white/5">
          <CardHeader className="pb-2 pt-6 px-8">
            <h2 className="text-lg font-semibold text-white">
              {step === 1 ? '🪪 Basic Information' : '📍 Additional Details'}
            </h2>
            <p className="text-xs text-white/40">
              {step === 1 ? 'Your role and contact information' : 'Optional but recommended for complete records'}
            </p>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              {step === 1 ? (
                <>
                  {/* Full Name */}
                  <div className="space-y-2">
                    <Label className="text-white/70 text-xs font-bold uppercase tracking-wider">Full Name *</Label>
                    <div className="relative group">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-primary transition-colors" />
                      <Input
                        placeholder="Your full legal name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="h-11 pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-primary focus-visible:bg-white/10"
                        required
                      />
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="space-y-2">
                    <Label className="text-white/70 text-xs font-bold uppercase tracking-wider">Phone Number *</Label>
                    <div className="relative group">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-primary transition-colors" />
                      <Input
                        placeholder="+91 XXXXX XXXXX"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="h-11 pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-primary"
                        required
                      />
                    </div>
                  </div>

                  {/* Department */}
                  <div className="space-y-2">
                    <Label className="text-white/70 text-xs font-bold uppercase tracking-wider">Department *</Label>
                    <div className="relative group">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 z-10 pointer-events-none group-focus-within:text-primary transition-colors" />
                      <Select onValueChange={setDepartment} value={department}>
                        <SelectTrigger className="h-11 pl-10 bg-white/5 border-white/10 text-white focus:ring-primary">
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Designation */}
                  <div className="space-y-2">
                    <Label className="text-white/70 text-xs font-bold uppercase tracking-wider">Designation *</Label>
                    <div className="relative group">
                      <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 z-10 pointer-events-none" />
                      <Select onValueChange={setDesignation} value={designation}>
                        <SelectTrigger className="h-11 pl-10 bg-white/5 border-white/10 text-white focus:ring-primary">
                          <SelectValue placeholder="Select designation" />
                        </SelectTrigger>
                        <SelectContent>
                          {designations.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-bold mt-2">
                    Continue →
                  </Button>
                </>
              ) : (
                <>
                  {/* Date of Birth */}
                  <div className="space-y-2">
                    <Label className="text-white/70 text-xs font-bold uppercase tracking-wider">Date of Birth</Label>
                    <div className="relative group">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-primary transition-colors" />
                      <Input
                        type="date"
                        value={dob}
                        onChange={(e) => setDob(e.target.value)}
                        className="h-11 pl-10 bg-white/5 border-white/10 text-white focus-visible:ring-primary [color-scheme:dark]"
                      />
                    </div>
                  </div>

                  {/* Gender */}
                  <div className="space-y-2">
                    <Label className="text-white/70 text-xs font-bold uppercase tracking-wider">Gender</Label>
                    <Select onValueChange={setGender} value={gender}>
                      <SelectTrigger className="h-11 bg-white/5 border-white/10 text-white focus:ring-primary">
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                        <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Emergency Contact */}
                  <div className="space-y-2">
                    <Label className="text-white/70 text-xs font-bold uppercase tracking-wider">Emergency Contact</Label>
                    <div className="relative group">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-primary transition-colors" />
                      <Input
                        placeholder="Name & Phone (e.g. John - +91 99999)"
                        value={emergencyContact}
                        onChange={(e) => setEmergencyContact(e.target.value)}
                        className="h-11 pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-primary"
                      />
                    </div>
                  </div>

                  {/* Address */}
                  <div className="space-y-2">
                    <Label className="text-white/70 text-xs font-bold uppercase tracking-wider">Residential Address</Label>
                    <div className="relative group">
                      <MapPin className="absolute left-3 top-3 w-4 h-4 text-white/20 group-focus-within:text-primary transition-colors" />
                      <Textarea
                        placeholder="Your current address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-primary resize-none"
                        rows={2}
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-1">
                    <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1 h-11 border-white/10 text-white/60 hover:text-white">
                      ← Back
                    </Button>
                    <Button type="submit" disabled={isLoading} className="flex-2 flex-1 h-11 bg-primary hover:bg-primary/90 text-white font-bold gap-2">
                      {isLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Complete Profile
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-[10px] text-white/20 mt-6 uppercase tracking-widest">
          MALTRAINS • Secure Employee Portal
        </p>
      </div>
    </div>
  );
};
