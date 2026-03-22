import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createClient } from '@supabase/supabase-js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users, Clock, CheckCircle2, XCircle, Search, Edit2, X, Check, Plus, Lock, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';


const today = new Date().toISOString().split('T')[0];

export const Attendance = () => {
  const { isAdmin, user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [inputKey, setInputKey] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any>(null);
  const [editCheckIn, setEditCheckIn] = useState('');
  const [editCheckOut, setEditCheckOut] = useState('');
  const [editDate, setEditDate] = useState('');

  // Add Staff Form state
  const [addStaffDialogOpen, setAddStaffDialogOpen] = useState(false);
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('');

  const [absentDialogOpen, setAbsentDialogOpen] = useState(false);
  const [absentReason, setAbsentReason] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

  // Delete Staff Dialog State
  const [deleteStaffDialogOpen, setDeleteStaffDialogOpen] = useState(false);
  const [deleteStaffEmail, setDeleteStaffEmail] = useState('');
  const [deleteStaffPassword, setDeleteStaffPassword] = useState('');
  const [staffToDeleteId, setStaffToDeleteId] = useState<string | null>(null);
  const [isVerifyingDeletion, setIsVerifyingDeletion] = useState(false);

  useEffect(() => {
    const handleBeforeUnload = async () => {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date().toISOString();

      // Attempt to auto-record exit time on tab close
      // Note: This is best-effort as browser may kill process before completion
      await supabase
        .from('staff_attendance')
        .update({ check_out_time: now } as any)
        .eq('status', 'present')
        .is('check_out_time', null)
        .gte('created_at', `${today}T00:00:00Z`);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Fetch staff members joined with today's attendance
  const { data: attendanceData = [], isLoading } = useQuery({
    queryKey: ['attendance', today],
    queryFn: async () => {
      try {
        // 1. Fetch Staff Members first
        const { data: staffData, error: staffError } = await supabase
          .from('staff_members' as any)
          .select('*');

        console.log('Staff Fetch Result:', { staffData, staffError });

        if (staffError) throw staffError;

        if (!staffData || staffData.length === 0) {
          console.warn('No staff members returned from query.');
          return [];
        }

        // 2. Fetch today's attendance records separately to avoid join issues
        const { data: attendData, error: attendError } = await supabase
          .from('staff_attendance' as any)
          .select('*')
          .gte('created_at', `${today}T00:00:00Z`) as { data: any[], error: any };

        if (attendError) console.error('Error fetching attendance records:', attendError);

        return (staffData as any)
          .filter((staff: any) =>
            staff.name !== 'Admin' &&
            staff.role !== 'Admin' &&
            !staff.name?.toLowerCase().includes('admin')
          )
          .map((staff: any) => {
            const todayAttendance = attendData?.find((a: any) => a.employee_id === staff.employee_id);

            const formatAttendanceTime = (timeStr: string | null) => {
              if (!timeStr) return '-';
              return new Date(timeStr).toLocaleTimeString('en-IN', {
                hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
              });
            };

            return {
              id: staff.employee_id,
              dbId: staff.id,
              name: staff.name,
              role: staff.role,
              leaveBalance: staff.leave_balance,
              attendanceId: todayAttendance?.id,
              checkIn: formatAttendanceTime(todayAttendance?.check_in_time),
              checkOut: formatAttendanceTime(todayAttendance?.check_out_time),
              date: today,
              status: todayAttendance?.status || 'unset',
              reason: todayAttendance?.reason || '',
              attendanceKey: staff.attendance_key,
              keyUsed: staff.key_used,
              email: staff.email
            };
          });
      } catch (err: any) {
        console.error('Error fetching attendance data:', err);
        toast({
          title: "Fetch Error",
          description: err.message || "Could not load staff members.",
          variant: "destructive"
        });
        return [];
      }
    }
  });

  const generateKeysMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('generate_daily_keys' as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast({ title: 'Keys Generated', description: "Today's secret keys have been updated." });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  });

  const submitKeyMutation = useMutation({
    mutationFn: async (key: string) => {
      // 1. Find staff with this key for today
      const { data: staff, error: staffError } = await supabase
        .from('staff_members' as any)
        .select('*')
        .eq('attendance_key', key.toUpperCase())
        .eq('key_date', today)
        .maybeSingle() as any;

      if (staffError) throw staffError;
      if (!staff) throw new Error('Invalid secret key for today.');

      const now = new Date().toISOString();

      // 2. Check if already checked in today
      const { data: existingAttendance, error: attendFetchError } = await supabase
        .from('staff_attendance')
        .select('*')
        .eq('employee_id', staff.employee_id)
        .gte('created_at', `${today}T00:00:00Z`)
        .maybeSingle() as any;

      if (attendFetchError) throw attendFetchError;

      if (existingAttendance) {
        if (existingAttendance.check_out_time) {
          throw new Error('Attendance session already completed for today.');
        }
        // Perform Check-Out
        const { error: checkOutError } = await supabase
          .from('staff_attendance')
          .update({ check_out_time: now } as any)
          .eq('id', existingAttendance.id);

        if (checkOutError) throw checkOutError;
        return 'Check-Out recorded successfully.';
      } else {
        // Perform Check-In
        const { error: attendError } = await supabase
          .from('staff_attendance')
          .insert([{
            employee_id: staff.employee_id,
            staff_name: staff.name,
            status: 'present',
            check_in_time: now
          } as any]);

        if (attendError) throw attendError;
        return 'Check-In recorded successfully.';
      }
    },
    onSuccess: (message: string) => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      setInputKey('');
      toast({ title: 'Success', description: message });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  });

  const addStaffMutation = useMutation({
    mutationFn: async () => {
      // Validate that the user email matches a registered Auth User
      const { data: userData, error: rpcError } = await (supabase as any).rpc('get_user_details_by_email', { check_email: newStaffEmail });
      
      if (rpcError) throw new Error("Failed to validate email: " + rpcError.message);
      if (!userData || (userData as any[]).length === 0) {
        throw new Error("Enter the correct email. The user must be registered before they can be added as staff.");
      }

      // Auto-generate name and employee_id
      const generatedName = userData[0].name || newStaffEmail.split('@')[0];
      const generatedId = `EMP${Math.floor(Math.random() * 9000) + 1000}`; // Random 4-digit ID

      const { error } = await supabase
        .from('staff_members' as any)
        .insert([{
          employee_id: generatedId,
          name: generatedName,
          email: newStaffEmail,
          role: newStaffRole,
          leave_balance: 20
        } as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast({ title: 'Staff Added', description: `${newStaffEmail} has been added.` });
      setAddStaffDialogOpen(false);
      setNewStaffEmail('');
      setNewStaffRole('');
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  });

  const deleteStaffMutation = useMutation({
    mutationFn: async (id: string) => {
      // Find the dbId from our mapped array
      const staffMember = attendanceData.find(s => s.id === id);
      if (!staffMember?.dbId) throw new Error("Could not find internal database ID for staff member.");
      
      const { error } = await (supabase as any)
        .from('staff_members')
        .delete()
        .eq('id', staffMember.dbId);
        
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast({ title: 'Staff Deleted', description: 'The staff member has been removed.' });
      setDeleteStaffDialogOpen(false);
      setDeleteStaffEmail('');
      setDeleteStaffPassword('');
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  });

  const handleDeleteConfirm = async () => {
    if (!staffToDeleteId) return;
    setIsVerifyingDeletion(true);
    
    try {
      // Create a temporary client so we don't log out the Admin
      const tempClient = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        { auth: { persistSession: false } }
      );

      // Verify credentials
      const { data, error } = await tempClient.auth.signInWithPassword({
        email: deleteStaffEmail,
        password: deleteStaffPassword
      });

      if (error) {
        throw new Error("Invalid staff email or password. Verification failed.");
      }

      // Credentials verified successfully, proceed with deletion
      deleteStaffMutation.mutate(staffToDeleteId);
    } catch (err: any) {
      toast({ title: "Verification Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsVerifyingDeletion(false);
    }
  };

  const markAttendanceMutation = useMutation({
    mutationFn: async ({ employeeId, status, reason }: { employeeId: string, status: string, reason?: string }) => {
      const staff = attendanceData.find(s => s.id === employeeId);
      const now = new Date().toISOString();

      if (staff.attendanceId && !staff.attendanceId.startsWith('s')) {
        // Update existing record (only if it's a real DB UUID, not a sample ID)
        const { error } = await supabase
          .from('staff_attendance')
          .update({
            status,
            reason: reason !== undefined ? reason : (staff.reason || ''),
            check_in_time: status === 'present' ? now : null,
          } as any)
          .eq('id', staff.attendanceId);
        if (error) throw error;
      } else {
        // Insert new record
        const { error } = await supabase
          .from('staff_attendance')
          .insert([{
            employee_id: employeeId,
            staff_name: staff.name, // Added missing staff_name
            status,
            reason: reason || '',
            check_in_time: status === 'present' ? now : null
          } as any]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast({ title: 'Attendance Updated', description: 'Records successfully updated.' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  });

  const checkOutMutation = useMutation({
    mutationFn: async (attendanceId: string) => {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('staff_attendance')
        .update({ check_out_time: now })
        .eq('id', attendanceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast({ title: 'Check-out Recorded', description: 'Staff successfully checked out.' });
    }
  });

  const presentCount = attendanceData.filter(s => s.status === 'present').length;
  const absentCount = attendanceData.filter(s => s.status === 'absent').length;
  const pendingLeaveCount = attendanceData.filter(s => s.status === 'pending_leave').length;

  const filtered = attendanceData.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.role.toLowerCase().includes(search.toLowerCase())
  );

  const handleRequestLeave = (id: string) => {
    setSelectedStaffId(id);
    setAbsentReason('');
    setAbsentDialogOpen(true);
  };

  const confirmLeaveRequest = () => {
    if (!selectedStaffId) return;
    if (!absentReason.trim()) {
      toast({ title: 'Reason Required', description: 'Please provide a reason for the leave.', variant: 'destructive' });
      return;
    }
    markAttendanceMutation.mutate({ employeeId: selectedStaffId, status: 'pending_leave', reason: absentReason });
    setAbsentDialogOpen(false);
  };

  const handleLeaveDecision = (employeeId: string, decision: 'absent' | 'rejected') => {
    const staff = attendanceData.find(s => s.id === employeeId);
    markAttendanceMutation.mutate({ 
      employeeId, 
      status: decision, 
      reason: staff?.reason || '' 
    });
  };

  const handleEditOpen = (staff: any) => {
    setEditingStaff(staff);
    setEditCheckIn(staff.checkIn === '-' ? '' : staff.checkIn);
    setEditCheckOut(staff.checkOut === '-' ? '' : staff.checkOut);
    setEditDate(staff.date);
    setEditDialogOpen(true);
  };

  const handleEditSave = async () => {
    if (!editingStaff) return;
    if (!isAdmin) {
      if (!inputKey) {
        toast({ title: 'Key Required', description: 'Please enter your secret key.', variant: 'destructive' });
        return;
      }
      submitKeyMutation.mutate(inputKey);
      setEditDialogOpen(false);
      return;
    }
    // For simplicity, we just toast here as full edit would require more complex DB mapping
    toast({ title: 'Feature Coming Soon', description: 'Manual time editing is currently being optimized.' });
    setEditDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Staff Attendance</h1>
            <p className="text-muted-foreground mt-1">Today's attendance records</p>
          </div>
          {isAdmin && pendingLeaveCount > 0 && (
            <Badge variant="destructive" className="h-6 flex items-center justify-center animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]">
              {pendingLeaveCount} Pending Request{pendingLeaveCount > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Button
              variant="outline"
              onClick={() => generateKeysMutation.mutate()}
              disabled={generateKeysMutation.isPending}
              className="gap-2 border-primary/50 text-primary hover:bg-primary/5"
            >
              <Clock className="w-4 h-4" />
              {generateKeysMutation.isPending ? 'Generating...' : 'Generate Today\'s Keys'}
            </Button>
          )}
          {isAdmin && (
            <Button onClick={() => setAddStaffDialogOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Staff Member
            </Button>
          )}
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search staff..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
        </div>
      </div>

      {/* Secret Key Entry Section for Staff */}
      {!isAdmin && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center gap-4 justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <Lock className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Daily Attendance Key</CardTitle>
                  <p className="text-sm text-muted-foreground">Enter your secret 6-digit key to record your presence</p>
                  {attendanceData.find(s => s.name === user?.user_metadata?.display_name || s.name === user?.email?.split('@')[0])?.attendanceKey && (
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        Your Personal Key: <code className="font-bold tracking-widest">{attendanceData.find(s => s.name === user?.user_metadata?.display_name || s.name === user?.email?.split('@')[0])?.attendanceKey}</code>
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex w-full md:w-auto gap-3">
                <Input
                  placeholder="EX: A3X9K2"
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value.toUpperCase())}
                  className="w-full md:w-48 font-mono tracking-widest text-center"
                  maxLength={6}
                />
                <Button
                  onClick={() => submitKeyMutation.mutate(inputKey)}
                  disabled={submitKeyMutation.isPending || !inputKey}
                  className="px-8"
                >
                  {submitKeyMutation.isPending ? 'Validating...' : 'Submit Key'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="shadow-card">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-info/10 rounded-lg"><Users className="w-5 h-5 text-info" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{attendanceData.length}</p>
              <p className="text-sm text-muted-foreground">Total Staff</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-success/10 rounded-lg"><CheckCircle2 className="w-5 h-5 text-success" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{presentCount}</p>
              <p className="text-sm text-muted-foreground">Present</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-destructive/10 rounded-lg"><XCircle className="w-5 h-5 text-destructive" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{absentCount}</p>
              <p className="text-sm text-muted-foreground">Absent</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Table */}
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle>Attendance Log</CardTitle>
              <CardDescription>Staff check-in times for today</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Entry Time</TableHead>
                <TableHead>Exit Time</TableHead>
                <TableHead>Secret Key</TableHead>
                <TableHead>Leave (Days)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground animate-pulse">Loading records...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <Users className="w-8 h-8 text-muted-foreground/30" />
                      <p className="text-muted-foreground">No staff members found.</p>
                      <p className="text-xs text-muted-foreground/60 max-w-xs mx-auto">
                        Please run the SQL sync script in Supabase or add staff members via Admin Settings.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filtered.map((staff) => {
                const isCurrentUser = user && (staff.name === user.user_metadata?.display_name || staff.name === user.email?.split('@')[0]);

                return (
                  <TableRow key={staff.id} className={staff.status === 'absent' ? 'bg-destructive/5' : isCurrentUser ? 'bg-primary/5' : ''}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-foreground">{staff.name}</div>
                        {isCurrentUser && <Badge className="text-[9px] h-3.5 bg-primary/80">You</Badge>}
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase">{staff.id}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{staff.role}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {staff.status === 'absent' ? '-' : staff.checkIn}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {staff.status === 'absent' ? '-' : staff.checkOut}
                    </TableCell>
                    <TableCell>
                      {staff.attendanceKey ? (
                        <div className="flex items-center gap-2">
                          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
                            {isAdmin || isCurrentUser ? staff.attendanceKey : '••••••'}
                          </code>
                          {staff.keyUsed && <Badge variant="outline" className="text-[10px] h-4 bg-success/10 text-success border-success/20">Used</Badge>}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Not generated</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">{staff.leaveBalance}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 items-start">
                        <Badge
                          variant="outline"
                          className={staff.status === 'present'
                            ? 'bg-success/10 text-success border-success/20'
                            : staff.status === 'absent'
                              ? 'bg-destructive/10 text-destructive border-destructive/20'
                              : staff.status === 'pending_leave'
                                ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                : staff.status === 'rejected'
                                  ? 'bg-slate-500/10 text-slate-500 border-slate-500/20'
                                  : 'bg-muted text-muted-foreground'
                          }
                        >
                          {staff.status === 'present' ? 'Present' 
                           : staff.status === 'absent' ? 'Leave Approved' 
                           : staff.status === 'pending_leave' ? 'Pending Leave' 
                           : staff.status === 'rejected' ? 'Leave Rejected'
                           : 'Not Checked In'}
                        </Badge>
                        {(staff.status === 'absent' || staff.status === 'pending_leave' || staff.status === 'rejected') && staff.reason && (
                          <span className="text-xs text-muted-foreground w-32 truncate" title={staff.reason}>
                            Reason: {staff.reason}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isAdmin && staff.status === 'present' && staff.checkOut === '-' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => checkOutMutation.mutate(staff.attendanceId)}
                            className="text-xs h-7"
                            disabled={checkOutMutation.isPending}
                          >
                            Check Out
                          </Button>
                        )}
                        {isAdmin && staff.status === 'pending_leave' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleLeaveDecision(staff.id, 'absent')}
                              className="text-xs h-7 bg-success/10 text-success border-success/30 hover:bg-success/20"
                            >
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleLeaveDecision(staff.id, 'rejected')}
                              className="text-xs h-7 ml-1 bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20"
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const staffMember = attendanceData.find(s => s.id === staff.id);
                              setDeleteStaffEmail(staffMember?.email || '');
                              setStaffToDeleteId(staff.id);
                              setDeleteStaffDialogOpen(true);
                            }}
                            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            title="Delete Staff"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                        {!isAdmin && isCurrentUser && staff.status !== 'present' && staff.status !== 'pending_leave' && staff.status !== 'absent' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingStaff(staff);
                                setInputKey(''); // Clear previous input
                                setEditDialogOpen(true);
                              }}
                              className="text-xs h-7 border-primary/30 text-primary hover:bg-primary/5"
                            >
                              Log Present
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRequestLeave(staff.id)}
                              className="text-xs h-7 ml-1 text-amber-500 hover:text-amber-400 hover:bg-amber-500/10"
                            >
                              Request Leave
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Staff Dialog */}
      <Dialog open={addStaffDialogOpen} onOpenChange={setAddStaffDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              Add New Staff Member
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input placeholder="employee@example.com" value={newStaffEmail} onChange={(e) => setNewStaffEmail(e.target.value)} type="email" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Input placeholder="Operator" value={newStaffRole} onChange={(e) => setNewStaffRole(e.target.value)} />
            </div>
            <div className="flex gap-3">
              <Button onClick={() => addStaffMutation.mutate()} disabled={addStaffMutation.isPending} className="flex-1">
                {addStaffMutation.isPending ? 'Adding...' : 'Add Staff'}
              </Button>
              <Button variant="outline" onClick={() => setAddStaffDialogOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Attendance Record Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isAdmin ? <Edit2 className="w-5 h-5 text-primary" /> : <Lock className="w-5 h-5 text-primary" />}
              {isAdmin
                ? `Edit Attendance — ${editingStaff?.name}`
                : `${editingStaff?.checkIn === '-' ? 'Record Your Check-In' : 'Record Your Check-Out'} — ${editingStaff?.name}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {isAdmin ? (
              <>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Entry Time (Check-In)</Label>
                  <Input type="text" placeholder="e.g. 06:30 AM" value={editCheckIn} onChange={(e) => setEditCheckIn(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Exit Time (Check-Out)</Label>
                  <Input type="text" placeholder="e.g. 03:30 PM" value={editCheckOut} onChange={(e) => setEditCheckOut(e.target.value)} />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between items-center mb-1">
                  <Label>Daily Attendance Key</Label>
                  <span className="text-[10px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                    Your Key: {editingStaff?.attendanceKey || 'N/A'}
                  </span>
                </div>
                <Input
                  placeholder="EX: A3X9K2"
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value.toUpperCase())}
                  className="font-mono tracking-widest text-center"
                  maxLength={6}
                />
                <p className="text-xs text-muted-foreground">
                  Confirm your identity and current time by entering the 6-character key above.
                </p>
              </div>
            )}
            <div className="flex gap-3">
              <Button onClick={handleEditSave} className="flex-1 gap-2" disabled={submitKeyMutation.isPending}>
                <Check className="w-4 h-4" />
                {isAdmin ? 'Save Changes' : (submitKeyMutation.isPending ? 'Verifying...' : 'Submit Key')}
              </Button>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)} className="gap-2">
                <X className="w-4 h-4" />
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Security Verification Dialog for Deletion */}
      <Dialog open={deleteStaffDialogOpen} onOpenChange={setDeleteStaffDialogOpen}>
        <DialogContent className="sm:max-w-md border-destructive/20 bg-background/95 backdrop-blur-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Lock className="w-5 h-5" />
              Verify Deletion
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              To delete this staff member, please enter their credentials to verify the action.
            </p>
            <div className="space-y-2">
              <Label>Staff Email</Label>
              <Input 
                type="email" 
                value={deleteStaffEmail} 
                onChange={(e) => setDeleteStaffEmail(e.target.value)}
                placeholder="employee@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Staff Password</Label>
              <Input 
                type="password" 
                value={deleteStaffPassword} 
                onChange={(e) => setDeleteStaffPassword(e.target.value)}
                placeholder="Enter staff's password"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button 
                variant="outline" 
                onClick={() => setDeleteStaffDialogOpen(false)} 
                className="flex-1"
                disabled={isVerifyingDeletion || deleteStaffMutation.isPending}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleDeleteConfirm} 
                disabled={isVerifyingDeletion || deleteStaffMutation.isPending || !deleteStaffPassword || !deleteStaffEmail} 
                className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isVerifyingDeletion || deleteStaffMutation.isPending ? 'Verifying...' : 'Verify & Delete'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Absent Reason Dialog */}
      <Dialog open={absentDialogOpen} onOpenChange={setAbsentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-amber-500" />
              Request Leave
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Reason for Leave (Required)</Label>
              <Input
                placeholder="e.g. Sick Leave, Vacation, Personal Emergency"
                value={absentReason}
                onChange={(e) => setAbsentReason(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <Button onClick={confirmLeaveRequest} className="flex-1 gap-2 bg-amber-500 hover:bg-amber-600 text-white">
                <Check className="w-4 h-4" />
                Submit Request
              </Button>
              <Button variant="outline" onClick={() => setAbsentDialogOpen(false)} className="gap-2">
                <X className="w-4 h-4" />
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
