import { NavLink as RouterNavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Database,
  AlertTriangle,
  Users,
  Bell,
  Train,
  LogOut,
  Settings,
  MapPin,
  FileText,
  ShieldCheck,
  Wrench,
  Map
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { UserProfileView } from './UserProfileView';


export const Sidebar = () => {
  const { user, logout, role, isAdmin } = useAuth();
  const { t } = useTranslation();
  const [profileOpen, setProfileOpen] = useState(false);

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: t('nav.dashboard') },
    { to: '/data-entry', icon: Database, label: t('nav.dataEntry'), adminOnly: true },
    { to: '/report-incident', icon: AlertTriangle, label: t('nav.reportIncident') },
    { to: '/attendance', icon: Users, label: t('nav.attendance') },
    { to: '/alerts', icon: Bell, label: t('nav.alerts') },
    { to: '/predictive-maintenance', icon: Wrench, label: 'AI Maintenance' },
    { to: '/live-map', icon: Map, label: 'Live Incident Map' },
  ];

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-sidebar flex flex-col border-r border-sidebar-border shadow-2xl z-50">
      {/* Logo */}
      <div className="p-8">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-primary rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(var(--primary),0.4)]">
            <Train className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-black text-sidebar-foreground tracking-tight leading-none">{t('common.appName')}</h1>
            <p className="text-[10px] text-sidebar-foreground/40 uppercase tracking-[0.2em] mt-1 font-bold">{t('common.appSubtitle')}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 overflow-y-auto space-y-6">
        <div>
          <p className="px-6 mb-3 text-[10px] font-black text-sidebar-foreground/20 uppercase tracking-[0.2em]">General</p>
          <ul className="space-y-1.5">
            {navItems
              .filter(item => !item.adminOnly || isAdmin)
              .map((item) => (
                <li key={item.to}>
                  <RouterNavLink
                    to={item.to}
                    className={({ isActive }) =>
                      cn('sidebar-item', isActive && 'sidebar-item-active')
                    }
                  >
                    <item.icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </RouterNavLink>
                </li>
              ))}
          </ul>
        </div>

        {isAdmin && (
          <div className="pt-2">
            <p className="px-6 mb-3 text-[10px] font-black text-sidebar-foreground/20 uppercase tracking-[0.2em]">Management</p>
            <ul className="space-y-1.5">
              <li>
                <RouterNavLink
                  to="/admin-settings"
                  className={({ isActive }) =>
                    cn('sidebar-item', isActive && 'sidebar-item-active')
                  }
                >
                  <Settings className="w-5 h-5" />
                  <span>{t('nav.settings')}</span>
                </RouterNavLink>
              </li>
              <li>
                <RouterNavLink
                  to="/train-logs"
                  className={({ isActive }) =>
                    cn('sidebar-item', isActive && 'sidebar-item-active')
                  }
                >
                  <FileText className="w-5 h-5" />
                  <span>{t('nav.trainLogs')}</span>
                </RouterNavLink>
              </li>
              <li>
                <RouterNavLink
                  to="/fitness-renewal"
                  className={({ isActive }) =>
                    cn('sidebar-item', isActive && 'sidebar-item-active')
                  }
                >
                  <ShieldCheck className="w-5 h-5" />
                  <span>Fitness Renewal</span>
                </RouterNavLink>
              </li>
            </ul>
          </div>
        )}
      </nav>

      {/* User Info */}
      <div className="p-4 bg-sidebar-accent/20 border-t border-sidebar-border/50">
        <button
          onClick={() => setProfileOpen(true)}
          className="flex items-center gap-3 mb-4 w-full text-left rounded-2xl hover:bg-sidebar-accent/50 transition-all p-2 group"
        >
          <div className="relative w-10 h-10 bg-sidebar-accent rounded-xl flex items-center justify-center ring-2 ring-transparent group-hover:ring-primary/40 transition-all overflow-hidden shadow-inner">
            <span className="text-base font-bold text-sidebar-accent-foreground">
              {(user?.user_metadata?.display_name || user?.email || 'U').charAt(0).toUpperCase()}
            </span>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-success border-2 border-sidebar rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-sidebar-foreground truncate group-hover:text-primary transition-colors">
              {user?.user_metadata?.display_name || user?.email || 'User'}
            </p>
            <p className="text-[10px] text-sidebar-foreground/40 truncate font-black uppercase tracking-wider">
              {role || 'Staff'} {isAdmin && '• Staff'}
            </p>
          </div>
        </button>
        <button
          onClick={logout}
          className="flex items-center justify-center gap-2 text-xs font-bold text-sidebar-foreground/30 hover:text-destructive transition-all w-full py-2 hover:bg-destructive/5 rounded-lg"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="uppercase tracking-widest">{t('common.signOut')}</span>
        </button>
      </div>

      <UserProfileView open={profileOpen} onClose={() => setProfileOpen(false)} />
    </aside>
  );
};
