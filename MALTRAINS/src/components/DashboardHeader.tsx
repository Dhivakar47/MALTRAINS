import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Clock, LogOut, Menu } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useTranslation } from 'react-i18next';

export const DashboardHeader = ({ onMenuClick }: { onMenuClick?: () => void }) => {
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
    <header className="bg-card border-b border-border px-4 sm:px-6 py-4 sticky top-0 z-30">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="md:hidden shrink-0" onClick={onMenuClick}>
            <Menu className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-foreground truncate">
              {t('header.welcome')}
            </h1>
            <p className="text-sm text-muted-foreground mt-1 truncate">
              {t('header.subtitle')}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between md:justify-end gap-2 sm:gap-4 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <div className="hidden sm:block text-right shrink-0">
            <div className="flex items-center gap-2 text-foreground justify-end">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-base font-semibold tabular-nums">
                {formatTime(currentTime)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{formatDate(currentTime)}</p>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-auto">
            <LanguageSwitcher />
            <ThemeToggle />
            <Button 
              variant="outline" 
              onClick={logout}
              className="gap-2 shrink-0"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">{t('header.logout')}</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};
