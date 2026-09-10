import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, Menu, Settings, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../ui';
import NotificationBell from './NotificationBell';

export default function Topbar({ title, subtitle, onMenuClick, actions, settingsPath }) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 border-b border-ink-200/70 bg-white/80 backdrop-blur-lg">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-xl p-2.5 text-ink-600 hover:bg-ink-100 lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold text-ink-900 sm:text-xl">{title}</h1>
          {subtitle ? <p className="truncate text-sm text-ink-500">{subtitle}</p> : null}
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {actions}
          <NotificationBell />

          <div className="relative" ref={ref}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-xl p-1 pr-2 transition-colors hover:bg-ink-100"
            >
              <Avatar name={user?.name} src={user?.avatarUrl} size="sm" />
              <span className="hidden max-w-[9rem] truncate text-sm font-medium text-ink-800 sm:block">
                {user?.name}
              </span>
              <ChevronDown className="hidden h-4 w-4 text-ink-400 sm:block" />
            </button>

            {menuOpen ? (
              <div className="absolute right-0 z-50 mt-2 w-56 animate-fade-in overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-elevated">
                <div className="border-b border-ink-100 px-4 py-3">
                  <p className="truncate text-sm font-semibold text-ink-900">{user?.name}</p>
                  <p className="truncate text-xs text-ink-500">{user?.email}</p>
                  <p className="mt-1 inline-block rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700">
                    {user?.role}
                  </p>
                </div>
                <div className="p-1">
                  {settingsPath ? (
                    <Link
                      to={settingsPath}
                      onClick={() => setMenuOpen(false)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-700 hover:bg-ink-50"
                    >
                      <Settings className="h-4 w-4 text-ink-400" />
                      Account settings
                    </Link>
                  ) : (
                    <span className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-400">
                      <User className="h-4 w-4" />
                      {user?.role}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
