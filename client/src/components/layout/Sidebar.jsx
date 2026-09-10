import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { GraduationCap, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

/**
 * Shared sidebar. Sections are filtered by the permissions the teacher granted,
 * so an assistant never sees a link they cannot use.
 */
export default function Sidebar({ sections, open, onClose }) {
  const { platform, user } = useAuth();

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 px-5 py-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-glow">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">
              {platform?.teacherName || 'Educational Platform'}
            </p>
            <p className="truncate text-xs text-ink-400">{platform?.subject || 'Learning'}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-ink-400 hover:bg-white/10 hover:text-white lg:hidden"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-6 scrollbar-none">
        {sections.map((section) => {
          const items = section.items.filter((item) => item.visible !== false);
          if (!items.length) return null;

          return (
            <div key={section.title}>
              {section.title ? (
                <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                  {section.title}
                </p>
              ) : null}
              <div className="space-y-0.5">
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={onClose}
                    className={({ isActive }) =>
                      clsx(
                        'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                        isActive
                          ? 'bg-brand-600 text-white shadow-glow'
                          : 'text-ink-300 hover:bg-white/5 hover:text-white'
                      )
                    }
                  >
                    <item.icon className="h-[18px] w-[18px] shrink-0" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge ? (
                      <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    ) : null}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-5 py-4">
        <p className="truncate text-xs font-medium text-ink-300">{user?.name}</p>
        <p className="truncate text-[11px] text-ink-500">{user?.email}</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile drawer */}
      <div
        className={clsx(
          'fixed inset-0 z-40 bg-ink-950/60 backdrop-blur-sm transition-opacity lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-72 bg-ink-900 transition-transform duration-300 lg:hidden',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {content}
      </aside>

      {/* Desktop rail */}
      <aside className="hidden w-72 shrink-0 bg-ink-900 lg:block">
        <div className="sticky top-0 h-screen">{content}</div>
      </aside>
    </>
  );
}
