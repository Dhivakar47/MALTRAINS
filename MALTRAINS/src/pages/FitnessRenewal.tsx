import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon, MapPin, UserCheck, Briefcase, Hash, History, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { getKeralaTrainDetails } from '@/lib/keralaTrains';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export const FitnessRenewal = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedRakeId, setSelectedRakeId] = useState<string>('');
  const [formData, setFormData] = useState({
    renewalId: '',
    location: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    approverName: '',
    approverPosting: ''
  });

  // Fetch Trainsets
  const { data: trainsets = [], isLoading: isLoadingTrains } = useQuery({
    queryKey: ['trainsets-for-renewal'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trainsets')
        .select(`
          *,
          fitness_certificates (expiry_date, issue_date, issuing_authority)
        `)
        .order('rake_id');
      
      if (error) throw error;
      return data;
    }
  });

  const selectedRake = trainsets.find((t: any) => t.id === selectedRakeId);
  const currentCert = selectedRake?.fitness_certificates?.[0];
  
  const daysRemaining = currentCert?.expiry_date 
    ? Math.floor((new Date(currentCert.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : -1;

  const isExpired = daysRemaining < 0;
  const canRenew = isExpired;

  const renewMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRakeId) throw new Error("Please select a rake");
      
      const issueDate = new Date(formData.date);
      const expiryDate = addDays(issueDate, 180);
      
      // Store all details in issuing_authority for now to ensure DB compatibility
      const authorityData = `Appr: ${formData.approverName} (${formData.approverPosting}) | Loc: ${formData.location} | ID: ${formData.renewalId}`;
      
      const { error: certError } = await supabase
        .from('fitness_certificates')
        .upsert({
          trainset_id: selectedRakeId,
          certificate_type: 'rolling_stock',
          issue_date: issueDate.toISOString(),
          expiry_date: expiryDate.toISOString(),
          issuing_authority: authorityData
        }, { onConflict: 'trainset_id, certificate_type' });

      if (certError) throw certError;

      // Reset mileage
      const { error: trainError } = await supabase
        .from('trainsets')
        .update({ total_mileage_km: 0, current_status: 'standby' })
        .eq('id', selectedRakeId);

      if (trainError) throw trainError;
    },
    onSuccess: () => {
      toast({ 
        title: "Certificate Renewed", 
        description: `Fitness certificate for ${selectedRake?.rake_id} has been successfully updated.`
      });
      queryClient.invalidateQueries({ queryKey: ['trainsets-for-renewal'] });
      queryClient.invalidateQueries({ queryKey: ['trainsets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      
      // Reset form
      setSelectedRakeId('');
      setFormData({
        renewalId: '',
        location: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        approverName: '',
        approverPosting: ''
      });
    },
    onError: (err: any) => {
      toast({ 
        title: "Renewal Failed", 
        description: err.message, 
        variant: "destructive" 
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canRenew) {
      toast({
        title: "Cannot Renew",
        description: "This train already has a valid certificate.",
        variant: "destructive"
      });
      return;
    }
    renewMutation.mutate();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-20">
      <div className="flex flex-col sm:flex-row items-baseline sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-foreground tracking-tight flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-primary" />
            Rolling Stock Fitness
          </h1>
          <p className="text-muted-foreground font-medium mt-1">Certification management and fleet validity protocols.</p>
        </div>
        <Badge variant="outline" className="glass-card border-primary/20 bg-primary/5 px-4 py-2 gap-2 h-auto text-[10px] font-black uppercase tracking-widest text-primary">
          <History className="w-3.5 h-3.5" />
          180 Days Standard Validity
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left Column: Form */}
        <div className="lg:col-span-8 space-y-8">
          
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 text-primary shadow-sm">
              <Hash className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-black tracking-tight">Renewal Protocol</h2>
          </div>

          <Card className="glass-card premium-shadow border-none overflow-hidden">
            <CardHeader className="pb-6 border-b border-border/50 bg-primary/5">
              <CardTitle className="text-sm font-black uppercase tracking-[0.2em] text-primary/80">Official Form 12-A</CardTitle>
              <CardDescription className="text-xs font-medium">Provision of new fitness certificate for active rolling stock.</CardDescription>
            </CardHeader>
            <CardContent className="pt-8">
              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Target Rake / Trainset</Label>
                    <Select value={selectedRakeId} onValueChange={setSelectedRakeId}>
                      <SelectTrigger className="h-12 bg-muted/30 border-none rounded-xl font-bold focus:ring-2 focus:ring-primary/30 transition-all">
                        <SelectValue placeholder="Chose target for renewal..." />
                      </SelectTrigger>
                      <SelectContent className="glass-card border-border/50 rounded-xl shadow-2xl">
                        {trainsets.map((rake: any) => (
                          <SelectItem key={rake.id} value={rake.id} className="font-bold py-3 hover:bg-primary/10 transition-colors">
                            {rake.rake_id} — {rake.train_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Certificate Serial No.</Label>
                    <div className="relative">
                      <Hash className="absolute left-4 top-3.5 w-4 h-4 text-muted-foreground" />
                      <Input 
                        placeholder="e.g. SEC-2026-004" 
                        className="h-12 bg-muted/30 border-none rounded-xl pl-12 font-bold focus-visible:ring-2 focus-visible:ring-primary/30 transition-all"
                        value={formData.renewalId}
                        onChange={e => setFormData({...formData, renewalId: e.target.value})}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Issuance Date</Label>
                    <div className="relative">
                      <CalendarIcon className="absolute left-4 top-3.5 w-4 h-4 text-muted-foreground" />
                      <Input 
                        type="date" 
                        className="h-12 bg-muted/30 border-none rounded-xl pl-12 font-bold focus-visible:ring-2 focus-visible:ring-primary/30 transition-all"
                        value={formData.date}
                        onChange={e => setFormData({...formData, date: e.target.value})}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Issuance Location</Label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-3.5 w-4 h-4 text-muted-foreground" />
                      <Input 
                        placeholder="e.g. Aluva Depot" 
                        className="h-12 bg-muted/30 border-none rounded-xl pl-12 font-bold focus-visible:ring-2 focus-visible:ring-primary/30 transition-all"
                        value={formData.location}
                        onChange={e => setFormData({...formData, location: e.target.value})}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-border/30">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Approving Officer</Label>
                      <div className="relative">
                        <UserCheck className="absolute left-4 top-3.5 w-4 h-4 text-muted-foreground" />
                        <Input 
                          placeholder="Name of Authority" 
                          className="h-12 bg-muted/30 border-none rounded-xl pl-12 font-bold focus-visible:ring-2 focus-visible:ring-primary/30 transition-all"
                          value={formData.approverName}
                          onChange={e => setFormData({...formData, approverName: e.target.value})}
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Officer Designation</Label>
                      <div className="relative">
                        <Briefcase className="absolute left-4 top-3.5 w-4 h-4 text-muted-foreground" />
                        <Input 
                          placeholder="Role / Posting" 
                          className="h-12 bg-muted/30 border-none rounded-xl pl-12 font-bold focus-visible:ring-2 focus-visible:ring-primary/30 transition-all"
                          value={formData.approverPosting}
                          onChange={e => setFormData({...formData, approverPosting: e.target.value})}
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-16 bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-[0.2em] rounded-2xl shadow-[0_10px_25px_rgba(var(--primary),0.2)] hover:shadow-[0_15px_35px_rgba(var(--primary),0.3)] transition-all active:scale-[0.98] group"
                  disabled={renewMutation.isPending || !selectedRakeId || !canRenew}
                >
                  {renewMutation.isPending ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                      Authenticating...
                    </>
                  ) : (
                    <>
                      Verify & Commit Renewal
                      <CheckCircle2 className="w-5 h-5 ml-3 group-hover:scale-110 transition-transform" />
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Status Card */}
        <div className="lg:col-span-4 space-y-8">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-muted text-foreground/60 shadow-sm border border-border/50">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-black tracking-tight">Audit Status</h2>
          </div>

          {!selectedRakeId ? (
            <Card className="glass-card border-none overflow-hidden h-[400px]">
              <CardContent className="flex flex-col items-center justify-center h-full text-center p-10 opacity-40">
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
                   <ShieldCheck className="w-10 h-10" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest">Awaiting Selection</h3>
                <p className="text-xs font-medium mt-2 leading-relaxed">Please select a rake from the fleet list to begin the fitness audit.</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="glass-card premium-shadow border-none overflow-hidden hover:scale-[1.02] transition-transform duration-500">
               <div className={cn(
                 "h-2 w-full",
                 isExpired ? "bg-destructive shadow-[0_5px_15px_rgba(var(--destructive),0.4)]" : "bg-success shadow-[0_5px_15px_rgba(var(--success),0.4)]"
               )} />
               
               <CardContent className="p-8 space-y-8">
                 <div className="space-y-1">
                   <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Active Rake Identifier</p>
                   <h3 className="text-3xl font-black tracking-tighter text-foreground">{selectedRake.rake_id}</h3>
                   <p className="text-sm font-bold text-primary">{getKeralaTrainDetails(selectedRake.rake_id).name}</p>
                 </div>

                 <div className={cn(
                   "p-6 rounded-3xl space-y-4 border transition-colors",
                   isExpired ? "bg-destructive/[0.03] border-destructive/20" : "bg-success/[0.03] border-success/20"
                 )}>
                   <div className="flex items-center gap-4">
                     {isExpired ? (
                       <div className="p-3 rounded-2xl bg-destructive text-white shadow-lg">
                          <AlertCircle className="w-6 h-6" />
                       </div>
                     ) : (
                       <div className="p-3 rounded-2xl bg-success text-white shadow-lg">
                          <CheckCircle2 className="w-6 h-6" />
                       </div>
                     )}
                     <div>
                       <p className={cn(
                         "text-xs font-black uppercase tracking-widest",
                         isExpired ? "text-destructive" : "text-success"
                       )}>
                         {isExpired ? "Status: Grounded" : "Status: Operational"}
                       </p>
                       <h4 className="text-lg font-black tracking-tight leading-none mt-1">
                         {isExpired ? "Renewal Mandatory" : "Certificate Valid"}
                       </h4>
                     </div>
                   </div>

                   <div className="pt-4 border-t border-border/20">
                     <div className="flex justify-between items-baseline">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Clock-out Days</span>
                        <span className={cn(
                          "text-2xl font-black tracking-tighter font-mono",
                          isExpired ? "text-destructive" : "text-primary"
                        )}>
                          {isExpired ? "EXPIRED" : `${daysRemaining} Days`}
                        </span>
                     </div>
                   </div>
                 </div>

                 {!canRenew && (
                    <div className="bg-warning/10 border border-warning/20 p-4 rounded-2xl flex gap-3 items-start animate-in fade-in slide-in-from-bottom-2">
                       <ShieldCheck className="w-5 h-5 text-warning shrink-0" />
                       <p className="text-[11px] font-medium text-warning-foreground leading-relaxed italic">
                        "This rake currently possesses a valid fitness certificate. Mandatory protocol prohibits early renewal until expiry threshold is reached."
                       </p>
                    </div>
                 )}

                 {currentCert && (
                    <div className="space-y-4 pt-4 border-t border-border/50">
                       <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Last Authorized Audit</p>
                       <div className="glass-card bg-muted/20 p-5 rounded-2xl space-y-3">
                          <div className="flex items-start gap-3">
                             <History className="w-4 h-4 text-muted-foreground/60 shrink-0 mt-0.5" />
                             <p className="text-xs font-bold leading-relaxed text-foreground/80">{currentCert.issuing_authority || "Authority Profile N/A"}</p>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                             <div className="flex items-center gap-1.5">
                                <CalendarIcon className="w-3 h-3" />
                                {format(new Date(currentCert.issue_date), 'MMM dd, yyyy')}
                             </div>
                             <div className="w-1 h-1 rounded-full bg-border" />
                             <span>Archived Record</span>
                          </div>
                       </div>
                    </div>
                 )}
               </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
