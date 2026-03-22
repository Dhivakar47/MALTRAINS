import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Map, AlertTriangle, Play, Pause } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export const LiveMap = () => {
  const [incidentActive, setIncidentActive] = useState(false);

  return (
    <div className="p-6 space-y-6 animate-fade-in relative z-10 w-full overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Map className="h-8 w-8 text-blue-500" />
            Live Incident & Collision Map
          </h1>
          <p className="text-slate-400 mt-2">Real-time geographical tracking and automated crisis management</p>
        </div>
        <Button 
          variant={incidentActive ? "destructive" : "default"}
          onClick={() => setIncidentActive(!incidentActive)}
          className="gap-2"
        >
          {incidentActive ? <Pause className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {incidentActive ? "Resolve Incident" : "Trigger Demo Incident"}
        </Button>
      </div>

      <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-md overflow-hidden">
          <CardHeader className="border-b border-slate-800 bg-slate-900/80">
            <div className="flex justify-between items-center">
              <CardTitle className="text-xl flex items-center gap-2">
                Regional Sector view
              </CardTitle>
              {incidentActive && <Badge variant="destructive" className="animate-pulse">CRITICAL: TRACK OBSTRUCTION</Badge>}
            </div>
          </CardHeader>
          <CardContent className="p-0 relative h-[600px] bg-[#0f172a]">
             {/* Map Mockup Background */}
             <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #1e293b 0%, #0f172a 100%)' }}></div>
             
             {/* Rail Network Lines */}
             <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
               <path d="M 100,500 L 300,400 L 500,200 L 800,100" stroke="#334155" strokeWidth="4" fill="none" />
               <path d="M 100,100 L 400,300 L 800,500" stroke="#334155" strokeWidth="4" strokeDasharray="5,5" fill="none" />
             </svg>

             {/* Stations */}
             <div className="absolute top-[80px] left-[80px] w-4 h-4 rounded-full bg-slate-500"></div>
             <div className="absolute top-[180px] left-[500px] w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center ring-4 ring-blue-500/20"><span className="text-[8px] font-bold text-white mb-6">HQ</span></div>

             {/* Incident Zone */}
             {incidentActive && (
               <div className="absolute top-[350px] left-[250px] w-24 h-24 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center animate-ping z-10">
               </div>
             )}
             {incidentActive && (
                 <div className="absolute top-[375px] left-[275px] w-12 h-12 bg-red-600 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(220,38,38,0.8)] z-20">
                     <AlertTriangle className="text-white h-6 w-6" />
                 </div>
             )}

             {/* Trains */}
             <div className="absolute top-[480px] left-[150px] bg-slate-800 border border-slate-700 p-2 rounded-lg shadow-xl shadow-black/50 transition-all duration-1000 z-30 flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${incidentActive ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                <div className="text-xs font-bold text-white">TRN-06441</div>
                {incidentActive && <span className="text-[10px] text-red-500 font-bold ml-2 border border-red-500/50 bg-red-500/10 px-1 rounded">HALTED</span>}
             </div>

             <div className="absolute top-[150px] left-[650px] bg-slate-800 border border-slate-700 p-2 rounded-lg shadow-xl shadow-black/50 transition-all duration-1000 z-30 flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${incidentActive ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>
                <div className="text-xs font-bold text-white">TRN-20634</div>
                {incidentActive && <span className="text-[10px] text-amber-500 font-bold ml-2 border border-amber-500/50 bg-amber-500/10 px-1 rounded">REROUTING</span>}
             </div>

          </CardContent>
      </Card>
    </div>
  );
};
