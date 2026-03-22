import { SimulationPanel } from '@/components/SimulationPanel';

const Simulation = () => {
    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex flex-col space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">What-If Simulation</h1>
                <p className="text-muted-foreground">
                    Simulate different operational scenarios and see their impact on fleet induction and service readiness.
                </p>
            </div>
            <SimulationPanel />
        </div>
    );
};

export default Simulation;
