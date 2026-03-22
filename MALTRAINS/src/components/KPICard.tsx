import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  variant: 'success' | 'warning' | 'destructive' | 'info';
  trend?: {
    value: number;
    isPositive: boolean;
  };
  onClick?: () => void;
  active?: boolean;
  className?: string;
}

const variantStyles = {
  success: 'kpi-card-success',
  warning: 'kpi-card-warning',
  destructive: 'kpi-card-destructive',
  info: 'kpi-card-info',
};

const iconBgStyles = {
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
  info: 'bg-info/10 text-info',
};

export const KPICard = ({ title, value, icon: Icon, variant, trend, onClick, active, className }: KPICardProps) => {
  return (
    <Card 
      onClick={onClick}
      className={cn(
        'shadow-card hover:shadow-card-hover transition-all cursor-pointer border-2',
        variantStyles[variant],
        active ? 'ring-2 ring-primary scale-[1.02] border-primary' : 'border-transparent',
        className
      )}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold text-foreground mt-2">{value}</p>
            {trend && (
              <p className={cn(
                'text-sm mt-1',
                trend.isPositive ? 'text-success' : 'text-destructive'
              )}>
                {trend.isPositive ? '↑' : '↓'} {trend.value}% from yesterday
              </p>
            )}
          </div>
          <div className={cn('p-3 rounded-lg', iconBgStyles[variant])}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
