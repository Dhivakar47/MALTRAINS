import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Activity, Save, Plus, Shield, MapPin, Signal } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const DataEntry = () => {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const [formData, setFormData] = useState({
    rakeId: '',
    status: '',
    notes: '',
  });

  const queryClient = useQueryClient();

  const { data: rakeDetails, isLoading: isLoadingRake } = useQuery({
    queryKey: ['rake-details', formData.rakeId],
    queryFn: async () => {
      if (!formData.rakeId) return null;
      const { data, error } = await supabase
        .from('trainsets')
        .select('*')
        .eq('rake_id', formData.rakeId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!formData.rakeId,
  });

  const updateTrainsetMutation = useMutation({
    mutationFn: async () => {
      const updates: any = {};
      if (formData.status) {
        let mapStatus = formData.status;
        if (mapStatus === 'running') mapStatus = 'service_ready';
        if (mapStatus === 'readyToRun') {
          mapStatus = 'service_ready';
          updates.total_mileage_km = 0;
        }
        // Ensure explicit mapping for other states to avoid confusion
        if (mapStatus === 'maintenance') mapStatus = 'maintenance';
        if (mapStatus === 'cleaning') mapStatus = 'standby'; 
        if (mapStatus === 'stopped') mapStatus = 'standby';
        updates.current_status = mapStatus;
      }

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from('trainsets')
          .update(updates)
          .eq('rake_id', formData.rakeId);

        if (error) throw error;
        
        // Alert logic based on simulated GPS distance
        if (rakeDetails && rakeDetails.total_mileage_km >= 5000) {
           await supabase.from('alerts').insert({
             title: `Maintenance Required: ${formData.rakeId}`,
             message: `Train ${formData.rakeId} has reached ${rakeDetails.total_mileage_km}km. Schedule inspection immediately.`,
             severity: 'high',
             alert_type: 'maintenance',
             is_resolved: false
           });
           toast({ title: 'Alert Triggered', description: 'Maintenance alert sent to Admin & User.' });
        }
      }
    },
    onSuccess: () => {
      toast({
        title: t('dataEntry.saveEntry'),
        description: `Data for ${formData.rakeId} has been successfully synchronized.`,
      });
      setFormData({ rakeId: '', status: '', notes: '' });
      queryClient.invalidateQueries({ queryKey: ['trainsets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Error',
        description: err.message || 'Failed to record entry',
        variant: 'destructive'
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.rakeId) {
      toast({ title: 'Error', description: 'Please select a Rake ID.', variant: 'destructive' });
      return;
    }
    updateTrainsetMutation.mutate();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-black text-foreground tracking-tight">{t('dataEntry.title')}</h1>
        <p className="text-muted-foreground font-medium">{t('dataEntry.subtitle')}</p>
      </div>

      {!isAdmin ? (
        <Card className="glass-card premium-shadow border-none overflow-hidden">
          <CardContent className="p-16 text-center">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
              <Shield className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-2xl font-black text-foreground mb-3 tracking-tight">Access Restricted</h3>
            <p className="text-muted-foreground max-w-sm mx-auto leading-relaxed">{t('dataEntry.onlyAdmin')}</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="glass-card premium-shadow border-none overflow-hidden">
          <CardHeader className="pb-8 border-b border-border/50">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shadow-inner">
                <Activity className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl font-black tracking-tight">{t('dataEntry.newEntry')}</CardTitle>
                <CardDescription className="font-medium">{t('dataEntry.entryDescription')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-10">
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <Label htmlFor="rakeId" className="text-xs font-black uppercase tracking-widest text-muted-foreground">{t('dataEntry.rakeId')}</Label>
                  <Select
                    value={formData.rakeId}
                    onValueChange={(value) => setFormData({ ...formData, rakeId: value })}
                  >
                    <SelectTrigger className="h-12 bg-muted/30 border-none rounded-xl focus:ring-2 focus:ring-primary/50 transition-all font-bold">
                      <SelectValue placeholder={t('dataEntry.rakeId')} />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border/50 rounded-xl shadow-2xl">
                      {Array.from({ length: 15 }, (_, i) => (
                        <SelectItem key={i} value={`Rake-${(i + 1).toString().padStart(2, '0')}`} className="font-bold py-3 hover:bg-primary/10 transition-colors">
                          Rake-{(i + 1).toString().padStart(2, '0')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col justify-end">
                    {formData.rakeId && rakeDetails && (
                        <div className="bg-success/5 p-4 rounded-xl border border-success/20 flex items-center justify-between shadow-inner">
                            <div className="flex items-center gap-3">
                                <div className="relative flex h-3 w-3">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-success"></span>
                                </div>
                                <span className="text-xs font-black uppercase tracking-widest text-success/80">{t('dataEntry.gpsLinked')}</span>
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest bg-success/10 text-success px-2 py-0.5 rounded">Active</span>
                        </div>
                    )}
                </div>
              </div>

              {formData.rakeId && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-4 duration-700">
                      <div className="bg-muted/30 border border-border/50 rounded-2xl p-6 shadow-inner flex items-center gap-5 group hover:bg-muted/50 transition-all">
                          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                              <Activity className="w-7 h-7 text-primary" />
                          </div>
                          <div>
                              <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.2em] mb-1">{t('dataEntry.currentStatus')}</p>
                              <p className="text-xl font-black tracking-tight capitalize text-foreground">
                                {isLoadingRake ? '...' : (
                                  rakeDetails?.total_mileage_km >= 5000 ? (
                                    <span className="text-destructive underline decoration-wavy decoration-destructive/30 underline-offset-8">{t('dataEntry.maintenance')}</span>
                                  ) : (
                                    rakeDetails?.current_status === 'service_ready' ? t('dataEntry.running') : 
                                    rakeDetails?.current_status === 'maintenance' ? t('dataEntry.maintenance') : 
                                    rakeDetails?.current_status === 'standby' ? t('dataEntry.stopped') :
                                    rakeDetails?.current_status?.replace('_', ' ') || t('dataEntry.stopped')
                                  )
                                )}
                              </p>
                          </div>
                      </div>

                      <div className="bg-muted/30 border border-border/50 rounded-2xl p-6 shadow-inner flex items-center gap-5 group hover:bg-muted/50 transition-all">
                          <div className="w-14 h-14 rounded-2xl bg-success/10 flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                              <MapPin className="w-7 h-7 text-success" />
                          </div>
                          <div>
                              <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.2em] mb-1">{t('dataEntry.mileage')}</p>
                              <p className="text-xl font-black tracking-tight text-foreground">
                                  {isLoadingRake ? '...' : `${Number(rakeDetails?.total_mileage_km || 0).toLocaleString()} km`}
                              </p>
                          </div>
                      </div>
                  </div>
              )}

              <div className="space-y-3">
                <Label htmlFor="status" className="text-xs font-black uppercase tracking-widest text-muted-foreground">{t('dataEntry.currentStatus')}</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger className="h-12 bg-muted/30 border-none rounded-xl focus:ring-2 focus:ring-primary/50 transition-all font-bold">
                    <SelectValue placeholder={t('dataEntry.selectStatus')} />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border/50 rounded-xl shadow-2xl">
                    <SelectItem value="running" className="font-bold py-3">{t('dataEntry.running')}</SelectItem>
                    <SelectItem value="maintenance" className="font-bold py-3">{t('dataEntry.maintenance')}</SelectItem>
                    <SelectItem value="cleaning" className="font-bold py-3">{t('dataEntry.cleaning')}</SelectItem>
                    <SelectItem value="stopped" className="font-bold py-3">{t('dataEntry.stopped')}</SelectItem>
                    <SelectItem value="readyToRun" className="text-success font-black py-3 uppercase tracking-wider">{t('dataEntry.readyToRun')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label htmlFor="notes" className="text-xs font-black uppercase tracking-widest text-muted-foreground">{t('dataEntry.notes')}</Label>
                <Textarea
                  id="notes"
                  placeholder={t('dataEntry.notesPlaceholder')}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="bg-muted/30 border-none rounded-2xl focus:ring-2 focus:ring-primary/50 transition-all font-medium min-h-[140px] p-6 focus-visible:ring-offset-0"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <Button 
                  type="submit" 
                  disabled={updateTrainsetMutation.isPending || !formData.rakeId} 
                  className="flex-1 h-14 gap-3 bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest shadow-[0_10px_20px_rgba(var(--primary),0.2)] hover:shadow-[0_15px_30px_rgba(var(--primary),0.3)] transition-all rounded-2xl group active:scale-95"
                >
                  <Save className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                  {updateTrainsetMutation.isPending ? t('common.save') : t('dataEntry.saveEntry')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
