import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, AlertOctagon, CheckCircle2 } from "lucide-react";

export const CrewRostering = () => {
  const crew = [
    { name: "Rajesh K.", role: "Sr. Loco Pilot", hoursWorked: 6, status: "Active", risk: "Low" },
    { name: "Suresh M.", role: "Asst. Loco Pilot", hoursWorked: 11, status: "Off Duty (Forced)", risk: "Critical" },
    { name: "Anita V.", role: "Train Manager", hoursWorked: 8, status: "Active", risk: "Medium" },
    { name: "Kumar D.", role: "Loco Pilot", hoursWorked: 2, status: "Active", risk: "Low" }
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in relative z-10 w-full overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Users className="h-8 w-8 text-blue-500" />
            AI Crew Rostering
          </h1>
          <p className="text-slate-400 mt-2">Automated fatigue management and compliance tracking</p>
        </div>
        <Badge variant="outline" className="px-4 py-2 border-red-500/50 text-red-400 bg-red-500/10">
          <AlertOctagon className="w-4 h-4 mr-2 inline" />
          1 Fatigue Violation Prevented
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
         <Card className="bg-slate-900/50 border-emerald-500/30 backdrop-blur-md text-emerald-400">
           <CardContent className="p-6">
             <div className="flex items-center gap-4">
               <div className="p-3 bg-emerald-500/10 rounded-lg">
                 <CheckCircle2 className="h-6 w-6" />
               </div>
               <div>
                 <div className="text-2xl font-bold text-white">42</div>
                 <div className="text-xs uppercase tracking-wider">Available Crew</div>
               </div>
             </div>
           </CardContent>
         </Card>
      </div>

      <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-400" />
            Active Duty Roster
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {crew.map((member) => (
              <div key={member.name} className={`flex items-center justify-between p-4 rounded-lg border ${member.risk === 'Critical' ? 'bg-red-950/30 border-red-900/50' : 'bg-slate-950/50 border-slate-800'}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${member.risk === 'Critical' ? 'bg-red-600' : 'bg-blue-600'}`}>
                    {member.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{member.name}</h3>
                    <p className="text-xs text-slate-400">{member.role}</p>
                  </div>
                </div>
                
                <div className="text-right">
                   <div className="text-sm font-bold text-white mb-1"><Clock className="inline w-3 h-3 mr-1"/>{member.hoursWorked}h Duty Time</div>
                   {member.risk === 'Critical' ? (
                     <Badge variant="destructive" className="text-[10px]">FATIGUE LIMIT REACHED</Badge>
                   ) : (
                     <Badge className="bg-emerald-500/20 text-emerald-400 border-none text-[10px]">COMPLIANT</Badge>
                   )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
