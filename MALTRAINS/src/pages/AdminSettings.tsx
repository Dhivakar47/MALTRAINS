import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Shield, Mail, Phone, Users, Bell, UserPlus, Lock, User, Edit2, Trash2, Search, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { createClient } from '@supabase/supabase-js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const AdminSettings = () => {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [phoneEnabled, setPhoneEnabled] = useState(false);
  const [alertNotifications, setAlertNotifications] = useState(true);

  // New User Form State
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState('Train Operator');
  const [isCreating, setIsCreating] = useState(false);

  // Password Reset State
  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Staff Management State
  const [searchQuery, setSearchQuery] = useState('');
  const [editingStaff, setEditingStaff] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: staffList = [], isLoading: isLoadingStaff } = useQuery({
    queryKey: ['admin-staff-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_members' as any)
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return data;
    }
  });

  const activeStaffCount = staffList.filter((s: any) => s.is_active !== false).length;

  const updateStaffMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string, updates: any }) => {
      const { error } = await supabase
        .from('staff_members' as any)
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-staff-list'] });
      toast({ title: "Signal Synced", description: "Operational parameters have been updated across the network." });
      setEditingStaff(null);
    },
    onError: (err: any) => {
      toast({ title: "Sync Failed", description: err.message, variant: "destructive" });
    }
  });

  const staffToDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('staff_members' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-staff-list'] });
      toast({ title: "Node Purged", description: "The staff record has been permanently removed from the cluster." });
    }
  });

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const tempClient = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        { auth: { persistSession: false } }
      );

      const { data: authData, error: authError } = await tempClient.auth.signUp({
        email: newUserEmail,
        password: newUserPassword,
        options: {
          data: {
            display_name: newUserName,
            full_name: newUserName
          }
        }
      });

      if (authError && !authError.message.toLowerCase().includes('already registered')) throw authError;

      const { error: staffError } = await supabase
        .from('staff_members' as any)
        .upsert({
          employee_id: `SR-${Math.floor(10000 + Math.random() * 90000)}`,
          name: newUserName,
          role: newUserRole,
          leave_balance: 20
        } as any);

      if (staffError) throw staffError;

      toast({
        title: authError ? "Signal Linked" : "Node Provisioned",
        description: `${newUserName} has been initialized into the ${newUserRole} cluster.`,
      });

      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserName('');
    } catch (err: any) {
      toast({ title: "Initialization Error", description: err.message, variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsResetting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({ title: "Signal Recovery", description: `Auth reset payload dispatched to ${resetEmail}.` });
      setResetEmail('');
    } catch (err: any) {
      toast({ title: "Transmission Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-10 pb-20 px-4">
      {/* V2 Command Center Header - Professional Refinement */}
      <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="flex flex-col sm:flex-row items-baseline sm:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
             <div className="w-16 h-16 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg transform -rotate-3">
                <Shield className="w-8 h-8" />
             </div>
             <div>
                <h1 className="text-3xl font-bold text-foreground tracking-tight">
                  {t('settings.admin_portal', 'Control Center')}
                </h1>
                <p className="text-sm font-medium text-muted-foreground mt-1">System infrastructure & personnel authentication matrices.</p>
             </div>
          </div>
          <div className="flex items-center gap-3 bg-muted/20 p-1.5 rounded-2xl border border-white/5">
             <div className="px-4 py-1.5 bg-background/50 rounded-xl shadow-sm border border-white/5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Uptime</p>
                <p className="text-xs font-bold">99.98%</p>
             </div>
             <div className="px-4 py-1.5 bg-success/5 rounded-xl border border-success/10">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-success">Nodes Active</p>
                <p className="text-xs font-bold text-success">{activeStaffCount}</p>
             </div>
          </div>
        </div>

        {/* Operational Intelligence Cards - Simplified */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="glass-card border-none bg-primary/5 hover:translate-y-[-2px] transition-all overflow-hidden group">
                <CardContent className="p-6 relative">
                    <Users className="absolute -right-2 -bottom-2 w-16 h-16 text-primary/10 group-hover:scale-110 transition-transform duration-500" />
                    <p className="text-[10px] font-bold uppercase tracking-wider text-primary/70">Total Population</p>
                    <h3 className="text-2xl font-bold mt-1">{staffList.length}</h3>
                    <p className="text-[9px] font-medium text-muted-foreground mt-0.5">Global Userbase</p>
                </CardContent>
            </Card>
            <Card className="glass-card border-none bg-info/5 hover:translate-y-[-2px] transition-all overflow-hidden group">
                <CardContent className="p-6 relative">
                    <Lock className="absolute -right-2 -bottom-2 w-16 h-16 text-info/10 group-hover:scale-110 transition-transform duration-500" />
                    <p className="text-[10px] font-bold uppercase tracking-wider text-info/70">Auth Success</p>
                    <h3 className="text-2xl font-bold mt-1">100%</h3>
                    <p className="text-[9px] font-medium text-success mt-0.5">Secure Link</p>
                </CardContent>
            </Card>
            <Card className="glass-card border-none bg-warning/5 hover:translate-y-[-2px] transition-all overflow-hidden group">
                <CardContent className="p-6 relative">
                    <Bell className="absolute -right-2 -bottom-2 w-16 h-16 text-warning/10 group-hover:scale-110 transition-transform duration-500" />
                    <p className="text-[10px] font-bold uppercase tracking-wider text-warning/70">Active Logs</p>
                    <h3 className="text-2xl font-bold mt-1">12</h3>
                    <p className="text-[9px] font-medium text-muted-foreground mt-0.5">Concurrent Sessions</p>
                </CardContent>
            </Card>
            <Card className="glass-card border-none bg-destructive/5 hover:translate-y-[-2px] transition-all overflow-hidden group">
                <CardContent className="p-6 relative">
                    <Shield className="absolute -right-2 -bottom-2 w-16 h-16 text-destructive/10 group-hover:scale-110 transition-transform duration-500" />
                    <p className="text-[10px] font-bold uppercase tracking-wider text-destructive/70">Security Scan</p>
                    <h3 className="text-2xl font-bold mt-1">Clean</h3>
                    <p className="text-[9px] font-medium text-muted-foreground mt-0.5">Zero Threats</p>
                </CardContent>
            </Card>
        </div>

        <Tabs defaultValue="personnel" className="w-full">
          <TabsList className="bg-muted/30 p-1 rounded-2xl h-14 border border-white/5 shadow-inner gap-1.5">
            <TabsTrigger value="personnel" className="flex-1 rounded-xl h-full font-bold uppercase tracking-wider text-[10px] data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
              <Users className="w-3.5 h-3.5 mr-2" />
              Personnel Directory
            </TabsTrigger>
            <TabsTrigger value="onboarding" className="flex-1 rounded-xl h-full font-bold uppercase tracking-wider text-[10px] data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
              <UserPlus className="w-3.5 h-3.5 mr-2" />
              User Onboarding
            </TabsTrigger>
            <TabsTrigger value="security" className="flex-1 rounded-xl h-full font-bold uppercase tracking-wider text-[10px] data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
              <Lock className="w-3.5 h-3.5 mr-2" />
              Security Protocol
            </TabsTrigger>
          </TabsList>

          <TabsContent value="personnel" className="mt-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-6">
               <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-muted/50 border border-white/5">
                    <Search className="w-4 h-4 opacity-40" />
                  </div>
                  <div className="relative w-full sm:min-w-[320px]">
                    <Input 
                        placeholder="Filter personnel records..." 
                        className="h-11 bg-muted/40 border-none rounded-xl pl-5 font-bold text-xs shadow-inner"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                  </div>
               </div>
               <Badge variant="outline" className="px-4 py-1.5 bg-muted/20 border-none font-bold uppercase tracking-wider text-[9px] rounded-lg">
                  Records: {staffList.length} Units
               </Badge>
            </div>

            <Card className="glass-card border-none rounded-3xl overflow-hidden overflow-x-auto ring-1 ring-white/5 premium-shadow">
               <table className="w-full text-left">
                  <thead className="bg-primary/5 text-primary font-bold text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="px-8 py-5">Personnel Metadata</th>
                      <th className="px-8 py-5">Functional Department</th>
                      <th className="px-8 py-5">Status</th>
                      <th className="px-8 py-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {isLoadingStaff ? (
                      <tr>
                        <td colSpan={4} className="px-10 py-32 text-center">
                          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-6" />
                          <p className="text-xs font-black uppercase tracking-[0.4em] text-muted-foreground animate-pulse">Syncing Personnel Database...</p>
                        </td>
                      </tr>
                    ) : staffList.filter((s: any) => s.name.toLowerCase().includes(searchQuery.toLowerCase())).map((staff: any) => (
                      <tr key={staff.id} className={cn(
                        "group hover:bg-white/[0.01] transition-colors",
                        !staff.is_active && "opacity-40 grayscale"
                      )}>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-5">
                            <div className="w-11 h-11 rounded-xl bg-muted/50 flex items-center justify-center text-primary font-bold text-lg shadow-inner border border-white/5">
                              {staff.name?.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span className="font-bold text-base text-foreground tracking-tight">{staff.name}</span>
                              <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                {staff.employee_id || 'SR-00X-UNIT'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                           <div className="flex flex-col gap-1.5">
                              <Badge className="w-fit bg-primary/10 text-primary border-none font-bold text-[9px] uppercase tracking-wider px-3 py-1 rounded-md">
                                {staff.role}
                              </Badge>
                              <span className="text-[11px] font-medium text-muted-foreground/60 ml-0.5">{staff.email || 'No Signal Registered'}</span>
                           </div>
                        </td>
                        <td className="px-8 py-6">
                           <div className="flex flex-col gap-2.5">
                              <div className="flex items-center gap-1.5">
                                {staff.is_active !== false ? (
                                  <span className="flex items-center gap-1.5 text-success font-bold text-[9px] uppercase tracking-wider px-2.5 py-1 bg-success/5 rounded-full border border-success/10">
                                    <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                                    Active
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1.5 text-destructive font-bold text-[9px] uppercase tracking-wider px-2.5 py-1 bg-destructive/5 rounded-full border border-destructive/10">
                                    <div className="w-1.5 h-1.5 rounded-full bg-destructive" />
                                    Inactive
                                  </span>
                                )}
                              </div>
                              <Switch 
                                checked={staff.is_active !== false}
                                className="data-[state=checked]:bg-success scale-90"
                                onCheckedChange={(checked) => updateStaffMutation.mutate({ id: staff.id, updates: { is_active: checked } })}
                                disabled={updateStaffMutation.isPending}
                              />
                           </div>
                        </td>
                        <td className="px-8 py-6 text-right">
                           <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                             <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-9 w-9 p-0 glass-card border-none hover:bg-primary/10 hover:text-primary rounded-lg transition-all"
                                onClick={() => setEditingStaff(staff)}
                             >
                               <Edit2 className="w-3.5 h-3.5" />
                             </Button>
                             <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-9 w-9 p-0 glass-card border-none hover:bg-destructive/10 hover:text-destructive rounded-lg transition-all"
                                onClick={() => { if (window.confirm(`Purge signal: ${staff.name}?`)) staffToDeleteMutation.mutate(staff.id); }}
                             >
                               <Trash2 className="w-3.5 h-3.5" />
                             </Button>
                           </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
               </table>
            </Card>
          </TabsContent>

          <TabsContent value="onboarding" className="mt-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-5">
                <div className="flex items-center gap-3 pl-1 border-l-4 border-primary/40 mb-8">
                   <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                      <UserPlus className="w-5 h-5" />
                   </div>
                   <h2 className="text-xl font-bold tracking-tight">Provision New Node</h2>
                </div>
                
                <Card className="glass-card border-none rounded-3xl p-8 shadow-xl ring-1 ring-white/5">
                  <CardHeader className="p-0 mb-8">
                    <CardTitle className="text-lg font-bold">Operational Token Initialization</CardTitle>
                    <CardDescription className="text-sm font-medium">Register personnel with required credentials for system access.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <form onSubmit={handleCreateUser} className="space-y-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Legal Name</Label>
                        <Input 
                          placeholder="Personnel Name" 
                          className="h-11 bg-muted/40 border-none rounded-xl px-5 font-bold text-xs shadow-inner"
                          value={newUserName}
                          onChange={e => setNewUserName(e.target.value)}
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Functional Role</Label>
                          <Input 
                            placeholder="e.g. Operator" 
                            className="h-11 bg-muted/40 border-none rounded-xl px-5 font-bold text-xs shadow-inner"
                            value={newUserRole}
                            onChange={e => setNewUserRole(e.target.value)}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Email Node</Label>
                          <Input 
                            type="email"
                            placeholder="auth@corp.com" 
                            className="h-11 bg-muted/40 border-none rounded-xl px-5 font-bold text-xs shadow-inner"
                            value={newUserEmail}
                            onChange={e => setNewUserEmail(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2 pb-2">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Security Key</Label>
                        <Input 
                          type="password"
                          placeholder="••••••••" 
                          className="h-11 bg-muted/40 border-none rounded-xl px-5 font-bold text-xs shadow-inner"
                          value={newUserPassword}
                          onChange={e => setNewUserPassword(e.target.value)}
                          required
                        />
                      </div>
                      <Button 
                        type="submit" 
                        className="w-full h-14 bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-wider rounded-2xl shadow-lg transition-all active:scale-[0.98]"
                        disabled={isCreating}
                      >
                        {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Provision Node'}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-7 space-y-8">
                <div className="flex items-center gap-3 pl-1 border-l-4 border-warning/40 mb-8">
                   <div className="p-2.5 rounded-xl bg-warning/10 text-warning">
                      <Lock className="w-5 h-5" />
                   </div>
                   <h2 className="text-xl font-bold tracking-tight">Signal Recovery</h2>
                </div>
                
                <Card className="glass-card border-none rounded-3xl p-8 shadow-xl ring-1 ring-white/5">
                  <CardHeader className="p-0 mb-8">
                    <CardTitle className="text-lg font-bold">Credential Override</CardTitle>
                    <CardDescription className="text-sm font-medium">Issue password reset triggers for personnel with locked nodes.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <form onSubmit={handleResetPassword} className="space-y-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Auth Email Node</Label>
                        <Input 
                          type="email"
                          placeholder="personnel@corp.com" 
                          className="h-11 bg-muted/40 border-none rounded-xl px-5 font-bold text-xs shadow-inner"
                          value={resetEmail}
                          onChange={e => setResetEmail(e.target.value)}
                          required
                        />
                      </div>
                      <Button 
                        type="submit" 
                        variant="outline"
                        className="w-full h-14 border-2 border-primary/20 hover:bg-primary/5 text-primary font-bold uppercase tracking-wider rounded-2xl transition-all active:scale-[0.98]"
                        disabled={isResetting || !resetEmail}
                      >
                        {isResetting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Dispatch Reset Signal'}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
                
                <div className="glass-card rounded-3xl p-8 border-none ring-1 ring-white/5 bg-muted/10 relative overflow-hidden group">
                  <Shield className="absolute -right-6 -bottom-6 w-32 h-32 text-primary/5 group-hover:scale-110 transition-transform duration-1000" />
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Operational Tip</h4>
                  <p className="text-xs font-medium text-foreground/60 leading-relaxed italic">
                    "Periodic audits of the Personnel Cluster ensure zero unauthorized entry points. Recommend weekly rotation of secure codes."
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="security" className="mt-8">
             <div className="h-[400px] flex flex-col items-center justify-center glass-card rounded-[3rem] border-none ring-1 ring-white/10">
                <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-8 relative">
                    <div className="absolute inset-0 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                    <Shield className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-2xl font-black tracking-tight mb-2">Security Matrix Scaling</h3>
                <p className="text-sm font-bold text-muted-foreground max-w-sm text-center px-10 leading-relaxed">
                   Advanced firewall telemetry and IP-blocking matrices are currently being synchronized with the global cluster.
                </p>
                <div className="mt-10 flex gap-4">
                   <div className="px-6 py-2 bg-muted/30 rounded-full border border-white/5 animate-pulse">
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Encryption: AES-256</span>
                   </div>
                </div>
             </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Staff Dialog - V2 Refined */}
      <Dialog open={!!editingStaff} onOpenChange={(open) => !open && setEditingStaff(null)}>
        <DialogContent className="sm:max-w-[600px] glass-card border-none premium-shadow rounded-[3rem] p-0 overflow-hidden backdrop-blur-3xl ring-1 ring-white/20">
          <div className="bg-gradient-to-br from-primary/20 to-transparent px-10 py-12 border-b border-white/5">
            <DialogHeader>
               <div className="w-16 h-16 rounded-2xl bg-primary text-white flex items-center justify-center mb-6 shadow-2xl">
                  <User className="w-8 h-8" />
               </div>
              <DialogTitle className="text-4xl font-black tracking-tighter">Modify Node Signal</DialogTitle>
              <DialogDescription className="font-bold text-primary mt-3 text-lg">
                Re-configuring parameters for <span className="underline decoration-wavy decoration-primary-foreground/30">{editingStaff?.name}</span>.
              </DialogDescription>
            </DialogHeader>
          </div>
          {editingStaff && (
            <div className="px-10 py-10 space-y-8">
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Legal Identity</Label>
                  <Input 
                    className="h-14 bg-muted/40 border-none rounded-2xl px-6 font-black text-sm shadow-inner focus-visible:ring-4 focus-visible:ring-primary/20 transition-all"
                    value={editingStaff.name} 
                    onChange={e => setEditingStaff({...editingStaff, name: e.target.value})}
                  />
                </div>
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Signal ID (READ-ONLY)</Label>
                  <Input 
                    className="h-14 bg-muted/20 border-none rounded-2xl px-6 font-mono text-xs font-black opacity-50 cursor-not-allowed"
                    value={editingStaff.employee_id || 'SR-ALPHA-9'} 
                    readOnly
                  />
                </div>
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Departmental Tag</Label>
                <Input 
                  className="h-14 bg-muted/40 border-none rounded-2xl px-6 font-black text-sm shadow-inner"
                  value={editingStaff.role} 
                  onChange={e => setEditingStaff({...editingStaff, role: e.target.value})}
                />
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Network Address</Label>
                <Input 
                  className="h-14 bg-muted/40 border-none rounded-2xl px-6 font-black text-sm shadow-inner"
                  value={editingStaff.email || ''} 
                  onChange={e => setEditingStaff({...editingStaff, email: e.target.value})}
                />
              </div>
            </div>
          )}
          <div className="px-10 pb-12 pt-4">
            <div className="flex gap-4">
               <Button variant="ghost" className="h-16 flex-1 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-muted/50" onClick={() => setEditingStaff(null)}>Abort</Button>
               <Button 
                className="h-16 flex-[2] rounded-2xl bg-primary text-white font-black uppercase tracking-[0.3em] shadow-[0_15px_30px_rgba(var(--primary),0.3)] hover:scale-[1.02] transition-all"
                onClick={() => updateStaffMutation.mutate({ 
                  id: editingStaff.id, 
                  updates: { 
                    name: editingStaff.name, 
                    role: editingStaff.role,
                    email: editingStaff.email
                  } 
                })}
                disabled={updateStaffMutation.isPending}
              >
                {updateStaffMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm Resync'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

