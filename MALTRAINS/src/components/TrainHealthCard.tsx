import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Thermometer, Gauge, Battery, DoorOpen, DoorClosed, AlertTriangle, CheckCircle, Activity, Train } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getKeralaTrainDetails } from '@/lib/keralaTrains';

interface TrainHealthCardProps {
  rakeId: string;
  className?: string;
}

// Deterministic random number generator based on string seed
function seededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  return function() {
    h = Math.imul(h ^ h >>> 16, 2246822507);
    h = Math.imul(h ^ h >>> 13, 3266489909);
    return (h ^= h >>> 16) >>> 0;
  }
}

export const TrainHealthCard = ({ rakeId, className }: TrainHealthCardProps) => {
  const trainDetails = getKeralaTrainDetails(rakeId);
  
  // Generate stable mock data based on rakeId
  const rng = seededRandom(rakeId)();
  
  // Ensure we get varied data, matching the user's examples (e.g., Rake-01: 91%, Rake-02: 78%, Rake-03: 62%)
  let healthScore = 85 + (rng % 15); // Default high
  if (rakeId.includes('03')) healthScore = 62;
  else if (rakeId.includes('02')) healthScore = 78;
  else if (rakeId.includes('01')) healthScore = 91;
  else if (rng % 10 === 0) healthScore = 55 + (rng % 15); // Occasional low score

  const isWarning = healthScore < 70;
  
  // Specific indicators based on the score + randomness
  const motorTemp = 60 + (rng % 30) + (isWarning ? 20 : 0); // ~60-90 normal, higher if warning
  const brakePressure = 4.5 + ((rng % 10) / 10) - (isWarning ? 1.5 : 0); // Bar
  const batteryLevel = isWarning ? 45 + (rng % 20) : 85 + (rng % 15);
  const doorsOkay = rng % 20 !== 0; // Rare door issue
  
  const tempStatus = motorTemp > 95 ? 'critical' : motorTemp > 85 ? 'warning' : 'good';
  const brakeStatus = brakePressure < 3.5 ? 'critical' : 'good';
  const batteryStatus = batteryLevel < 50 ? 'warning' : 'good';

  return (
    <Card className={cn(
      "shadow-card hover:shadow-card-hover transition-all hover:-translate-y-0.5 relative overflow-hidden group border",
      isWarning ? "border-destructive/50" : "border-border",
      className
    )}>
      <CardHeader className={cn(
        "pb-3 border-b",
        isWarning ? "bg-destructive/10" : "bg-secondary/10"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("p-1.5 rounded-lg bg-background shadow-sm border",
              isWarning ? "border-destructive/30 text-destructive" : "border-success/30 text-success"
            )}>
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground tracking-tight text-lg leading-tight flex items-center gap-2">
                {trainDetails.name}
              </h3>
              <p className="text-xs text-muted-foreground font-medium mb-1">({trainDetails.id}) • {rakeId}</p>
            </div>
          </div>
          
          <div className="flex flex-col items-end">
             <div className="flex items-center gap-1.5 mb-1">
                {isWarning && <AlertTriangle className="w-4 h-4 text-destructive animate-pulse" />}
                <span className={cn(
                  "text-2xl font-black tracking-tighter",
                  isWarning ? "text-destructive" : "text-success"
                )}>
                  {healthScore}%
                </span>
             </div>
             <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Health Score</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
         {isWarning && (
            <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md p-2 flex items-start gap-2 text-xs font-medium">
               <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
               <p>Component degradation detected. Immediate diagnostic review recommended before next dispatch.</p>
            </div>
         )}
         
        <div className="grid grid-cols-2 gap-3">
          {/* Motor Temperature */}
          <div className={cn(
             "p-3 rounded-lg border flex items-center justify-between",
             tempStatus === 'critical' ? "bg-destructive/10 border-destructive/20" :
             tempStatus === 'warning' ? "bg-warning/10 border-warning/20" :
             "bg-secondary/20 border-border/50"
          )}>
             <div className="flex items-center gap-2">
                <div className={cn("p-1.5 rounded-md", 
                   tempStatus === 'critical' ? "bg-destructive/20 text-destructive" :
                   tempStatus === 'warning' ? "bg-warning/20 text-warning" :
                   "bg-background text-muted-foreground"
                )}>
                  <Thermometer className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                   <span className="text-[10px] font-bold uppercase text-muted-foreground">Motor Temp</span>
                   <span className={cn("text-sm font-bold", 
                      tempStatus === 'critical' ? "text-destructive" :
                      tempStatus === 'warning' ? "text-warning" :
                      "text-foreground"
                   )}>{motorTemp}°C</span>
                </div>
             </div>
          </div>

          {/* Brake Pressure */}
          <div className={cn(
             "p-3 rounded-lg border flex items-center justify-between",
             brakeStatus === 'critical' ? "bg-destructive/10 border-destructive/20" : "bg-secondary/20 border-border/50"
          )}>
             <div className="flex items-center gap-2">
                <div className={cn("p-1.5 rounded-md", 
                   brakeStatus === 'critical' ? "bg-destructive/20 text-destructive" : "bg-background text-muted-foreground"
                )}>
                  <Gauge className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                   <span className="text-[10px] font-bold uppercase text-muted-foreground">Brake Press</span>
                   <span className={cn("text-sm font-bold", 
                      brakeStatus === 'critical' ? "text-destructive" : "text-foreground"
                   )}>{brakePressure.toFixed(1)} Bar</span>
                </div>
             </div>
          </div>

          {/* Battery Level */}
          <div className={cn(
             "p-3 rounded-lg border flex items-center justify-between",
             batteryStatus === 'warning' ? "bg-warning/10 border-warning/20" : "bg-secondary/20 border-border/50"
          )}>
             <div className="flex items-center gap-2">
                <div className={cn("p-1.5 rounded-md", 
                   batteryStatus === 'warning' ? "bg-warning/20 text-warning" : "bg-background text-muted-foreground"
                )}>
                  <Battery className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                   <span className="text-[10px] font-bold uppercase text-muted-foreground">Battery</span>
                   <span className={cn("text-sm font-bold", 
                      batteryStatus === 'warning' ? "text-warning" : "text-foreground"
                   )}>{batteryLevel}%</span>
                </div>
             </div>
          </div>

          {/* Door Status */}
          <div className={cn(
             "p-3 rounded-lg border flex items-center justify-between",
             !doorsOkay ? "bg-destructive/10 border-destructive/20" : "bg-secondary/20 border-border/50"
          )}>
             <div className="flex items-center gap-2">
                <div className={cn("p-1.5 rounded-md", 
                   !doorsOkay ? "bg-destructive/20 text-destructive" : "bg-background text-muted-foreground"
                )}>
                  {doorsOkay ? <DoorClosed className="w-4 h-4" /> : <DoorOpen className="w-4 h-4" />}
                </div>
                <div className="flex flex-col">
                   <span className="text-[10px] font-bold uppercase text-muted-foreground">Doors</span>
                   <span className={cn("text-sm font-bold", 
                      !doorsOkay ? "text-destructive" : "text-success"
                   )}>{doorsOkay ? 'Secured' : 'Fault'}</span>
                </div>
             </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
