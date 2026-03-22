import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, MapPin, Clock, FileText, Send, Loader2, Phone, History, Trash2, ShieldAlert } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

// Add type for incident to handle PostgREST issues
interface Incident {
    id: string;
    incident_type: string;
    location: string;
    incident_date: string;
    phone_number?: string;
    description: string;
    reporter_name?: string;
    reporter_email?: string;
    created_at: string;
}

const incidentTypes = [
    { value: 'fire', label: '🔥 Fire' },
    { value: 'harassment', label: '🚨 Harassment' },
    { value: 'theft', label: '🔒 Theft' },
    { value: 'medical_emergency', label: '🏥 Medical Emergency' },
    { value: 'safety_hazard', label: '⚠️ Safety Hazard' },
    { value: 'other', label: '📋 Other' },
];

export const ReportIncident = () => {
    const { t } = useTranslation();
    const { user, isAdmin } = useAuth();
    const [incidentType, setIncidentType] = useState('');
    const [location, setLocation] = useState('');
    const [dateTime, setDateTime] = useState(() => {
        const now = new Date();
        const offset = now.getTimezoneOffset();
        const local = new Date(now.getTime() - offset * 60000);
        return local.toISOString().slice(0, 16);
    });
    const [phoneNumber, setPhoneNumber] = useState('');
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [incidents, setIncidents] = useState<any[]>([]);
    const [isLoadingIncidents, setIsLoadingIncidents] = useState(true);
    const [isSeeding, setIsSeeding] = useState(false);

    const fetchIncidents = async () => {
        try {
            const { data, error } = await (supabase as any)
                .from('incidents')
                .select('*')
                .order('incident_date', { ascending: false });

            if (error) throw error;
            setIncidents(data || []);
        } catch (error) {
            console.error('Error fetching incidents:', error);
        } finally {
            setIsLoadingIncidents(false);
        }
    };

    const handleDeleteIncident = async (id: string) => {
        try {
            // Delete linked alerts first (or let cascade handle it if configured, but explicit is safer)
            await (supabase as any).from('alerts').delete().eq('related_incident_id', id);

            const { error } = await (supabase as any)
                .from('incidents')
                .delete()
                .eq('id', id);

            if (error) throw error;
            
            toast({
                title: t('incidents.toastDeleted'),
                description: t('incidents.toastDeletedDesc'),
            });
            
            // Refresh the list locally
            setIncidents(prev => prev.filter(i => i.id !== id));
        } catch (error: any) {
            console.error('Error deleting incident:', error);
            toast({
                title: 'Error',
                description: error.message || 'Failed to delete the incident.',
                variant: 'destructive',
            });
        }
    };

    const handleSeeding = async () => {
        setIsSeeding(true);
        const sampleIncidents = [
            {
                incident_type: 'fire',
                location: 'Ernakulam South Station',
                incident_date: new Date(Date.now() - 3600000).toISOString(),
                description: 'Small electrical spark observed in the battery room. Immediate inspection requested.',
                reporter_name: 'Sample Operator',
                reporter_email: 'samples@maltrains.net'
            },
            {
                incident_type: 'medical_emergency',
                location: 'Aluva Station Platform 1',
                incident_date: new Date(Date.now() - 7200000).toISOString(),
                description: 'Passenger reported feeling dizzy. First aid administered, ambulance on standby.',
                reporter_name: 'Sample Operator',
                reporter_email: 'samples@maltrains.net'
            },
            {
                incident_type: 'safety_hazard',
                location: 'Trivandrum Central - Yard',
                incident_date: new Date(Date.now() - 86400000).toISOString(),
                description: 'Broken fencing discovered near the north gate tracks.',
                reporter_name: 'Sample Operator',
                reporter_email: 'samples@maltrains.net'
            }
        ];

        try {
            const { error } = await (supabase as any).from('incidents').insert(sampleIncidents);
            if (error) throw error;
            await fetchIncidents();
            toast({ title: 'Samples Seeded', description: 'Sample incidents have been added to the history.' });
        } catch (error) {
            console.error('Error seeding incidents:', error);
        } finally {
            setIsSeeding(false);
        }
    };

    useEffect(() => {
        fetchIncidents();

        // Setup realtime subscription
        const channel = supabase
            .channel('incidents-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, () => {
                fetchIncidents();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!incidentType || !location || !description) {
            toast({
                title: 'Missing Fields',
                description: 'Please fill in all required fields before submitting.',
                variant: 'destructive',
            });
            return;
        }

        setIsSubmitting(true);

        try {
            // 1. Persist to Incidents Table
            const { data: incidentData, error: dbError } = await (supabase as any).from('incidents').insert({
                incident_type: incidentType,
                location,
                incident_date: new Date(dateTime).toISOString(),
                phone_number: phoneNumber,
                description,
                reporter_name: user?.user_metadata?.display_name || user?.email || 'Unknown',
                reporter_email: user?.email || 'Unknown',
            }).select();

            if (dbError) throw dbError;
            
            const newIncident = incidentData?.[0];

            // 2. Create linked system Alert
            if (newIncident) {
                const { error: alertError } = await (supabase as any).from('alerts').insert({
                    alert_type: 'Incident',
                    severity: 'error',
                    title: `${incidentType.replace('_', ' ').toUpperCase()} Reported`,
                    message: `An incident was reported at ${location}: "${description.substring(0, 50)}${description.length > 50 ? '...' : ''}"`,
                    related_incident_id: newIncident.id,
                    is_read: false,
                    is_resolved: false
                });

                if (alertError) {
                    console.warn('Incident saved but failed to create alert:', alertError);
                }
            }

            // 3. Refresh List
            await fetchIncidents();

            // 3. Optional: Trigger Edge Function (Email notification)
            try {
                await supabase.functions.invoke('send-incident-report', {
                    body: {
                        incidentType,
                        location,
                        dateTime,
                        description,
                        phoneNumber,
                        reporterName: user?.user_metadata?.display_name || user?.email || 'Unknown',
                        reporterEmail: user?.email || 'Unknown',
                    },
                });
            } catch (fnError) {
                console.warn('Edge function notification failed, but record was saved:', fnError);
            }

            toast({
                title: `✅ ${t('incidents.toastSuccess')}`,
                description: t('incidents.toastSuccessDesc'),
            });

            // Reset form
            setIncidentType('');
            setLocation('');
            setPhoneNumber('');
            setDescription('');
            const now = new Date();
            const offset = now.getTimezoneOffset();
            const local = new Date(now.getTime() - offset * 60000);
            setDateTime(local.toISOString().slice(0, 16));
        } catch (error: unknown) {
            console.error('Error submitting incident report:', error);
            toast({
                title: 'Submission Failed',
                description: error instanceof Error ? error.message : 'Failed to save the incident report. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const criticalCount = incidents.filter(i => i.incident_type === 'fire' || i.incident_type === 'medical_emergency').length;
    const hazardCount = incidents.filter(i => i.incident_type === 'safety_hazard').length;

    return (
        <div className="max-w-[1400px] mx-auto space-y-10 pb-20 px-4">
            {/* Professional Government Header */}
            <div className="flex flex-col sm:flex-row items-baseline sm:items-center justify-between gap-6 animate-in fade-in slide-in-from-top-4 duration-700">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg transform -rotate-3">
                        <ShieldAlert className="w-9 h-9" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-foreground tracking-tight">
                            {t('incidents.title')}
                        </h1>
                        <p className="text-sm font-medium text-muted-foreground mt-1">Operational safety reporting and history archive.</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {isAdmin && (
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={handleSeeding}
                            disabled={isSeeding || incidents.length > 0}
                            className="bg-muted/20 border-white/5 text-[10px] font-bold uppercase tracking-wider px-4 h-10 hover:bg-primary/5 transition-all"
                        >
                            <Send className="w-3.5 h-3.5 mr-2" />
                            {isSeeding ? 'Archiving...' : 'Seed Audit Trail'}
                        </Button>
                    )}
                    <div className="px-4 py-1.5 bg-background/50 rounded-xl shadow-sm border border-white/10 hidden sm:block">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Network Integrity</p>
                        <p className="text-xs font-bold">Stable</p>
                    </div>
                </div>
            </div>

            {/* Safety Pulse Metrics - Simplified */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
                <Card className="glass-card border-none bg-primary/5 hover:translate-y-[-2px] transition-all overflow-hidden p-6 relative">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-primary/70">Total Events</p>
                    <h3 className="text-2xl font-bold mt-1">{incidents.length}</h3>
                    <p className="text-[9px] font-medium text-muted-foreground mt-0.5">Logs</p>
                </Card>
                <Card className="glass-card border-none bg-destructive/5 hover:translate-y-[-2px] transition-all overflow-hidden p-6 relative">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-destructive/70">Critical</p>
                    <h3 className="text-2xl font-bold mt-1 text-destructive">{criticalCount}</h3>
                    <p className="text-[9px] font-medium text-muted-foreground mt-0.5">Threats</p>
                </Card>
                <Card className="glass-card border-none bg-warning/5 hover:translate-y-[-2px] transition-all overflow-hidden p-6 relative">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-warning/70">Hazards</p>
                    <h3 className="text-2xl font-bold mt-1 text-warning">{hazardCount}</h3>
                    <p className="text-[9px] font-medium text-muted-foreground mt-0.5">Alerts</p>
                </Card>
                <Card className="glass-card border-none bg-success/5 hover:translate-y-[-2px] transition-all overflow-hidden p-6 relative">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-success/70">Response</p>
                    <h3 className="text-2xl font-bold mt-1 text-success">98%</h3>
                    <p className="text-[9px] font-medium text-muted-foreground mt-0.5">SLA</p>
                </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-12 items-start">
                
                <div className="xl:col-span-4 space-y-6 sticky top-8">
                    <div className="flex items-center justify-between pl-1 border-l-4 border-primary/40">
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-bold tracking-tight">Issue Intake</h2>
                        </div>
                        <Badge variant="outline" className="text-[9px] font-bold uppercase border-primary/20 text-primary">SOP Required</Badge>
                    </div>

                    <Card className="glass-card premium-shadow border-none overflow-hidden ring-1 ring-white/10">
                        <CardHeader className="pb-8 border-b border-white/5 bg-gradient-to-br from-destructive/10 to-transparent">
                            <CardTitle className="text-sm font-black uppercase tracking-[0.25em] text-destructive flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-destructive animate-ping" />
                                Live Incident Feed
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-10">
                            <form onSubmit={handleSubmit} className="space-y-8">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="space-y-2.5">
                                        <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 ml-1">Event Classification</Label>
                                        <Select value={incidentType} onValueChange={setIncidentType}>
                                            <SelectTrigger className="h-12 bg-muted/40 border-none rounded-xl px-5 font-bold shadow-inner">
                                                <SelectValue placeholder="Select type" />
                                            </SelectTrigger>
                                            <SelectContent className="glass-card border-white/10 rounded-xl overflow-hidden shadow-2xl">
                                                <SelectItem value="fire" className="font-bold py-3 focus:bg-destructive/10 focus:text-destructive">Fire Outbreak</SelectItem>
                                                <SelectItem value="medical_emergency" className="font-bold py-3 focus:bg-destructive/10 focus:text-destructive">Medical Emergency</SelectItem>
                                                <SelectItem value="safety_hazard" className="font-bold py-3 focus:bg-warning/10 focus:text-warning text-warning-foreground">Safety Hazard</SelectItem>
                                                <SelectItem value="harassment" className="font-bold py-3 focus:bg-warning/10 focus:text-warning">Harassment/Conduct</SelectItem>
                                                <SelectItem value="theft_vandalism" className="font-bold py-3 focus:bg-primary/10 focus:text-primary">Vandalism/Security</SelectItem>
                                                <SelectItem value="technical_failure" className="font-bold py-3 focus:bg-primary/10 focus:text-primary">System Failure</SelectItem>
                                                <SelectItem value="other" className="font-bold py-3 focus:bg-muted/50">Other Protocol</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2.5">
                                        <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 ml-1">Signal Location</Label>
                                        <div className="relative">
                                            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary opacity-50" />
                                            <Input
                                                placeholder="e.g. Platform 4-B"
                                                className="h-12 bg-muted/40 border-none rounded-xl pl-11 font-bold shadow-inner"
                                                value={location}
                                                onChange={(e) => setLocation(e.target.value)}
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="space-y-2.5">
                                        <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 ml-1">Universal Time</Label>
                                        <div className="relative">
                                            <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary opacity-50" />
                                            <Input
                                                type="datetime-local"
                                                className="h-12 bg-muted/40 border-none rounded-xl pl-11 font-bold shadow-inner"
                                                value={dateTime}
                                                onChange={(e) => setDateTime(e.target.value)}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2.5">
                                        <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 ml-1">Operational Protocol</Label>
                                        <div className="relative">
                                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary opacity-50" />
                                            <Input
                                                type="tel"
                                                placeholder="Contact Signal"
                                                className="h-12 bg-muted/40 border-none rounded-xl pl-11 font-bold shadow-inner"
                                                value={phoneNumber}
                                                onChange={(e) => setPhoneNumber(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2.5">
                                    <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 ml-1">Incident Telemetry / Narrative</Label>
                                    <Textarea
                                        placeholder="Provide detailed observations for central audit..."
                                        className="min-h-[140px] bg-muted/40 border-none rounded-[1.5rem] p-6 font-bold shadow-inner resize-none focus:ring-4 focus:ring-primary/10 transition-all"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        required
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full h-16 bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-wider rounded-2xl shadow-lg transition-all active:scale-[0.98] mt-4"
                                    disabled={isSubmitting || !incidentType || !location || !description}
                                >
                                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Transmit Report'}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                {/* DYNAMIC AUDIT TRAIL */}
                <div className="xl:col-span-8 space-y-8">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="p-2.5 rounded-xl bg-muted/50 border border-white/5 shadow-inner">
                                <History className="w-7 h-7 opacity-40" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold tracking-tight">Event Archives</h2>
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-0.5">Safety Index: Operational</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 glass-card px-4 py-2 rounded-xl border-none ring-1 ring-white/5">
                            <span className="w-1.5 h-1.5 rounded-full bg-success" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{incidents.length} Indexed Nodes</span>
                        </div>
                    </div>

                    {isLoadingIncidents ? (
                        <div className="h-[600px] flex flex-col items-center justify-center glass-card rounded-[40px] border-none border-t-2 border-white/5">
                            <div className="relative">
                                <div className="w-20 h-20 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                     <Loader2 className="w-8 h-8 text-primary animate-pulse" />
                                </div>
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground mt-10 animate-pulse">Filtering Signal...</p>
                        </div>
                    ) : incidents.length === 0 ? (
                        <Card className="glass-card border-none rounded-[40px] overflow-hidden min-h-[500px] flex items-center justify-center bg-muted/10">
                            <CardContent className="flex flex-col items-center justify-center p-20 text-center">
                                <div className="w-32 h-32 bg-muted/30 rounded-full flex items-center justify-center mb-10 shadow-inner group cursor-help">
                                    <FileText className="w-12 h-12 text-muted-foreground/20 group-hover:text-primary/40 transition-colors" />
                                </div>
                                <h3 className="text-2xl font-black text-foreground mb-4">No Anomalies Detected</h3>
                                <p className="text-sm font-medium text-muted-foreground max-w-sm leading-relaxed mx-auto italic">
                                    "The safety logs are currently pristine. All infrastructure telemetry reports 100% operational efficiency."
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 auto-rows-max">
                            {incidents.map((incident: Incident, idx: number) => (
                                <Card 
                                    key={incident.id} 
                                    className={cn(
                                        "glass-card premium-shadow border-none overflow-hidden hover:scale-[1.01] hover:ring-2 hover:ring-primary/20 transition-all duration-500 group animate-in slide-in-from-bottom-6",
                                        idx % 3 === 0 ? "md:col-span-1" : "md:col-span-1"
                                    )}
                                >
                                    <CardContent className="p-0 flex flex-col h-full">
                                        {/* Dynamic Status Header */}
                                        <div className={cn(
                                            "h-3 w-full",
                                            incident.incident_type === 'fire' || incident.incident_type === 'medical_emergency' ? "bg-destructive" : 
                                            incident.incident_type === 'harassment' ? "bg-warning" : "bg-primary"
                                        )} />
                                        
                                        <div className="p-8 flex flex-col flex-1">
                                            <div className="flex items-start justify-between gap-4 mb-8">
                                                <div className="space-y-3">
                                                    <div className="flex items-center gap-3">
                                                        <Badge className={cn(
                                                            "h-7 font-bold uppercase tracking-wider text-[8px] px-3 rounded-md border-none shadow-sm",
                                                            incident.incident_type === 'fire' || incident.incident_type === 'medical_emergency' ? "bg-destructive text-white" : 
                                                            incident.incident_type === 'harassment' ? "bg-warning text-black" : "bg-primary text-white"
                                                        )}>
                                                            {incident.incident_type.replace('_', ' ')}
                                                        </Badge>
                                                        <div className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground tracking-wider px-2.5 py-1 bg-muted/20 rounded-lg">
                                                            <Clock className="w-3 h-3 text-primary" />
                                                            {format(new Date(incident.incident_date), 'HH:mm — MMM dd')}
                                                        </div>
                                                    </div>
                                                    <h3 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
                                                        <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                                                            <MapPin className="w-4 h-4" />
                                                        </div>
                                                        {incident.location}
                                                    </h3>
                                                </div>
                                                
                                                {isAdmin && (
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm"
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteIncident(incident.id); }}
                                                        className="h-10 w-10 p-0 text-destructive/20 hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                )}
                                            </div>

                                            <div className="bg-muted/30 rounded-[2rem] p-8 border border-white/5 relative group-hover:bg-muted/50 transition-all shadow-inner flex-1">
                                                <FileText className="absolute bottom-4 right-6 w-20 h-20 text-primary/5 pointer-events-none group-hover:scale-125 transition-transform duration-700" />
                                                <p className="text-sm font-bold leading-[1.8] text-foreground/80 relative z-10 antialiased">
                                                    "{incident.description}"
                                                </p>
                                            </div>

                                            <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                     <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white font-black text-sm shadow-lg">
                                                        {incident.reporter_name?.charAt(0).toUpperCase() || 'S'}
                                                     </div>
                                                     <div className="flex flex-col">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-0.5">Authorizing Unit</span>
                                                        <span className="text-xs font-black text-foreground truncate max-w-[120px]">{incident.reporter_name}</span>
                                                     </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">Status</p>
                                                    <span className="flex items-center gap-1.5 text-success font-black text-[9px] uppercase tracking-widest px-3 py-1 bg-success/10 rounded-full border border-success/20">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                                                        Logged
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
