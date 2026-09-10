import clsx from 'clsx';
import { Link } from 'react-router-dom';
import { ProgressBar } from '../ui';

const TONES = {
  brand: 'bg-brand-50 text-brand-600',
  success: 'bg-emerald-50 text-emerald-600',
  warning: 'bg-amber-50 text-amber-600',
  danger: 'bg-rose-50 text-rose-600',
  info: 'bg-sky-50 text-sky-600',
  neutral: 'bg-ink-100 text-ink-600',
};

/** Dashboard tile. Renders as a link when `to` is provided. */
export default function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'brand',
  hint,
  progress,
  to,
  className,
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink-500">{label}</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-ink-900 sm:text-3xl">{value}</p>
        </div>
        {Icon ? (
          <span className={clsx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', TONES[tone])}>
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
      </div>

      {progress !== undefined ? <ProgressBar value={progress} className="mt-4" /> : null}
      {hint ? <p className="mt-2 text-xs text-ink-500">{hint}</p> : null}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={clsx('card card-hover block p-5', className)}>
        {body}
      </Link>
    );
  }

  return <div className={clsx('card p-5', className)}>{body}</div>;
}

/** Compact engagement percentage tile used in the dashboard engagement row. */
export function EngagementTile({ label, value, icon: Icon }) {
  return (
    <div className="rounded-xl border border-ink-200/70 bg-white p-4">
      <div className="flex items-center gap-2">
        {Icon ? <Icon className="h-4 w-4 text-ink-400" /> : null}
        <p className="text-xs font-medium text-ink-500">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-ink-900">{Math.round(value || 0)}%</p>
      <ProgressBar value={value} size="sm" className="mt-2" />
    </div>
  );
}
