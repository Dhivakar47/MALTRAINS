import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Train, Wrench, AlertTriangle, Users, Activity, ShieldCheck, PieChart, BarChart3 } from 'lucide-react';
import { KPICard } from '@/components/KPICard';
import { RakeCard } from '@/components/RakeCard';
import { TrainHealthCard } from '@/components/TrainHealthCard';
import { TrainMap, LiveTrainCard, TrainData } from '@/components/TrainMap';
import { AnalyticsCharts } from '@/components/AnalyticsCharts';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { getKeralaTrainDetails } from '@/lib/keralaTrains';
import { cn } from '@/lib/utils';

export const Dashboard = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { t } = useTranslation();
  const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'error'>('connected');
  const [filter, setFilter] = useState<'all' | 'running' | 'maintenance'>('all');
  const [activeTab, setActiveTab] = useState<'operations' | 'health'>('operations');
  const [selectedRake, setSelectedRake] = useState<any | null>(null);

  // Fetch Trainsets
  const { data: trainsets = [], isLoading: isLoadingTrains, error: trainsError } = useQuery({
    queryKey: ['trainsets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trainsets')
        .select(`
          *,
          risk_predictions (risk_level, risk_score),
          fitness_certificates (expiry_date, issue_date, issuing_authority)
        `)
        .order('rake_id');
      
      if (error) {
        console.error('Error fetching trainsets:', error);
        throw error;
      }
      console.log('Fetched trainsets:', data);
      return data;
    }
  });

  if (trainsError) {
    console.error('Trainsets query failed:', trainsError);
  }

  // Fetch all active train runs
  const { data: activeRuns = [], isLoading: isLoadingRuns } = useQuery({
    queryKey: ['active-train-runs'],
    queryFn: async () => {
      const { data: runs, error: runsError } = await (supabase as any)
        .from('train_runs')
        .select('*')
        .eq('status', 'active');
      
      if (runsError) throw runsError;
      if (!runs || runs.length === 0) return [];

      const userIds = Array.from(new Set(runs.map((r: any) => String(r.user_id))));
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('user_id, full_name, designation, employee_id')
        .in('user_id', userIds);

      const profileMap = (profiles || []).reduce((acc: any, p: any) => {
        acc[p.user_id] = p;
        return acc;
      }, {});

      return runs.map((run: any) => ({
        ...run,
        user_profiles: profileMap[run.user_id] ? [profileMap[run.user_id]] : []
      }));
    }
  });

  const startRunMutation = useMutation({
    mutationFn: async (trainsetId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { error } = await (supabase as any)
        .from('train_runs')
        .insert([{
          trainset_id: trainsetId,
          user_id: session.user.id,
          user_email: session.user.email,
          status: 'active'
        }]);

      if (error) throw error;

      // Also update trainset status to service_ready
      await supabase.from('trainsets')
        .update({ current_status: 'service_ready' })
        .eq('id', trainsetId);
    },
    onSuccess: () => {
      toast({ title: "Run Started", description: "Your train operation log has started." });
      queryClient.invalidateQueries({ queryKey: ['active-train-runs'] });
      queryClient.invalidateQueries({ queryKey: ['trainsets'] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" })
  });

  const stopRunMutation = useMutation({
    mutationFn: async (trainsetId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const activeRun = activeRuns.find((run: any) => run.trainset_id === trainsetId);
      if (!activeRun) throw new Error('No active run found for this train');

      const { error } = await (supabase as any)
        .from('train_runs')
        .update({ status: 'completed', end_time: new Date().toISOString() })
        .eq('id', activeRun.id);

      if (error) throw error;

      // Also update trainset status to standby
      await supabase.from('trainsets')
        .update({ current_status: 'standby' })
        .eq('id', trainsetId);
    },
    onSuccess: () => {
      toast({ title: "Run Stopped", description: "Your train operation log has been saved." });
      queryClient.invalidateQueries({ queryKey: ['active-train-runs'] });
      queryClient.invalidateQueries({ queryKey: ['trainsets'] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" })
  });

  // Fetch Real-time metrics summary
  const { data: metrics, isLoading: isLoadingMetrics } = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];

      const [runningRes, maintenanceRes, alerts, attendance, plans] = await Promise.all([
        supabase.from('trainsets').select('id', { count: 'exact', head: true }).eq('current_status', 'service_ready'),
        supabase.from('trainsets').select('id', { count: 'exact', head: true }).in('current_status', ['maintenance', 'ibl_routed', 'out_of_service']),
        supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('is_resolved', false),
        supabase.from('staff_attendance').select('*', { count: 'exact', head: true }).gte('created_at', today),
        supabase.from('induction_plans').select('optimizer_score').eq('plan_date', today).maybeSingle()
      ]);

      return {
        running: runningRes.count || 0,
        maintenance: maintenanceRes.count || 0,
        incidents: alerts.count || 0,
        staff: attendance.count || 0,
        inductionScore: plans.data?.optimizer_score || 0,
      };
    }
  });

  // Real-time Subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trainsets' }, () => {
        queryClient.invalidateQueries({ queryKey: ['trainsets'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, () => {
        queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'risk_predictions' }, () => {
        queryClient.invalidateQueries({ queryKey: ['trainsets'] });
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') setRealtimeStatus('error');
        // Handle other statuses if needed
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // GPS-Based Mileage Simulation & Maintenance Alerts (Admin Context)
  useEffect(() => {
    if (!isAdmin || activeRuns.length === 0) return;
    
    const simulateGPSData = async () => {
      for (const run of activeRuns) {
        try {
          const { data: rake, error: fetchErr } = await supabase
            .from('trainsets')
            .select('rake_id, total_mileage_km')
            .eq('id', run.trainset_id)
            .single();
          
          if (fetchErr || !rake) continue;
          
          // Speed up for demo: +2km every 5 seconds
          const newMileage = (rake.total_mileage_km || 0) + 2;
          
          const { error: updateErr } = await supabase
            .from('trainsets')
            .update({ total_mileage_km: newMileage })
            .eq('id', run.trainset_id);

          if (updateErr) continue;

          // Threshold Check: 5000km
          if (newMileage >= 5000 && (rake.total_mileage_km || 0) < 5000) {
              // 1. Send Alert
              await supabase.from('alerts').insert({
                title: `Maintenance Required: ${rake.rake_id}`,
                message: `Automated GPS Tracking: Train ${rake.rake_id} reached 5000km threshold. System auto-stopping run.`,
                severity: 'high',
                alert_type: 'maintenance',
                is_resolved: false
              });

              // 2. Update Status to maintenance
              await supabase.from('trainsets').update({ 
                current_status: 'maintenance' 
              }).eq('id', run.trainset_id);

              // 3. Stop Active Run
              await (supabase as any).from('train_runs').update({ 
                status: 'completed', 
                end_time: new Date().toISOString() 
              }).eq('id', run.id);

              toast({ title: "KM Threshold Reached", description: `${rake.rake_id} reached 5000km. Status updated to Maintenance and Run Stopped.` });
              
              // Invalidate queries to refresh UI
              queryClient.invalidateQueries({ queryKey: ['trainsets'] });
              queryClient.invalidateQueries({ queryKey: ['active-train-runs'] });
              queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
          }
        } catch (err) {
          console.error('GPS Simulation Error:', err);
        }
      }
    };

    const interval = setInterval(simulateGPSData, 5000);
    return () => clearInterval(interval);
  }, [activeRuns, isAdmin]);
  
  // Proactive Background Sync: Ensure all trains >= 5000km are in maintenance status
  useEffect(() => {
    if (!isAdmin || trainsets.length === 0) return;
    
    const enforceThresholds = async () => {
      const staleTrains = trainsets.filter(t => 
        (t.total_mileage_km >= 5000) && 
        (t.current_status === 'service_ready')
      );
      
      if (staleTrains.length === 0) return;
      
      console.log('Admin: Proactively aligning status for high-mileage trains:', staleTrains.map(t => t.rake_id));
      
      for (const train of staleTrains) {
        await supabase.from('trainsets')
          .update({ current_status: 'maintenance' })
          .eq('id', train.id);
          
        // Stop any active run for this train just in case
        const run = activeRuns.find(r => r.trainset_id === train.id);
        if (run) {
          await (supabase as any).from('train_runs').update({ 
            status: 'completed', 
            end_time: new Date().toISOString() 
          }).eq('id', run.id);
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ['trainsets'] });
      queryClient.invalidateQueries({ queryKey: ['active-train-runs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
    };

    enforceThresholds();
  }, [trainsets, isAdmin, activeRuns, queryClient]);

  if (isLoadingTrains || isLoadingMetrics) {
    return <div className="flex items-center justify-center h-64"><Activity className="animate-spin text-primary" /></div>;
  }

  const availabilityPercent = metrics?.running ? Math.round((metrics.running / (trainsets.length || 15)) * 100) : 0;
  const riskPercent = Math.round(trainsets.filter(t => {
    const risk = (t.risk_predictions as any)?.[0]?.risk_level;
    return risk === 'high' || risk === 'critical';
  }).length / (trainsets.length || 1) * 100);

  return (
    <div className="space-y-10 pb-20">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-foreground tracking-tight">{t('dashboard.title')}</h1>
          <p className="text-muted-foreground font-medium mt-1">Real-time operational monitoring and fleet intelligence.</p>
        </div>
        
        <div className="flex items-center gap-3">
          {realtimeStatus === 'connected' ? (
            <div className="flex items-center space-x-2 text-[10px] font-black uppercase tracking-widest text-success bg-success/5 border border-success/20 px-3 py-1.5 rounded-full shadow-[0_0_15px_rgba(var(--success),0.1)]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
              </span>
              <span>{t('dashboard.liveSync')}</span>
            </div>
          ) : (
            <div className="text-[10px] font-black uppercase tracking-widest text-destructive bg-destructive/5 border border-destructive/20 px-3 py-1.5 rounded-full">{t('dashboard.offline')}</div>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard 
          title={t('dashboard.kpi.trainsRunning')} 
          value={metrics?.running || 0} 
          icon={Train} 
          variant="success" 
          className="kpi-card kpi-card-success premium-shadow"
          onClick={() => setFilter(filter === 'running' ? 'all' : 'running')}
          active={filter === 'running'}
        />
        <KPICard 
          title={t('dashboard.kpi.maintenanceIBL')} 
          value={metrics?.maintenance || 0} 
          icon={Wrench} 
          variant="warning" 
          className="kpi-card kpi-card-warning premium-shadow"
          onClick={() => setFilter(filter === 'maintenance' ? 'all' : 'maintenance')}
          active={filter === 'maintenance'}
        />
        <KPICard 
          title={t('dashboard.kpi.activeAlerts')} 
          value={metrics?.incidents || 0} 
          icon={AlertTriangle} 
          variant="destructive" 
          className="kpi-card kpi-card-destructive premium-shadow"
          onClick={() => navigate('/alerts')}
          active={false}
        />
        <KPICard 
          title={t('dashboard.kpi.staffOnSite')} 
          value={metrics?.staff || 0} 
          icon={Users} 
          variant="info" 
          className="kpi-card kpi-card-info premium-shadow"
          onClick={() => navigate('/attendance')}
          active={false}
        />
      </div>

      {/* Enterprise AI Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-muted/20 p-8 rounded-[2rem] border border-border/50">
        <Card className="shadow-none border-none bg-transparent">
          <CardHeader className="flex flex-row items-center space-x-3 pb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-xs font-black uppercase tracking-wider text-muted-foreground">{t('dashboard.fleetAvailability')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-end">
              <span className="text-4xl font-black text-foreground">{availabilityPercent}%</span>
              <span className="text-[10px] font-bold text-muted-foreground uppercase bg-muted px-2 py-0.5 rounded">{t('dashboard.target')}: 95%</span>
            </div>
            <Progress value={availabilityPercent} className="h-1.5 bg-muted rounded-full overflow-hidden" />
          </CardContent>
        </Card>

        <Card className="shadow-none border-none bg-transparent">
          <CardHeader className="flex flex-row items-center space-x-3 pb-2">
            <div className="p-2 rounded-lg bg-warning/10">
              <BarChart3 className="h-5 w-5 text-warning" />
            </div>
            <CardTitle className="text-xs font-black uppercase tracking-wider text-muted-foreground">{t('dashboard.maintenanceRiskIndex')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-end">
              <span className="text-4xl font-black text-foreground">{riskPercent}%</span>
              <span className="text-[10px] font-bold text-muted-foreground uppercase bg-muted px-2 py-0.5 rounded">{t('dashboard.trainsAtHighRisk')}</span>
            </div>
            <Progress value={riskPercent} className="h-1.5 bg-muted rounded-full overflow-hidden" />
          </CardContent>
        </Card>

        <Card className="shadow-none border-none bg-transparent">
          <CardHeader className="flex flex-row items-center space-x-3 pb-2">
            <div className="p-2 rounded-lg bg-info/10">
              <PieChart className="h-5 w-5 text-info" />
            </div>
            <CardTitle className="text-xs font-black uppercase tracking-wider text-muted-foreground">{t('dashboard.inductionReadiness')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-end">
              <span className="text-4xl font-black text-foreground">{metrics?.inductionScore || 0}</span>
              <span className="text-[10px] font-bold text-muted-foreground uppercase bg-muted px-2 py-0.5 rounded">{t('dashboard.avgOptimizationScore')}</span>
            </div>
            <Progress value={metrics?.inductionScore || 0} className="h-1.5 bg-muted rounded-full overflow-hidden" />
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs Segment */}
      <section className="mt-8">
        <div className="flex items-center gap-2 border-b border-border/50 pb-px mb-8">
          <button
            onClick={() => setActiveTab('operations')}
            className={cn(
               "px-8 py-3 text-xs font-black uppercase tracking-[0.2em] transition-all relative group",
               activeTab === 'operations' ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Terminal Operations
            {activeTab === 'operations' && (
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary shadow-[0_-2px_8px_rgba(var(--primary),0.5)]" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('health')}
            className={cn(
               "px-8 py-3 text-xs font-black uppercase tracking-[0.2em] transition-all relative flex items-center gap-2 group",
               activeTab === 'health' ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Activity className="w-4 h-4" />
            Fleet Health
            {activeTab === 'health' && (
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary shadow-[0_-2px_8px_rgba(var(--primary),0.5)]" />
            )}
          </button>
        </div>

        {activeTab === 'operations' ? (
          <div className="section-gradient-overview p-8 rounded-[2.5rem] border border-border/50 animate-in fade-in zoom-in-95 duration-500">
            <div className="flex items-center justify-between mb-10">
              <h2 className="text-2xl font-black flex items-center gap-3 tracking-tight text-foreground">
                <Train className="w-8 h-8 text-primary shadow-sm" />
                Active Fleet Roster
              </h2>
              
              <div className="flex gap-2">
                <button 
                  onClick={() => setFilter('all')}
                  className={cn("px-4 py-1.5 rounded-full text-xs font-bold transition-all border", 
                    filter === 'all' ? "bg-primary text-primary-foreground border-primary shadow-glow" : "bg-card text-muted-foreground border-border hover:bg-secondary")}
                >
                  All ({trainsets.length})
                </button>
                <button 
                  onClick={() => setFilter('running')}
                  className={cn("px-4 py-1.5 rounded-full text-xs font-bold transition-all border flex items-center gap-1", 
                    filter === 'running' ? "bg-success/20 text-success border-success shadow-[0_0_10px_rgba(var(--success),0.2)]" : "bg-card text-muted-foreground border-border hover:bg-secondary")}
                >
                  <Activity className="w-3.5 h-3.5" />
                  Active
                </button>
                <button 
                  onClick={() => setFilter('maintenance')}
                  className={cn("px-4 py-1.5 rounded-full text-xs font-bold transition-all border flex items-center gap-1", 
                    filter === 'maintenance' ? "bg-warning/20 text-warning border-warning shadow-[0_0_10px_rgba(var(--warning),0.2)]" : "bg-card text-muted-foreground border-border hover:bg-secondary")}
                >
                  <Wrench className="w-3.5 h-3.5" />
                  Maintenance
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
              {trainsets
                .filter((rake: any) => {
                  if (filter === 'all') return true;
                  if (filter === 'running') return rake.current_status === 'service_ready' || activeRuns.some((run: any) => run.trainset_id === rake.id);
                  if (filter === 'maintenance') return ['maintenance', 'ibl_routed', 'out_of_service'].includes(rake.current_status);
                  return true;
                })
                .sort((a: any, b: any) => {
                  const getHealth = (rake: any) => {
                    const cert = rake.fitness_certificates?.[0];
                    let isGood = true;
                    if (cert?.expiry_date) {
                      const daysLeft = Math.floor((new Date(cert.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                      if (daysLeft < 7) isGood = false;
                    }
                    if (rake.total_mileage_km >= 5000) isGood = false;
                    
                    const mileage = Number(rake.total_mileage_km) || 0;
                    return { isGood, mileage };
                  };

                  const healthA = getHealth(a);
                  const healthB = getHealth(b);
                  
                  if (healthA.isGood !== healthB.isGood) return healthB.isGood ? 1 : -1;
                  return healthB.mileage - healthA.mileage;
                })
                .map((rake: any) => {
                const cert = rake.fitness_certificates?.[0];
                let fitnessStatus: 'valid' | 'expired' | 'expiring' | undefined;
                if (cert?.expiry_date) {
                  const expiry = new Date(cert.expiry_date);
                  const today = new Date();
                  const diffTime = expiry.getTime() - today.getTime();
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                  if (diffDays < 0) fitnessStatus = 'expired';
                  else if (diffDays <= 7) fitnessStatus = 'expiring';
                  else fitnessStatus = 'valid';
                }

                return (
                  <div 
                    key={rake.id} 
                    onClick={() => setSelectedRake(rake)}
                    className="cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all rounded-xl"
                  >
                    <RakeCard
                      rakeId={rake.rake_id}
                      route={rake.route || 'Stabled'}
                    bayNumber={Number(rake.current_bay) || 0}
                    mileage={Number(rake.total_mileage_km) || 0}
                    avgDailyKm={Number(rake.avg_daily_km) || 0}
                    fitnessStatus={fitnessStatus}
                    expiryDate={cert?.expiry_date}
                    status={
                      activeRuns.some((run: any) => run.trainset_id === rake.id) ? 'running' : 
                      rake.current_status === 'maintenance' ? 'maintenance' : 
                      'stopped'
                    }
                    currentRun={activeRuns.find((r: any) => r.trainset_id === rake.id)}
                    operatorName={(() => {
                      const run = activeRuns.find((r: any) => r.trainset_id === rake.id);
                      if (!run) return undefined;
                      const profile = Array.isArray(run.user_profiles) ? run.user_profiles[0] : run.user_profiles;
                      // Use profile name if available, fallback to email prefix or email
                      if (profile?.full_name) return profile.full_name;
                      if (run.user_email) return run.user_email.split('@')[0];
                      return undefined;
                    })()}
                    currentUserId={user?.id}
                    isAdmin={isAdmin}
                    onStartRun={() => startRunMutation.mutate(rake.id)}
                    onStopRun={() => stopRunMutation.mutate(rake.id)}
                      isRunLoading={startRunMutation.isPending || stopRunMutation.isPending}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="section-gradient-maintenance p-8 rounded-[2.5rem] border border-border/50 animate-in fade-in slide-in-from-right-4 duration-500">
            <h2 className="text-2xl font-black flex items-center gap-3 tracking-tight text-foreground mb-10">
              <Activity className="w-8 h-8 text-primary" />
              Real-Time Fleet Diagnostics
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-8">
              {trainsets.sort((a: any, b: any) => a.rake_id.localeCompare(b.rake_id)).map((rake: any) => (
                <TrainHealthCard key={`health-${rake.id}`} rakeId={rake.rake_id} className="premium-shadow glass-card hover:translate-y-[-4px]" />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Admin Live Tracking & Details Modal */}
      <Dialog open={!!selectedRake} onOpenChange={(open) => {
        if (!open) {
          setSelectedRake(null);
        }
      }}>
        <DialogContent className="sm:max-w-[600px] sm:h-[600px] h-[80vh] overflow-y-auto bg-background border-border shadow-2xl p-6 rounded-2xl flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <ShieldCheck className="w-5 h-5 text-primary" />
              {isAdmin ? 'Admin Fleet Insight:' : 'Live Fleet Tracker:'} {selectedRake ? getKeralaTrainDetails(selectedRake.rake_id).name : ''}
            </DialogTitle>
          </DialogHeader>
          
          {selectedRake && (
            <div className="space-y-4 pt-4">
              {/* Dynamic Live Track Bar Component Reused */}
              <div>
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Live Telemetry Feed</h3>
                {(() => {
                  const run = activeRuns.find((r: any) => r.trainset_id === selectedRake.id);
                  return (
                    <div className="space-y-4">
                      <LiveTrainCard train={{
                        ...selectedRake, 
                        currentRun: run,
                        delay_minutes: (selectedRake.id.length % 5 === 0) ? 3 : 0 
                      } as TrainData} />
                      {run && (
                        <div className="mt-4 p-4 rounded-xl bg-primary/5 border border-primary/10 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                          {(() => {
                            const profile = Array.isArray(run.user_profiles) ? run.user_profiles[0] : run.user_profiles;
                            if (!profile) return (
                              <div className="flex flex-col">
                                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Active Operator</span>
                                <span className="font-bold text-foreground">{run.user_email}</span>
                              </div>
                            );
                            return (
                              <>
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shadow-sm">
                                  {profile.full_name?.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Active Operator</span>
                                  <span className="font-bold text-foreground">{profile.full_name}</span>
                                  <span className="text-[10px] text-primary font-semibold">{profile.designation}</span>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
              
              {isAdmin && (
              <div className="bg-secondary/20 border border-border/50 rounded-lg p-4 space-y-3">
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Maintenance History</h3>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-foreground">
                    <Wrench className="w-4 h-4 text-warning" />
                    Last Serviced
                  </span>
                  <span className="font-bold">
                    {selectedRake?.fitness_certificates?.[0]?.expiry_date 
                      ? (() => {
                          const expiry = new Date(selectedRake.fitness_certificates[0].expiry_date);
                          // Estimate that last service was 180 days before expiry
                          const lastService = new Date(expiry.getTime() - (180 * 24 * 60 * 60 * 1000));
                          const daysAgo = Math.floor((new Date().getTime() - lastService.getTime()) / (1000 * 60 * 60 * 24));
                          return `${Math.max(0, daysAgo)} days ago`;
                        })()
                      : 'Unknown'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-foreground">
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                    Fitness Expiry
                  </span>
                  <span className="font-bold">
                    {selectedRake?.fitness_certificates?.[0]?.expiry_date 
                      ? (() => {
                          const expiry = new Date(selectedRake.fitness_certificates[0].expiry_date);
                          const daysLeft = Math.floor((expiry.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                          return daysLeft < 0 ? 'Expired' : `In ${daysLeft} days`;
                        })()
                      : 'N/A'}
                  </span>
                </div>

                {selectedRake?.fitness_certificates?.[0]?.issuing_authority?.includes('Loc:') && (
                  <div className="bg-primary/5 p-2 rounded border border-primary/10 mt-2 space-y-1">
                    <div className="flex justify-between text-[10px] uppercase font-bold text-muted-foreground">
                      <span>Last Renewal Info</span>
                      <span className="text-primary">
                        {selectedRake.fitness_certificates[0].issuing_authority.split('Renewal: ')[1]?.replace(')', '') || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold text-foreground">
                      <span>Location</span>
                      <span>
                        {selectedRake.fitness_certificates[0].issuing_authority.split('Loc: ')[1]?.split(',')[0] || 'N/A'}
                      </span>
                    </div>
                  </div>
                )}
                
                <div className="pt-2" />
              </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Analytics */}
      <section className="pt-12">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 rounded-xl bg-muted">
            <BarChart3 className="w-6 h-6 text-foreground/60" />
          </div>
          <h2 className="text-2xl font-black text-foreground tracking-tight">{t('dashboard.historicalPerformance')}</h2>
        </div>
        <AnalyticsCharts />
      </section>
    </div>
  );
};
