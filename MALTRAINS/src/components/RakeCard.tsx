import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Hash, Gauge, Calendar, Zap, Activity, CheckCircle, AlertCircle, ShieldAlert, ShieldCheck, Users, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { getKeralaTrainDetails } from '@/lib/keralaTrains';

interface RakeCardProps {
  rakeId: string;
  route: string;
  bayNumber: number;
  mileage: number;
  avgDailyKm?: number;
  status: 'running' | 'maintenance' | 'stopped';
  fitnessStatus?: 'valid' | 'expired' | 'expiring';
  expiryDate?: string;
  currentRun?: any;
  currentUserId?: string;
  isAdmin?: boolean;
  onStartRun?: (rakeId: string) => void;
  onStopRun?: (rakeId: string) => void;
  isRunLoading?: boolean;
  operatorName?: string;
  className?: string;
}

const statusConfig = {
  running: {
    label: 'Running',
    dotClass: 'status-running',
    badgeClass: 'bg-success/10 text-success border-success/20',
    icon: <Activity className="w-5 h-5 text-success animate-pulse" />,
  },
  maintenance: {
    label: 'Maintenance',
    dotClass: 'status-maintenance',
    badgeClass: 'bg-warning/10 text-warning border-warning/20',
    icon: <Wrench className="w-5 h-5 text-warning" />,
  },
  stopped: {
    label: 'Standby',
    dotClass: 'status-stopped',
    badgeClass: 'bg-destructive/10 text-destructive border-destructive/20',
    icon: <AlertCircle className="w-5 h-5 text-destructive" />,
  },
};

export const RakeCard = ({
  rakeId,
  route,
  bayNumber,
  mileage,
  avgDailyKm,
  status,
  fitnessStatus,
  expiryDate,
  currentRun,
  currentUserId,
  isAdmin,
  onStartRun,
  onStopRun,
  isRunLoading,
  operatorName,
  className
}: RakeCardProps) => {
  const config = statusConfig[status];
  const trainDetails = getKeralaTrainDetails(rakeId);

  return (
    <Card className={cn("shadow-card hover:shadow-card-hover transition-all hover:-translate-y-0.5 relative overflow-hidden group", className)}>
      {/* Fitness "Logo" Indicator */}
      {fitnessStatus && (
        <div className={cn(
          "absolute top-0 right-0 p-2 z-10 rounded-bl-xl border-b border-l",
          fitnessStatus === 'valid' ? "bg-success/10 text-success border-success/20" :
            fitnessStatus === 'expired' ? "bg-destructive/10 text-destructive border-destructive/20" :
              "bg-warning/10 text-warning border-warning/20"
        )}>
          {fitnessStatus === 'valid' ? <ShieldCheck className="w-5 h-5" /> :
            fitnessStatus === 'expired' ? <ShieldAlert className="w-5 h-5" /> :
              <AlertCircle className="w-5 h-5" />}
        </div>
      )}

      <CardHeader className="pb-3 border-b bg-secondary/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Operational Logo */}
            <div className={cn("p-1.5 rounded-lg bg-background shadow-sm border",
              status === 'running' ? "border-success/30" : "border-border")}>
              {config.icon}
            </div>
            <div>
              <h3 className="font-bold text-foreground tracking-tight text-lg leading-tight">{trainDetails.name}</h3>
              <p className="text-xs text-muted-foreground font-medium mb-1">({trainDetails.id}) • {rakeId}</p>
              <div className="flex items-center gap-1.5">
                <span className={cn('status-dot w-2 h-2', config.dotClass)} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{config.label}</span>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <span className="text-[10px] text-muted-foreground uppercase font-bold">Location/Route</span>
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <MapPin className="w-3.5 h-3.5 text-primary/60" />
              <span className="truncate">{trainDetails.route}</span>
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-muted-foreground uppercase font-bold">Stabling</span>
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <Hash className="w-3.5 h-3.5 text-info/60" />
              <span>Bay {bayNumber}</span>
            </div>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-secondary/20 space-y-2 border border-border/50 shadow-inner">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-warning" />
              <span className="font-bold text-base">{mileage.toLocaleString()} km</span>
            </div>
            {avgDailyKm && avgDailyKm > 0 && (
              <Badge variant="secondary" className="text-[9px] font-black h-5 px-1.5 bg-secondary text-secondary-foreground border-none">
                <Zap className="w-2.5 h-2.5 mr-1" />
                +{avgDailyKm}km/day
              </Badge>
            )}
          </div>
          <div className="w-full bg-secondary/50 rounded-full h-1.5 overflow-hidden">
            <div
              className={cn("h-full transition-all duration-500",
                mileage >= 5000 ? "bg-destructive" : mileage >= 4000 ? "bg-warning" : "bg-success"
              )}
              style={{ width: `${Math.min((mileage / 5000) * 100, 100)}%` }}
            />
          </div>
        </div>

        {expiryDate && (
          <div className={cn(
            "flex items-center justify-between p-2 rounded border text-[11px] font-medium transition-colors",
            fitnessStatus === 'valid' ? "bg-success/5 border-success/10 text-success/80" :
              fitnessStatus === 'expired' ? "bg-destructive/5 border-destructive/10 text-destructive/80" :
                "bg-warning/5 border-warning/10 text-warning/80"
          )}>
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5" />
              <span>Fitness Expiry:</span>
            </div>
            <span className="font-bold">{format(new Date(expiryDate), 'MMM dd, yyyy')}</span>
          </div>
        )}

        {mileage >= 5000 && (
          <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md p-2 flex items-center gap-2 animate-pulse">
            <ShieldAlert className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-tighter">Maintenance Mandatory (Threshold met)</span>
          </div>
        )}

        {/* Train Run Controls */}
        <div className="pt-2 border-t flex justify-between items-center bg-background/50 -mx-6 -mb-6 p-4">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Operations</span>
            {operatorName && (
              <div className="text-[10px] text-primary font-bold mt-0.5 flex items-center gap-1">
                <Users className="w-3 h-3" />
                <span>{operatorName}</span>
              </div>
            )}
            {isAdmin && currentRun && !operatorName && (
              <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                <span className="font-semibold text-foreground/80">{currentRun.user_email}</span><br/>
                <span>since {format(new Date(currentRun.start_time), 'HH:mm')}</span>
              </div>
            )}
          </div>
          {currentRun ? (
            (currentUserId === currentRun.user_id || isAdmin) ? (
              <button 
                onClick={(e) => { e.stopPropagation(); onStopRun?.(rakeId); }}
                disabled={isRunLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20 rounded-md text-xs font-bold uppercase transition-colors"
              >
                Stop Now
              </button>
            ) : (
              <button 
                disabled
                className="flex items-center gap-1.5 px-3 py-1.5 bg-muted text-muted-foreground border border-border rounded-md text-xs font-bold uppercase cursor-not-allowed"
              >
                In Use
              </button>
            )
          ) : (
             mileage < 5000 && status !== 'maintenance' ? (
               <button 
                onClick={(e) => { e.stopPropagation(); onStartRun?.(rakeId); }}
                disabled={isRunLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-success/10 text-success hover:bg-success/20 border border-success/20 rounded-md text-xs font-bold uppercase transition-colors"
              >
                Start Run
              </button>
             ) : (
               <div className="text-[10px] font-bold text-destructive flex items-center gap-1 bg-destructive/5 px-2 py-1 rounded">
                 <ShieldAlert className="w-3 h-3" />
                 <span>Action Required</span>
               </div>
             )
          )}
        </div>
      </CardContent>
    </Card>
  );
};
