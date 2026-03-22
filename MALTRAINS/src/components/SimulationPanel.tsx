import { useState } from 'react';
import { Play, RotateCcw, Save, Trash2, Plus, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';

export const SimulationPanel = () => {
    const [planDate, setPlanDate] = useState(new Date().toISOString().split('T')[0]);
    const [excludedTrainsets, setExcludedTrainsets] = useState<string[]>([]);
    const [forcedInductions, setForcedInductions] = useState<string[]>([]);
    const [isSimulating, setIsSimulating] = useState(false);
    const [simulationResult, setSimulationResult] = useState<any>(null);
    const { toast } = useToast();

    const { data: trainsets = [] } = useQuery({
        queryKey: ['trainsets'],
        queryFn: async () => {
            const { data, error } = await supabase.from('trainsets').select('*').order('rake_id');
            if (error) throw error;
            return data;
        }
    });

    const runSimulation = async () => {
        setIsSimulating(true);
        try {
            const { data, error } = await supabase.functions.invoke('what-if-simulation', {
                body: {
                    plan_date: planDate,
                    overrides: {
                        exclude_trainset_ids: excludedTrainsets,
                        force_induction_ids: forcedInductions
                    }
                }
            });

            if (error) throw error;
            setSimulationResult(data);
            toast({
                title: 'Simulation Complete',
                description: 'New induction strategy calculated successfully.',
            });
        } catch (error: any) {
            console.error('Simulation error:', error);
            toast({
                title: 'Simulation Failed',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setIsSimulating(false);
        }
    };

    const resetSimulation = () => {
        setExcludedTrainsets([]);
        setForcedInductions([]);
        setSimulationResult(null);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <Card className="lg:col-span-1 shadow-card border-primary/10">
                <CardHeader>
                    <CardTitle>Simulation Parameters</CardTitle>
                    <CardDescription>Adjust variables to see impact on induction</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="planDate">Target Date</Label>
                        <Input
                            id="planDate"
                            type="date"
                            value={planDate}
                            onChange={(e) => setPlanDate(e.target.value)}
                        />
                    </div>

                    <div className="space-y-4">
                        <Label>Fleet Constraints</Label>
                        <ScrollArea className="h-[300px] border rounded-md p-2">
                            <div className="space-y-3">
                                {trainsets.map((t: any) => (
                                    <div key={t.id} className="flex flex-col space-y-1 pb-2 border-b last:border-0">
                                        <span className="text-sm font-medium">{t.rake_id}</span>
                                        <div className="flex items-center space-x-4">
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`ex-${t.id}`}
                                                    checked={excludedTrainsets.includes(t.id)}
                                                    onCheckedChange={(checked) => {
                                                        if (checked) setExcludedTrainsets([...excludedTrainsets, t.id]);
                                                        else setExcludedTrainsets(excludedTrainsets.filter(id => id !== t.id));
                                                    }}
                                                />
                                                <label htmlFor={`ex-${t.id}`} className="text-xs text-muted-foreground">Force Fail</label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`force-${t.id}`}
                                                    checked={forcedInductions.includes(t.id)}
                                                    onCheckedChange={(checked) => {
                                                        if (checked) setForcedInductions([...forcedInductions, t.id]);
                                                        else setForcedInductions(forcedInductions.filter(id => id !== t.id));
                                                    }}
                                                />
                                                <label htmlFor={`force-${t.id}`} className="text-xs text-muted-foreground">Force Pass</label>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>

                    <div className="flex flex-col space-y-2">
                        <Button onClick={runSimulation} disabled={isSimulating} className="w-full">
                            {isSimulating ? <RotateCcw className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                            Run Simulation
                        </Button>
                        <Button variant="outline" onClick={resetSimulation} className="w-full">
                            Reset All
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="lg:col-span-3 shadow-card border-info/10">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Simulation Results</CardTitle>
                        <CardDescription>Comparison between base plan and simulated scenario</CardDescription>
                    </div>
                    {simulationResult && (
                        <Button variant="outline" size="sm">
                            <Save className="mr-2 h-4 w-4" /> Save Scenario
                        </Button>
                    )}
                </CardHeader>
                <CardContent>
                    {!simulationResult ? (
                        <div className="h-[500px] flex flex-col items-center justify-center text-muted-foreground">
                            <Info className="h-12 w-12 mb-4 opacity-20" />
                            <p>Configure parameters and click "Run Simulation" to see results</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-muted/50 p-4 rounded-lg border">
                                    <p className="text-sm font-medium text-muted-foreground">Net Induction Delta</p>
                                    <p className={`text-2xl font-bold ${simulationResult.comparison?.induction_delta > 0 ? 'text-success' : 'text-destructive'}`}>
                                        {simulationResult.comparison?.induction_delta > 0 ? '+' : ''}{simulationResult.comparison?.induction_delta}
                                    </p>
                                </div>
                                <div className="bg-muted/50 p-4 rounded-lg border">
                                    <p className="text-sm font-medium text-muted-foreground">Confidence Delta</p>
                                    <p className={`text-2xl font-bold ${simulationResult.comparison?.score_delta > 0 ? 'text-success' : 'text-destructive'}`}>
                                        {simulationResult.comparison?.score_delta > 0 ? '+' : ''}{simulationResult.comparison?.score_delta}%
                                    </p>
                                </div>
                                <div className="bg-muted/50 p-4 rounded-lg border">
                                    <p className="text-sm font-medium text-muted-foreground">Simulation Status</p>
                                    <p className="text-2xl font-bold text-primary capitalize">{simulationResult.summary?.optimizer_score >= 80 ? 'Optimal' : 'Sub-optimal'}</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="font-semibold">Projected Induction List</h3>
                                <ScrollArea className="h-[300px] border rounded-md">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted/50 sticky top-0">
                                            <tr>
                                                <th className="p-3 text-left">Rank</th>
                                                <th className="p-3 text-left">Rake ID</th>
                                                <th className="p-3 text-left">Decision</th>
                                                <th className="p-3 text-left">Confidence</th>
                                                <th className="p-3 text-left">Rationale</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {simulationResult.decisions?.map((d: any) => (
                                                <tr key={d.trainset_id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                                    <td className="p-3 font-medium">#{d.rank_order}</td>
                                                    <td className="p-3">{d.rake_id}</td>
                                                    <td className="p-3">
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium uppercase ${d.decision === 'inducted' ? 'bg-success/10 text-success' :
                                                                d.decision === 'standby' ? 'bg-info/10 text-info' :
                                                                    'bg-destructive/10 text-destructive'
                                                            }`}>
                                                            {d.decision}
                                                        </span>
                                                    </td>
                                                    <td className="p-3">{d.confidence_score}%</td>
                                                    <td className="p-3 text-xs text-muted-foreground max-w-xs truncate" title={d.explanation_text}>
                                                        {d.explanation_text}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </ScrollArea>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};
