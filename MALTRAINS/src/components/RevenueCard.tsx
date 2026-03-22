import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IndianRupee, TrendingUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type TimeRange = 'daily' | 'weekly' | 'monthly';

interface DailyRevenue {
    id: string;
    date: string;
    amount: number;
}

export const RevenueCard = () => {
    const { isAdmin } = useAuth();
    const [timeRange, setTimeRange] = useState<TimeRange>('daily');

    const { data: revenueData, isLoading } = useQuery({
        queryKey: ['revenue', timeRange],
        queryFn: async () => {
            // Fetch the last 30 days of revenue
            const { data, error } = await supabase
                .from('daily_revenue' as any)
                .select('*')
                .order('date', { ascending: false })
                .limit(30);

            if (error) {
                console.error('Error fetching revenue:', error);
                return [] as DailyRevenue[];
            }

            return (data as unknown as DailyRevenue[]).reverse(); // oldest to newest for chart
        },
        enabled: isAdmin,
    });

    if (!isAdmin) return null;

    // Calculate totals based on selected range
    const calculateTotal = () => {
        if (!revenueData || revenueData.length === 0) return 0;

        const today = new Date().toISOString().split('T')[0];
        const todayData = revenueData.find(d => d.date === today);

        if (timeRange === 'daily') {
            return todayData ? todayData.amount : (revenueData[revenueData.length - 1].amount || 0);
        }

        if (timeRange === 'weekly') {
            // Sum last 7 days
            return revenueData.slice(-7).reduce((sum, day) => sum + Number(day.amount), 0);
        }

        // Monthly (sum all up to 30 days)
        return revenueData.reduce((sum, day) => sum + Number(day.amount), 0);
    };

    const totalRevenue = calculateTotal();
    const formattedRevenue = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(totalRevenue);

    const getChartData = () => {
        if (!revenueData) return [];

        if (timeRange === 'weekly') {
            return revenueData.slice(-7).map(d => ({
                name: new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short' }),
                amount: Number(d.amount)
            }));
        } else if (timeRange === 'monthly') {
            // Group by weeks or just show last 30 days
            return revenueData.map(d => ({
                name: new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
                amount: Number(d.amount)
            }));
        } else {
            // Daily shows just last 7 days trend to give context to today's number
            return revenueData.slice(-7).map(d => ({
                name: new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short' }),
                amount: Number(d.amount)
            }));
        }
    };

    return (
        <Card className="col-span-full shadow-card border-success/20 overflow-hidden">
            <CardHeader className="pb-2 border-b border-border/50 bg-success/5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="space-y-1">
                        <CardTitle className="text-xl flex items-center gap-2">
                            <IndianRupee className="h-5 w-5 text-success" />
                            Revenue Overview
                        </CardTitle>
                        <CardDescription>
                            {timeRange === 'daily' ? "Today's Revenue" : timeRange === 'weekly' ? "Last 7 Days Revenue" : "Last 30 Days Revenue"}
                        </CardDescription>
                    </div>
                    <div className="flex bg-muted p-1 rounded-lg">
                        <Button
                            size="sm"
                            variant={timeRange === 'daily' ? 'secondary' : 'ghost'}
                            onClick={() => setTimeRange('daily')}
                            className="h-8 text-xs"
                        >
                            Daily
                        </Button>
                        <Button
                            size="sm"
                            variant={timeRange === 'weekly' ? 'secondary' : 'ghost'}
                            onClick={() => setTimeRange('weekly')}
                            className="h-8 text-xs"
                        >
                            Weekly
                        </Button>
                        <Button
                            size="sm"
                            variant={timeRange === 'monthly' ? 'secondary' : 'ghost'}
                            onClick={() => setTimeRange('monthly')}
                            className="h-8 text-xs"
                        >
                            Monthly
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="flex flex-col justify-center space-y-2">
                        <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                            {timeRange === 'daily' ? 'TDY REVENUE' : timeRange === 'weekly' ? 'WEEKLY TOTAL' : 'MONTHLY TOTAL'}
                        </span>
                        <div className="text-4xl font-bold tracking-tight text-foreground">
                            {isLoading ? '...' : formattedRevenue}
                        </div>
                        <div className="flex items-center text-xs text-success gap-1 mt-2">
                            <TrendingUp className="h-3 w-3" />
                            <span>Real-time tracking</span>
                        </div>
                    </div>

                    <div className="md:col-span-3 h-[200px]">
                        {isLoading ? (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground animate-pulse">
                                Loading chart...
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={getChartData()} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                                        dy={10}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                                        domain={[0, 'auto']}
                                        tickFormatter={(value) => `₹${value / 1000}k`}
                                    />
                                    <Tooltip
                                        cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                                        contentStyle={{
                                            backgroundColor: "hsl(var(--background))",
                                            borderColor: "hsl(var(--border))",
                                            borderRadius: "0.5rem",
                                            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)"
                                        }}
                                        formatter={(value: number) => [
                                            new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value),
                                            "Revenue"
                                        ]}
                                    />
                                    <Bar
                                        dataKey="amount"
                                        fill="hsl(var(--success))"
                                        radius={[4, 4, 0, 0]}
                                        maxBarSize={40}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
