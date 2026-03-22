import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileBarChart, Download, Calendar, TrendingUp, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

const reports = [
  { 
    id: 1, 
    title: 'Daily Operations Summary', 
    date: 'Jan 18, 2026',
    type: 'Operations',
    status: 'Ready',
    trend: 'up',
    trendValue: '+5.2%',
    data: [
      ['Metric', 'Value'],
      ['Trains Running', '20'],
      ['On-Time Performance', '94.5%'],
      ['Total Passengers', '45,200'],
      ['Revenue (INR)', '12,50,000'],
      ['Incidents', '2'],
    ]
  },
  { 
    id: 2, 
    title: 'Weekly Maintenance Report', 
    date: 'Jan 12 - Jan 18, 2026',
    type: 'Maintenance',
    status: 'Ready',
    trend: 'down',
    trendValue: '-2.1%',
    data: [
      ['Rake ID', 'Status', 'Hours', 'Type'],
      ['Rake-03', 'Completed', '8', 'Routine'],
      ['Rake-05', 'In Progress', '12', 'Major'],
      ['Rake-07', 'Scheduled', '4', 'Routine'],
    ]
  },
  { 
    id: 3, 
    title: 'Passenger Statistics', 
    date: 'Jan 2026',
    type: 'Analytics',
    status: 'Ready',
    trend: 'up',
    trendValue: '+12.8%',
    data: [
      ['Station', 'Boarding', 'Alighting', 'Peak Hour'],
      ['Aluva', '5200', '4800', '08:00-09:00'],
      ['Edappally', '8500', '7200', '09:00-10:00'],
      ['MG Road', '12000', '11500', '08:30-09:30'],
      ['Maharajas', '9800', '9200', '17:00-18:00'],
    ]
  },
  { 
    id: 4, 
    title: 'Incident Analysis', 
    date: 'Jan 2026',
    type: 'Safety',
    status: 'Generating',
    trend: 'down',
    trendValue: '-8.3%',
    data: []
  },
];

const downloadCSV = (report: typeof reports[0]) => {
  const csvContent = report.data.map(row => row.join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${report.title.replace(/\s+/g, '_')}_${report.date.replace(/\s+/g, '_')}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  toast({ title: 'Downloaded', description: `${report.title} has been downloaded.` });
};

export const Reports = () => {
  const { isAdmin } = useAuth();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports</h1>
          <p className="text-muted-foreground mt-1">Generate and download operational reports</p>
        </div>
        {isAdmin && (
          <Button className="gap-2">
            <FileBarChart className="w-4 h-4" />
            Generate New Report
          </Button>
        )}
      </div>

      <div className="grid gap-4">
        {reports.map((report) => (
          <Card key={report.id} className="shadow-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <FileBarChart className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{report.title}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{report.date}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {report.type}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className={`flex items-center gap-1 text-sm ${report.trend === 'up' ? 'text-success' : 'text-destructive'}`}>
                      {report.trend === 'up' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      <span>{report.trendValue}</span>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={report.status === 'Ready' 
                        ? 'bg-success/10 text-success border-success/20 mt-1' 
                        : 'bg-warning/10 text-warning border-warning/20 mt-1'
                      }
                    >
                      {report.status}
                    </Badge>
                  </div>
                  <Button 
                    variant="outline" 
                    size="icon"
                    disabled={report.status !== 'Ready'}
                    onClick={() => downloadCSV(report)}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
