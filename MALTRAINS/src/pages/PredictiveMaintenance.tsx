import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Train, Activity, AlertTriangle, ShieldCheck, Thermometer, Battery, Wrench } from "lucide-react";

export const PredictiveMaintenance = () => {
  const parts = [
    { name: "Traction Motor", health: 92, status: "Healthy", icon: Battery, color: "bg-emerald-500" },
    { name: "Braking System", health: 45, status: "Warning", icon: AlertTriangle, color: "bg-amber-500", alert: "Pad wear detected" },
    { name: "Wheel Sets", health: 88, status: "Healthy", icon: ShieldCheck, color: "bg-emerald-500" },
    { name: "HVAC System", health: 15, status: "Critical", icon: Thermometer, color: "bg-red-500", alert: "Coolant leak probable" },
    { name: "Pantograph", health: 78, status: "Healthy", icon: Activity, color: "bg-emerald-500" },
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in relative z-10 w-full overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Activity className="h-8 w-8 text-blue-500" />
            AI Predictive Maintenance
          </h1>
          <p className="text-slate-400 mt-2">Machine learning diagnostics for Loco 20634 (Vande Bharat)</p>
        </div>
        <Badge variant="outline" className="px-4 py-2 border-emerald-500 text-emerald-500 animate-pulse">
          ML Engine Active
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Train className="h-5 w-5 text-blue-400" />
              Engine Diagnostics Wireframe
            </CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center py-10 relative">
             <div className="relative w-full max-w-sm h-[300px] border border-slate-800 rounded-lg overflow-hidden bg-slate-950 flex shadow-inner">
                {/* Simulated Wireframe Map */}
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 hidden"></div>
                
                {/* Train Outline (CSS Drawing) */}
                <div className="absolute top-[30%] left-[10%] w-[80%] h-[40%] border-2 border-slate-700 rounded-3xl z-10"></div>
                <div className="absolute top-[40%] left-[15%] w-[10%] h-[20%] border border-emerald-500 rounded bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
                <div className="absolute top-[70%] left-[25%] w-[10%] h-[15%] border border-red-500 rounded-full bg-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-pulse"></div>
                <div className="absolute top-[70%] left-[65%] w-[10%] h-[15%] border border-amber-500 rounded-full bg-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.5)]"></div>
                <div className="absolute top-[20%] left-[45%] w-[10%] h-[10%] border border-emerald-500 rounded bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>

                <div className="absolute bottom-4 left-4 text-xs text-slate-500 uppercase tracking-widest">Scanning...</div>
             </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Wrench className="h-5 w-5 text-blue-400" />
              Component Health Scores
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {parts.map((part) => (
              <div key={part.name} className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2 font-medium">
                    <part.icon className={`h-4 w-4 ${part.health < 30 ? 'text-red-500' : (part.health < 60 ? 'text-amber-500' : 'text-emerald-500')}`} />
                    {part.name}
                  </div>
                  <span className={part.health < 30 ? 'text-red-500 font-bold' : ''}>{part.health}%</span>
                </div>
                <Progress value={part.health} className={`h-2 ${part.health < 30 ? '[&>div]:bg-red-500' : (part.health < 60 ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500')}`} />
                {part.alert && (
                  <p className="text-xs text-red-400 mt-1 pl-6">↳ {part.alert}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
