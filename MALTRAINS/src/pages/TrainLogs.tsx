import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { format, differenceInMinutes, startOfDay, endOfDay } from 'date-fns';
import { PlayCircle, StopCircle, Clock, Train as TrainIcon, Mail, Loader2, CalendarIcon, MapPin, User, Building, Phone, Hash } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getKeralaTrainDetails } from '@/lib/keralaTrains';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export const TrainLogs = () => {
  const [dateFilter, setDateFilter] = useState<Date | undefined>(new Date());
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const { data: logs, isLoading } = useQuery({
    queryKey: ['admin-train-logs', dateFilter?.toISOString()],
    queryFn: async () => {
      let query = (supabase as any)
        .from('train_runs')
        .select(`
          *,
          trainsets (rake_id)
        `)
        .order('created_at', { ascending: false });

      if (dateFilter) {
        query = query
          .gte('created_at', startOfDay(dateFilter).toISOString())
          .lte('created_at', endOfDay(dateFilter).toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      
      const logsData = (data || []) as any[];
      const userIds = [...new Set(logsData.map(d => d.user_id).filter(Boolean))];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('user_id, full_name, employee_id, department, phone_number, designation')
          .in('user_id', userIds);
          
        const profileMap = (profiles || []).reduce((acc: any, prof: any) => {
          acc[prof.user_id] = prof;
          return acc;
        }, {});
        
        return logsData.map(log => ({
          ...log,
          userProfile: profileMap[log.user_id] || null
        }));
      }

      return logsData;
    }
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Train Operations Logs</h1>
        <p className="text-muted-foreground mt-1">Audit trail of who operated which trains and when.</p>
      </div>

      <Card className="shadow-card overflow-hidden">
        <CardHeader className="bg-secondary/5 border-b flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrainIcon className="w-5 h-5 text-primary" />
              Operator History
            </CardTitle>
            <CardDescription>All recorded train run sessions by staff members.</CardDescription>
          </div>
          <div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[240px] justify-start text-left font-normal", !dateFilter && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFilter ? format(dateFilter, "PPP") : <span>Filter by Date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={dateFilter}
                  onSelect={setDateFilter}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Kerala Train & Route</TableHead>
                  <TableHead>Operator</TableHead>
                  <TableHead>Started At</TableHead>
                  <TableHead>Ended At</TableHead>
                  <TableHead>Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No train operation logs found.
                    </TableCell>
                  </TableRow>
                ) : (
                  logs?.map((log: any) => {
                    const durationMins = log.end_time 
                      ? differenceInMinutes(new Date(log.end_time), new Date(log.start_time))
                      : differenceInMinutes(new Date(), new Date(log.start_time));

                    return (
                      <TableRow key={log.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell>
                          {log.status === 'active' ? (
                            <Badge variant="outline" className="bg-success/10 text-success border-success/20 animate-pulse">
                              <PlayCircle className="w-3 h-3 mr-1" /> Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-secondary text-secondary-foreground">
                              <StopCircle className="w-3 h-3 mr-1" /> Completed
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-semibold text-foreground">
                          {log.trainsets?.rake_id ? (
                            <div className="flex flex-col">
                              <span className="text-sm font-bold">{getKeralaTrainDetails(log.trainsets.rake_id).name}</span>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <MapPin className="w-3 h-3"/> {getKeralaTrainDetails(log.trainsets.rake_id).route}
                              </span>
                            </div>
                          ) : 'Unknown'}
                        </TableCell>
                        <TableCell>
                          <button 
                            onClick={() => setSelectedUser(log.userProfile ? {...log.userProfile, user_email: log.user_email} : { user_id: log.user_id, user_email: log.user_email })}
                            className="flex items-center gap-3 text-sm text-left hover:text-primary transition-colors focus:outline-none w-full p-1 rounded-md hover:bg-muted/50"
                          >
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shadow-sm">
                              {log.userProfile?.full_name ? log.userProfile.full_name.charAt(0).toUpperCase() : <User className="w-4 h-4"/>}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-foreground hover:underline transition-all">{log.userProfile?.full_name || 'Unknown User'}</span>
                              <span className="text-[10px] uppercase font-bold text-muted-foreground hidden sm:inline-block tracking-wider">
                                {log.userProfile ? log.userProfile.designation || 'Staff Member' : log.user_email}
                              </span>
                            </div>
                          </button>
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {format(new Date(log.start_time), 'MMM dd, HH:mm')}
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.end_time 
                            ? format(new Date(log.end_time), 'MMM dd, HH:mm') 
                            : <span className="text-muted-foreground italic">Running...</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Clock className="w-3.5 h-3.5" />
                            {durationMins} min
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="sm:max-w-md bg-background border-border shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <User className="w-5 h-5 text-primary" />
              Operator Profile
            </DialogTitle>
            <DialogDescription>
              Details for the staff member who operated this run.
            </DialogDescription>
          </DialogHeader>
          
          {selectedUser && (
            <div className="space-y-4 pt-4">
              <div className="flex items-center gap-4 border-b pb-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold shadow-sm border border-primary/20">
                  {selectedUser.full_name ? selectedUser.full_name.charAt(0).toUpperCase() : <User className="w-8 h-8"/>}
                </div>
                <div>
                  <h3 className="text-xl font-bold line-clamp-1">{selectedUser.full_name || 'Unknown User'}</h3>
                  <p className="text-sm font-semibold text-primary uppercase tracking-wider">{selectedUser.designation || 'Staff Member'}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-3 text-sm">
                <div className="flex items-center gap-3 p-3 rounded-md bg-secondary/20 border border-border/50">
                  <Hash className="w-4 h-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Employee ID</span>
                    <span className="font-bold">{selectedUser.employee_id || 'N/A'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-md bg-secondary/20 border border-border/50">
                  <Building className="w-4 h-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Department</span>
                    <span className="font-bold">{selectedUser.department || 'N/A'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-md bg-secondary/20 border border-border/50">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Email Address</span>
                    <span className="font-bold">{selectedUser.user_email || 'Hidden'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-md bg-secondary/20 border border-border/50">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Phone Number</span>
                    <span className="font-bold">{selectedUser.phone_number || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
