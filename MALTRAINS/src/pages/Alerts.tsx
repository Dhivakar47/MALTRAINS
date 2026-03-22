import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bell, AlertTriangle, Info, CheckCircle, Clock, Mail, Send, Users, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

// Removed static alertsData

const alertConfig = {
  warning: { icon: AlertTriangle, iconBg: 'bg-warning/10', iconColor: 'text-warning', badgeClass: 'bg-warning/10 text-warning border-warning/20' },
  info: { icon: Info, iconBg: 'bg-info/10', iconColor: 'text-info', badgeClass: 'bg-info/10 text-info border-info/20' },
  error: { icon: AlertTriangle, iconBg: 'bg-destructive/10', iconColor: 'text-destructive', badgeClass: 'bg-destructive/10 text-destructive border-destructive/20' },
  success: { icon: CheckCircle, iconBg: 'bg-success/10', iconColor: 'text-success', badgeClass: 'bg-success/10 text-success border-success/20' },
};

export const Alerts = () => {
  const { isAdmin, user } = useAuth();
  const queryClient = useQueryClient();
  const [sending, setSending] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [broadcastDialogOpen, setBroadcastDialogOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<any>(null);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastSeverity, setBroadcastSeverity] = useState('info');

  // New Alert Form state
  const [newAlertTitle, setNewAlertTitle] = useState('');
  const [newAlertMessage, setNewAlertMessage] = useState('');
  const [newAlertSeverity, setNewAlertSeverity] = useState('info');
  const [newAlertType, setNewAlertType] = useState('Manual');

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // Setup realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('alerts-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, () => {
        queryClient.invalidateQueries({ queryKey: ['alerts'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const createAlertMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('alerts').insert([{
        title: newAlertTitle,
        message: newAlertMessage,
        severity: newAlertSeverity,
        alert_type: newAlertType,
        is_read: false,
        is_resolved: false
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Alert Created', description: 'Your alert has been published to all users.' });
      setNewAlertTitle('');
      setNewAlertMessage('');
      setNewAlertType('Manual');
      setNewAlertSeverity('info');
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message || 'Failed to create alert', variant: 'destructive' });
    }
  });

  const handleCreateAlert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlertTitle || !newAlertMessage) return;
    createAlertMutation.mutate();
  };

  const deleteAlertMutation = useMutation({
    mutationFn: async (id: string) => {
      // Find if this alert has a related incident
      const alertToDelete = alerts.find((a: any) => a.id === id);
      
      if ((alertToDelete as any)?.related_incident_id) {
        // If there's a linked incident, deleting it will cascade and delete the alert
        const { error } = await (supabase as any).from('incidents').delete().eq('id', (alertToDelete as any).related_incident_id);
        if (error) throw error;
      } else {
        // Normal deletion for other alert types
        const { error } = await supabase.from('alerts').delete().eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: 'Alert Deleted', description: 'The incident has been permanently removed.' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message || 'Failed to delete alert', variant: 'destructive' });
    }
  });

  const handleDeleteAlert = (id: string) => {
    if (confirm('Are you sure you want to delete this incident report? This action cannot be undone.')) {
      deleteAlertMutation.mutate(id);
    }
  };

  const unreadCount = alerts.filter(a => !a.is_read && !a.is_resolved).length;

  const handleOpenEmailDialog = (alert: any) => {
    setSelectedAlert(alert);
    setRecipientEmail('');
    setEmailDialogOpen(true);
  };

  const handleSendAlertEmail = async () => {
    if (!selectedAlert || !recipientEmail) return;
    setSending(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-alert-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            title: selectedAlert.title,
            message: selectedAlert.message,
            severity: selectedAlert.severity,
            sendToAll: false,
            recipientEmail,
          }),
        }
      );

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to send email');

      toast({ title: 'Email Sent!', description: `Alert email sent to ${recipientEmail}` });
      setEmailDialogOpen(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to send email', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleBroadcastAlert = async () => {
    if (!broadcastTitle || !broadcastMessage) return;
    setSending(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-alert-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            title: broadcastTitle,
            message: broadcastMessage,
            severity: broadcastSeverity,
            sendToAll: true,
          }),
        }
      );

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to send emails');

      toast({ title: 'Broadcast Sent!', description: `Alert sent to ${result.sent}/${result.total} registered users` });
      setBroadcastDialogOpen(false);
      setBroadcastTitle('');
      setBroadcastMessage('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to broadcast', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Alerts</h1>
          <p className="text-muted-foreground mt-1">System notifications and operational alerts</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="gap-1">
            <Bell className="w-3.5 h-3.5" />
            {unreadCount} unread
          </Badge>
          {isAdmin && (
            <>
              <Button variant="outline" size="sm">Mark all as read</Button>
              <Button size="sm" className="gap-1.5" onClick={() => setBroadcastDialogOpen(true)}>
                <Users className="w-4 h-4" />
                Send Alert to All Users
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {isAdmin && (
          <Card className="shadow-card border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <form onSubmit={handleCreateAlert} className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">Create New Alert</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Alert Title</Label>
                    <Input
                      placeholder="e.g. Schedule Change"
                      value={newAlertTitle}
                      onChange={e => setNewAlertTitle(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Type/Category</Label>
                    <Input
                      placeholder="e.g. Operations, Maintenance"
                      value={newAlertType}
                      onChange={e => setNewAlertType(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Severity</Label>
                    <div className="flex gap-1 h-9">
                      {['info', 'warning', 'error', 'success'].map((s) => (
                        <Button
                          type="button"
                          key={s}
                          variant={newAlertSeverity === s ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setNewAlertSeverity(s)}
                          className="flex-1 capitalize px-0 text-xs"
                        >
                          {s}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Message</Label>
                  <Textarea
                    placeholder="Details about the alert..."
                    value={newAlertMessage}
                    onChange={e => setNewAlertMessage(e.target.value)}
                    rows={2}
                    required
                  />
                </div>
                <Button type="submit" disabled={createAlertMutation.isPending} className="w-full sm:w-auto">
                  {createAlertMutation.isPending ? 'Publishing...' : 'Publish Alert'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground animate-pulse">Loading alerts...</div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No active alerts.</div>
        ) : (
          alerts.map((alert: any) => {
            const config = alertConfig[alert.severity as keyof typeof alertConfig] || alertConfig.info;
            const IconComponent = config.icon;
            return (
              <Card key={alert.id} className={`shadow-card transition-all ${!alert.read ? 'border-l-4 border-l-primary' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={`p-2.5 rounded-lg flex-shrink-0 ${config.iconBg}`}>
                      <IconComponent className={`w-5 h-5 ${config.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className={`font-medium ${!alert.is_read ? 'text-foreground' : 'text-muted-foreground'}`}>{alert.title}</h3>
                          <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={config.badgeClass}>{alert.severity}</Badge>
                          <Badge variant="outline" className="bg-muted text-muted-foreground">{alert.alert_type}</Badge>
                          {isAdmin && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
                                onClick={() => handleDeleteAlert(alert.id)}
                                disabled={deleteAlertMutation.isPending}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5 text-xs"
                                onClick={() => handleOpenEmailDialog(alert)}
                                disabled={sending}
                              >
                                <Mail className="w-3.5 h-3.5" />
                                Email
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(alert.created_at).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Send to specific email */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-primary" />
              Send Alert via Email
            </DialogTitle>
            <DialogDescription>
              Send "{selectedAlert?.title}" to the specified email address.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Recipient Email</Label>
              <Input
                type="email"
                placeholder="Enter recipient email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
              />
            </div>
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-sm font-medium text-foreground">{selectedAlert?.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{selectedAlert?.message}</p>
            </div>
            <div className="flex gap-3">
              <Button onClick={handleSendAlertEmail} className="flex-1 gap-2" disabled={!recipientEmail || sending}>
                <Send className="w-4 h-4" />
                {sending ? 'Sending...' : 'Send Email'}
              </Button>
              <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Broadcast to all users */}
      <Dialog open={broadcastDialogOpen} onOpenChange={setBroadcastDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Broadcast Alert to All Users
            </DialogTitle>
            <DialogDescription>
              This will send an email to all registered users.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Alert Title</Label>
              <Input
                placeholder="Enter alert title"
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                placeholder="Enter alert message..."
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Severity</Label>
              <div className="flex gap-2">
                {['info', 'warning', 'error', 'success'].map((s) => (
                  <Button
                    key={s}
                    variant={broadcastSeverity === s ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setBroadcastSeverity(s)}
                    className="capitalize"
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={handleBroadcastAlert} className="flex-1 gap-2" disabled={!broadcastTitle || !broadcastMessage || sending}>
                <Send className="w-4 h-4" />
                {sending ? 'Sending...' : 'Send to All Users'}
              </Button>
              <Button variant="outline" onClick={() => setBroadcastDialogOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
