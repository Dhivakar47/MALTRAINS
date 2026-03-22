import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Train, Clock, MapPin, Activity, AlertCircle, ArrowRight } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { getKeralaTrainDetails, getRouteForTrain } from '@/lib/keralaTrains';
import { Badge } from '@/components/ui/badge';

export interface TrainData {
  id: string;
  rake_id: string;
  current_status: string;
  current_speed_kmh?: number;
  current_station?: string;
  next_station?: string;
  delay_minutes?: number;
  total_mileage_km?: number;
  currentRun?: any;
}

export const LiveTrainCard = ({ train }: { train: TrainData }) => {
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(train.current_speed_kmh || 0);
  const isDelayed = (train.delay_minutes || 0) > 0;
  const isActive = (train.current_status === 'service_ready' || train.current_status === 'running') && !!train.currentRun?.start_time;

  // Derive Kerala specific data
  const trainDetails = getKeralaTrainDetails(train.rake_id);
  const routeData = getRouteForTrain(trainDetails.name);
  const stations = routeData.stations;

  // Calculate current/next station based on progress
  let currentStation = train.current_station || 'Unknown';
  let nextStation = train.next_station || 'Unknown';

  if (isActive && stations.length > 1) {
    const stationIndex = Math.floor((progress / 100) * (stations.length - 1));
    currentStation = stations[stationIndex].name;
    nextStation = stations[stationIndex + 1]?.name || stations[stations.length - 1].name;
  } else if (!isActive && stations.length > 0) {
    currentStation = stations[0].name;
    nextStation = stations[1]?.name || 'Terminus';
  }

  // Simulate movement based on train run start time
  useEffect(() => {
    const updateTracking = () => {
      if (isActive && train.currentRun?.start_time) {
        const startTime = new Date(train.currentRun.start_time);
        const now = new Date();
        const diffSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        
        // Loop every 300 seconds (5 minutes) for a slower, smooth simulation
        const currentProgress = (diffSeconds % 300) * (100 / 300);
        setProgress(Math.min(100, Math.max(0, currentProgress)));
        
        // Dynamic speed based on active
        setSpeed(60 + (Math.floor(Math.random() * 15)));
      } else {
        setProgress(0);
        setSpeed(0);
      }
    };

    updateTracking();
    const interval = setInterval(updateTracking, 5000);

    return () => clearInterval(interval);
  }, [isActive, train.currentRun]);

  return (
    <div className="bg-background/90 backdrop-blur-md border border-border rounded-lg p-4 space-y-4 shadow-lg hover:border-primary/50 transition-colors">
       {/* Header */}
       <div className="flex justify-between items-start">
         <h4 className="font-semibold text-sm flex items-center gap-2">
           <div className={`p-1.5 rounded-md ${isActive ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
             <Train className="w-4 h-4" />
           </div>
           {train.rake_id}
         </h4>
         {isDelayed ? (
           <span className="text-xs font-bold text-destructive flex items-center gap-1 bg-destructive/10 px-2 py-0.5 rounded-full">
             <AlertCircle className="w-3 h-3" />
             +{train.delay_minutes}m
           </span>
         ) : (
           <span className="text-xs font-bold text-success flex items-center gap-1 bg-success/10 px-2 py-0.5 rounded-full">
             On Time
           </span>
         )}
       </div>
       
       {/* Dynamic Live Track Bar */}
       <div className="space-y-2 py-2">
         <div className="flex justify-between items-center text-xs text-muted-foreground">
           <span className="truncate w-24 text-left font-medium text-foreground">{currentStation}</span>
           <Activity className={`w-3 h-3 ${isActive ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} />
           <span className="truncate w-24 text-right font-medium text-foreground">{nextStation}</span>
         </div>
         
         <div className="relative h-2 w-full bg-muted rounded-full overflow-hidden">
           {/* Animated Track Progress */}
           <div 
             className={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ease-linear ${
               isActive ? 'bg-primary' : 'bg-muted-foreground object-none opacity-30'
             }`}
             style={{ width: `${isActive ? progress : 0}%` }}
           />
           {/* Moving Train Indicator inside the track */}
           {isActive && (
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all duration-1000 ease-linear flex items-center justify-center"
                style={{ left: `calc(${progress}% - 6px)` }}
              >
                <div className="w-1 h-1 bg-primary rounded-full" />
              </div>
           )}
         </div>
       </div>

       <div className="h-px w-full bg-border" />

       {/* Telemetry Stats */}
       <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="flex flex-col">
             <span className="text-muted-foreground mb-1 flex items-center gap-1"><Activity className="w-3 h-3"/> Speed</span>
             <span className="font-medium text-success text-sm">{speed} km/h</span>
          </div>
          <div className="flex flex-col">
             <span className="text-muted-foreground mb-1 flex items-center gap-1"><Train className="w-3 h-3"/> Mileage</span>
             <span className="font-medium text-primary text-sm">{(train.total_mileage_km || 0).toLocaleString()} km</span>
          </div>
          <div className="flex flex-col">
             <span className="text-muted-foreground mb-1 flex items-center gap-1"><Clock className="w-3 h-3"/> Status</span>
             <span className={`font-medium text-sm capitalize ${isActive ? 'text-primary animate-pulse-slow' : 'text-muted-foreground'}`}>
               {(train.current_status || 'Unknown').replace('_', ' ')}
             </span>
          </div>
       </div>
       
       <div className="h-px w-full bg-border" />
       
       {/* Detailed Timeline View */}
       <div className="mt-4 pt-2 border-t border-border/50">
         <h5 className="text-xs font-bold text-muted-foreground uppercase mb-4 flex items-center gap-2">
           <MapPin className="w-3.5 h-3.5" />
           Live Route Tracker
         </h5>
         <div className="relative pl-6 space-y-8 before:absolute before:inset-y-2 before:left-[11px] before:w-0.5 before:bg-muted py-2 pb-6">
            
            {/* Active Track Progress Line */}
            {isActive && (
              <div 
                className="absolute left-[11px] w-0.5 bg-primary top-2 z-0 transition-all duration-1000 ease-linear"
                style={{ height: `calc(${progress}% - 8px)`, maxHeight: 'calc(100% - 16px)' }}
              />
            )}

            {/* Moving Train Engine Icon */}
            {isActive && (
              <div 
                className="absolute left-[2px] w-5 h-5 bg-primary border-2 border-background rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(var(--primary),0.6)] z-20 transition-all duration-1000 ease-linear"
                style={{ top: `calc(${progress}% - 4px)` }}
              >
                <Train className="w-3 h-3 text-primary-foreground" />
              </div>
            )}

            {stations.map((station, idx) => {
              // Calculate if the train has passed this station
              const totalDistance = stations[stations.length - 1].distance;
              const stationProgress = (station.distance / totalDistance) * 100;
              const isPassed = isActive ? progress >= stationProgress : false;
              
              // Find the "current" segment the train is in 
              const nextStationProgress = stations[idx + 1] ? (stations[idx + 1].distance / totalDistance) * 100 : 101;
              const isCurrentSegment = isActive && progress >= stationProgress && progress < nextStationProgress;

              return (
                <div key={station.id} className={`relative transition-opacity duration-500 ${isPassed && !isCurrentSegment ? 'opacity-50' : 'opacity-100'}`}>
                  {/* Timeline Dot / Train Icon */}
                  <div className={`absolute -left-[30px] w-4 h-4 rounded-full border-2 flex items-center justify-center bg-background z-10 transition-colors
                    ${isCurrentSegment ? 'border-primary shadow-[0_0_10px_rgba(var(--primary),0.5)] scale-125' : 
                      isPassed ? 'border-primary/50 bg-primary/20' : 'border-muted'}
                  `}>
                    {isCurrentSegment && <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />}
                  </div>

                  <div className="flex justify-between items-start">
                    <div>
                      <span className={`text-sm font-bold block transition-colors ${isCurrentSegment ? 'text-primary' : 'text-foreground'}`}>
                        {station.name}
                      </span>
                      <span className="text-xs text-muted-foreground font-medium">{station.distance} km</span>
                    </div>
                    
                    <div className="text-right flex flex-col items-end">
                      <span className="text-xs font-bold text-foreground bg-secondary/50 px-2 py-0.5 rounded-md">{station.arrivalTime}</span>
                      {isCurrentSegment && speed > 0 && (
                        <Badge variant="outline" className="mt-1.5 text-[10px] h-5 bg-success/10 text-success border-success/20 animate-pulse border-none">
                          Approaching...
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
         </div>
       </div>
    </div>
  );
};

export const TrainMap = ({ trains = [] }: { trains: TrainData[] }) => {
  return (
    <Card className="shadow-card border-primary/10 h-full w-full bg-background overflow-hidden relative">
      <CardHeader className="absolute top-0 left-0 right-0 z-10 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MapPin className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm">Live Network Telemetry</CardTitle>
          </div>
          <div className="text-xs text-muted-foreground">
            {trains.length} Active Trains
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0 h-full flex flex-col pt-16 relative bg-[#0a0f18] min-h-[300px]">
        {/* Placeholder for SVG Map */}
        <div className="absolute inset-0 opacity-20 pointer-events-none">
            {/* Simple Grid to mimic map background */}
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-primary/20"/>
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
        </div>

        {/* Telemetry Panels Container */}
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 overflow-y-auto h-full z-10">
          {trains.length === 0 ? (
            <div className="col-span-full flex h-32 items-center justify-center text-muted-foreground text-sm">
              No active trains transmitting telemetry at the moment.
            </div>
          ) : (
            trains.map((train) => (
              <LiveTrainCard key={train.id} train={train} />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
