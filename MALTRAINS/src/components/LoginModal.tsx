import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from "@/integrations/supabase/client";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Train, Shield, Lock, Mail, UserPlus, User, ShieldCheck, Activity, Settings, Cpu, Users, BarChart3, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';


type LoginType = 'user' | 'admin';
type RegisterType = 'user' | 'admin';
type AppIdentity = 'admin' | 'supervisor';

const MetroBackground = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
    <svg className="w-full h-full" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="line-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0" />
          <stop offset="50%" stopColor="var(--primary)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      
      {/* Background Track Lines */}
      <path d="M-100 200 L1100 200" stroke="white" strokeOpacity="0.05" strokeWidth="0.5" fill="none" />
      <path d="M-100 500 L1100 500" stroke="white" strokeOpacity="0.05" strokeWidth="0.5" fill="none" />
      <path d="M-100 800 L1100 800" stroke="white" strokeOpacity="0.05" strokeWidth="0.5" fill="none" />
      <path d="M200 -100 L200 1100" stroke="white" strokeOpacity="0.05" strokeWidth="0.5" fill="none" />
      <path d="M500 -100 L500 1100" stroke="white" strokeOpacity="0.05" strokeWidth="0.5" fill="none" />
      <path d="M800 -100 L800 1100" stroke="white" strokeOpacity="0.05" strokeWidth="0.5" fill="none" />

      {/* Moving Trains (Pulses) */}
      <rect width="100" height="2" fill="url(#line-grad)" className="animate-metro-line-1" style={{ filter: 'blur(1px)' }} />
      <rect width="150" height="2" fill="url(#line-grad)" className="animate-metro-line-2" style={{ filter: 'blur(1px)' }} />
      <rect width="80" height="2" fill="url(#line-grad)" className="animate-metro-line-3" style={{ filter: 'blur(1px)' }} />
    </svg>
    <style dangerouslySetInnerHTML={{ __html: `
      @keyframes metro-move-1 {
        0% { transform: translate(-200px, 200px); }
        100% { transform: translate(1200px, 200px); }
      }
      @keyframes metro-move-2 {
        0% { transform: translate(500px, -200px) rotate(90deg); }
        100% { transform: translate(500px, 1200px) rotate(90deg); }
      }
      @keyframes metro-move-3 {
        0% { transform: translate(1200px, 800px) scaleX(-1); }
        100% { transform: translate(-200px, 800px) scaleX(-1); }
      }
      .animate-metro-line-1 { animation: metro-move-1 8s linear infinite; }
      .animate-metro-line-2 { animation: metro-move-2 12s linear infinite; delay: 2s; }
      .animate-metro-line-3 { animation: metro-move-3 10s linear infinite; delay: 5s; }
    `}} />
  </div>
);

export const LoginModal = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loginType, setLoginType] = useState<LoginType>('user');
  const [registerType, setRegisterType] = useState<RegisterType>('user');
  const [showRegister, setShowRegister] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [selectedIdentity, setSelectedIdentity] = useState<AppIdentity>('admin');
  const { login, register, resetPassword, isLoading: authLoading } = useAuth();
  const { t } = useTranslation();

  const identities: { id: AppIdentity; icon: any; label: string }[] = [
    { id: 'admin', icon: Shield, label: t('login.roles.admin') },
    { id: 'supervisor', icon: Users, label: t('login.roles.staff') }
  ];

  if (authLoading) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <Train className="w-12 h-12 text-primary animate-pulse" />
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    console.log('LoginModal: handleLogin started for:', email);

    // Create a timeout to prevent indefinite "Authenticating..." state
    const timeoutPromise = new Promise<{ success: boolean; error: string }>((_, reject) => {
      setTimeout(() => reject(new Error('Login timed out. Please check your connection.')), 10000);
    });

    try {
      const result = await Promise.race([
        login(email, password),
        timeoutPromise
      ]) as { success: boolean; error?: string; isOffline?: boolean };

      console.log('LoginModal: login result:', result);
      if (!result.success) {
        setError(result.error || 'Invalid credentials. Please try again.');
        setIsLoading(false);
      } else {
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error('LoginModal: Login error or timeout:', err);
      setError(err.message || 'An error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent, type: RegisterType) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    // Validate passwords for both admin and user
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setIsLoading(false);
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      setIsLoading(false);
      return;
    }

    const isAdminReg = type === 'admin';

    try {
      if (isAdminReg) {
        // 1. Save to admin_registrations table
        const { error: insertError } = await supabase
          .from('admin_registrations' as any)
          .insert({
            display_name: displayName,
            email: email,
            status: 'approved'
          });

        if (insertError) {
          if (insertError.message?.includes('duplicate')) {
            setError('This email is already registered as admin.');
            setIsLoading(false);
            return;
          }
          console.error('Admin registration error:', insertError);
        }

        // 2. Also create auth account (needed for login)
        const result = await register(email, password, displayName, 'admin');
        if (result.success) {
          // Sign out so it doesn't auto-login
          await supabase.auth.signOut();
          setSuccess('Admin registration successful! You can now login with your credentials.');
          setShowRegister(false);
          setPassword('');
          setConfirmPassword('');
          setDisplayName('');
          setEmail('');
        } else {
          setError(result.error || 'Registration failed. Please try again.');
        }
      } else {
        // User registration: create auth account only
        const result = await register(email, password, displayName);
        if (result.success) {
          await supabase.auth.signOut();
          setSuccess('Registration successful! You can now login with your credentials.');
          setShowRegister(false);
          setPassword('');
          setConfirmPassword('');
          setDisplayName('');
          setEmail('');
        } else {
          setError(result.error || 'Registration failed. Please try again.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    if (!email) {
      setError('Please enter your email address.');
      setIsLoading(false);
      return;
    }

    try {
      const result = await resetPassword(email);
      if (result.success) {
        setSuccess('Password reset link sent! Please check your email.');
      } else {
        setError(result.error || 'Failed to send reset link. Please try again.');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setDisplayName('');
    setConfirmPassword('');
    setError('');
    setSuccess('');
    setShowForgotPassword(false);
  };

  const renderRegisterForm = (type: RegisterType) => {
    const isAdminReg = type === 'admin';
    return (
      <form onSubmit={(e) => handleRegister(e, type)} className="space-y-4">
        <div className="space-y-2">
          <Label className="text-white/80">Display Name</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <Input
              type="text"
              placeholder="Enter your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-white/80">Email Address</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <Input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-white/80">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <Input
              type="password"
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-white/80">Confirm Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <Input
              type="password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30"
              required
            />
          </div>
        </div>
        {isAdminReg && (
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
            <p className="text-xs text-primary">✓ Your email will be saved as an admin. You can login with these credentials after registration.</p>
          </div>
        )}
        {error && <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">{error}</p>}
        {success && <p className="text-sm text-primary bg-primary/10 p-2 rounded-md">{success}</p>}
        <Button
          type="submit"
          className={`w-full text-white ${isAdminReg ? 'bg-primary hover:bg-primary/90' : 'bg-info hover:bg-info/90'}`}
          disabled={isLoading}
        >
          {isLoading ? 'Registering...' : `Register as ${isAdminReg ? 'Admin' : 'User'}`}
        </Button>
      </form>
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center z-50 bg-[#08080a] relative py-8 md:py-16">
      {/* --- MINIMALIST PREMIUM BACKGROUND --- */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Animated Metro Lines */}
        <MetroBackground />
        
        {/* Subtle Grainy Gradient */}
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            background: 'radial-gradient(circle at 50% 10%, #1a1c24 0%, #08080a 100%)'
          }}
        />
        
        {/* Soft Ambient Light */}
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[60%] h-[40%] bg-primary/5 blur-[120px] rounded-full animate-pulse-slow" />
      </div>

      <div className="w-full max-w-5xl relative z-10 px-6 py-12 flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
        
        {/* --- DESCRIPTION SIDE (Simple & Readable) --- */}
        <div className="w-full lg:w-1/2 space-y-8 animate-in fade-in slide-in-from-left-4 duration-700">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
                <Train className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-3xl font-black text-white tracking-widest uppercase">{t('login.title')}</h1>
            </div>
            <h2 className="text-3xl lg:text-5xl font-bold text-white leading-tight">
              {t('login.description.title')}
            </h2>
            <p className="text-base lg:text-lg text-white/40 font-light leading-relaxed max-w-md">
              {t('login.description.p1')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
            {[
              { icon: Activity, key: 'fleet' },
              { icon: Settings, key: 'maintenance' },
              { icon: Cpu, key: 'alerts' },
              { icon: Users, key: 'staff' }
            ].map((feature) => (
              <div key={feature.key} className="flex items-start gap-3 group">
                <feature.icon className="w-5 h-5 text-primary/60 mt-0.5 shrink-0 group-hover:text-primary transition-colors" />
                <span className="text-sm font-medium text-white/60 group-hover:text-white transition-colors">
                  {t(`login.description.features.${feature.key}`)}
                </span>
              </div>
            ))}
          </div>

          <p className="text-sm text-primary/80 font-medium italic border-l-2 border-primary/30 pl-4 py-1">
            "{t('login.description.p2')}"
          </p>
        </div>

        {/* --- LOGIN PORTAL (Impressive Minimalist Card) --- */}
        <div className="w-full lg:w-[420px] animate-in fade-in zoom-in-95 duration-1000 delay-200">
          <Card className="border-white/5 bg-white/[0.03] backdrop-blur-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] overflow-hidden rounded-[32px]">
            <CardHeader className="pt-8 pb-4 px-6 md:px-10">
              <div className="flex items-center gap-2 text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-4 bg-white/5 w-fit px-3 py-1 rounded-full border border-white/5">
                <Shield className="w-3 h-3 shrink-0 text-primary/60" />
                {t('login.securedTerminal')}
              </div>
              <h3 className="text-xl md:text-2xl font-bold text-white">{t('login.systemAccess')}</h3>
              <p className="text-xs md:text-sm text-white/30 font-light">{t('login.authorizedOnly')}</p>
            </CardHeader>

            <CardContent className="p-6 md:p-10 pt-2 md:pt-6">
              {showForgotPassword ? (
                <form onSubmit={handleForgotPassword} className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em] ml-1">{t('login.forgotPassword.emailTerminal')}</Label>
                    <div className="relative group">
                      <Mail className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-white/10 group-focus-within:text-primary transition-colors" />
                      <Input 
                        type="email" 
                        placeholder={t('login.forgotPassword.emailPlaceholder')} 
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)} 
                        className="h-12 pl-8 bg-transparent border-0 border-b border-white/10 text-white placeholder:text-white/15 focus-visible:ring-0 focus-visible:border-primary transition-all rounded-none" 
                        required 
                      />
                    </div>
                  </div>
                  {error && <p className="text-xs text-destructive bg-destructive/5 p-3 rounded-xl border border-destructive/10">{error}</p>}
                  {success && <p className="text-xs text-primary bg-primary/5 p-3 rounded-xl border border-primary/10">{success}</p>}
                  
                  <Button type="submit" className="w-full h-14 rounded-2xl bg-white text-black hover:bg-white/90 font-bold transition-all active:scale-[0.98]" disabled={isLoading}>
                    {isLoading ? t('login.forgotPassword.processing') : t('login.forgotPassword.sendKey')}
                  </Button>
                  
                  <div className="text-center">
                    <button 
                      className="text-white/30 hover:text-white text-xs font-medium transition-colors" 
                      onClick={() => setShowForgotPassword(false)} 
                      type="button"
                    >
                      {t('login.forgotPassword.returnToTerminal')}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleLogin} className="space-y-6">
                  {/* Identity Selector */}
                  <div className="space-y-3">
                    <Label className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em] ml-1">
                      {t('login.roles.selectIdentity')}
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                      {identities.map((identity) => (
                        <button
                          key={identity.id}
                          type="button"
                          onClick={() => setSelectedIdentity(identity.id)}
                          className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-300 gap-2 ${
                            selectedIdentity === identity.id 
                              ? 'bg-primary/10 border-primary/40 text-primary shadow-[0_0_20px_rgba(var(--primary),0.1)] scale-105' 
                              : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10 hover:border-white/10'
                          }`}
                        >
                          <identity.icon className={`w-4 h-4 ${selectedIdentity === identity.id ? 'animate-pulse' : ''}`} />
                          <span className="text-[9px] font-black uppercase tracking-tighter">{identity.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <Label className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em] ml-1">{t('login.operationsId')}</Label>
                    <div className="relative group">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-primary transition-colors" />
                      <Input 
                        type="email" 
                        placeholder={t('login.emailPlaceholder')} 
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)} 
                        className="h-12 pl-10 bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary transition-all rounded-xl" 
                        required 
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between ml-1">
                      <Label className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em]">{t('login.accessProtocol')}</Label>
                      <button 
                        className="text-[10px] font-bold text-primary/60 hover:text-primary transition-colors uppercase tracking-widest" 
                        onClick={() => setShowForgotPassword(true)} 
                        type="button"
                      >
                        {t('login.lostKey')}
                      </button>
                    </div>
                    <div className="relative group">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-primary transition-colors" />
                      <Input 
                        type="password" 
                        placeholder={t('login.passwordPlaceholder')} 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        className="h-12 pl-10 bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary transition-all rounded-xl" 
                        required 
                      />
                    </div>
                  </div>
                  
                  {error && <p className="text-xs text-destructive bg-destructive/5 p-3 rounded-xl border border-destructive/10">{error}</p>}
                  
                  <div className="pt-4">
                    <Button type="submit" className="w-full h-14 rounded-2xl bg-white text-black hover:bg-white/90 font-bold shadow-2xl transition-all active:scale-[0.98] group" disabled={isLoading}>
                      {isLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                          <span className="uppercase tracking-widest text-[10px]">{t('login.authenticating')}</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <span className="uppercase tracking-widest text-[10px]">{t('login.initiateAccess')}</span>
                          <ShieldCheck className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      )}
                    </Button>
                  </div>
                </form>
              )}

              <p className="text-center text-[10px] text-white/10 font-medium uppercase tracking-[0.2em] mt-10">
                &copy; {t('login.footer')}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
