import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Clock, LogOut } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useTranslation } from 'react-i18next';

export const DashboardHeader = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const { user, logout } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  return (
    <header className="bg-card border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t('header.welcome')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('header.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="flex items-center gap-2 text-foreground">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-lg font-semibold tabular-nums">
                {formatTime(currentTime)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{formatDate(currentTime)}</p>
          </div>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
            <Button 
              variant="outline" 
              onClick={logout}
              className="gap-2"
            >
              <LogOut className="w-4 h-4" />
              {t('header.logout')}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};
