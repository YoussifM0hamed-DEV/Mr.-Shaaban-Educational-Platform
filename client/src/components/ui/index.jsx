import { Fragment, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Loader2,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { initials } from '../../utils/format';

/* ------------------------------------------------------------------ Card */

export function Card({ className, children, ...rest }) {
  return (
    <div className={clsx('card', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, className }) {
  return (
    <div
      className={clsx(
        'flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 px-5 py-4',
        className
      )}
    >
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-ink-900">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, children }) {
  return <div className={clsx('p-5', className)}>{children}</div>;
}

/* ---------------------------------------------------------------- Button */

const VARIANTS = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
};

export function Button({
  variant = 'primary',
  size,
  loading = false,
  icon: Icon,
  className,
  children,
  disabled,
  ...rest
}) {
  return (
    <button
      type="button"
      className={clsx(VARIANTS[variant], size === 'sm' && 'btn-sm', className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : Icon ? (
        <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      ) : null}
      {children}
    </button>
  );
}

/* --------------------------------------------------------------- Spinner */

export function Spinner({ className }) {
  return <Loader2 className={clsx('h-5 w-5 animate-spin text-brand-600', className)} />;
}

export function PageLoader({ label = 'Loading' }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
      <Spinner className="h-7 w-7" />
      <p className="text-sm text-ink-500">{label}</p>
    </div>
  );
}

/* -------------------------------------------------------------- Skeleton */

export function Skeleton({ className }) {
  return <div className={clsx('skeleton', className)} />;
}

export function SkeletonCard() {
  return (
    <Card className="p-5">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="mt-3 h-8 w-1/2" />
      <Skeleton className="mt-4 h-2 w-full" />
    </Card>
  );
}

export function SkeletonTable({ rows = 5, cols = 5 }) {
  return (
    <div className="table-wrap p-4">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 border-b border-ink-100 py-3 last:border-0">
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} className={clsx('h-4', c === 0 ? 'w-48' : 'w-24')} />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ Empty/Error */

export function EmptyState({ icon: Icon = Inbox, title, description, action, className }) {
  return (
    <div className={clsx('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <div className="mb-4 rounded-2xl bg-ink-100 p-3.5">
        <Icon className="h-6 w-6 text-ink-400" />
      </div>
      <h3 className="text-base font-semibold text-ink-800">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-sm text-ink-500">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message = 'Something went wrong', onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 rounded-2xl bg-rose-50 p-3.5">
        <AlertTriangle className="h-6 w-6 text-rose-500" />
      </div>
      <h3 className="text-base font-semibold text-ink-800">We could not load this</h3>
      <p className="mt-1 max-w-sm text-sm text-ink-500">{message}</p>
      {onRetry ? (
        <Button variant="secondary" icon={RefreshCw} className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------------- Badge */

const BADGE_TONES = {
  neutral: 'bg-ink-100 text-ink-700',
  brand: 'bg-brand-50 text-brand-700',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-rose-50 text-rose-700',
  info: 'bg-sky-50 text-sky-700',
};

export function Badge({ tone = 'neutral', className, children, icon: Icon }) {
  return (
    <span className={clsx('badge', BADGE_TONES[tone], className)}>
      {Icon ? <Icon className="h-3 w-3" /> : null}
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  const map = {
    PENDING: { tone: 'warning', label: 'Pending' },
    APPROVED: { tone: 'success', label: 'Approved' },
    REJECTED: { tone: 'danger', label: 'Rejected' },
    DISABLED: { tone: 'neutral', label: 'Disabled' },
  };
  const cfg = map[status] || { tone: 'neutral', label: status };
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>;
}

export function EngagementBadge({ engagement }) {
  const map = {
    ACTIVE: { tone: 'success', label: 'Active' },
    AT_RISK: { tone: 'warning', label: 'At risk' },
    INACTIVE: { tone: 'danger', label: 'Inactive' },
  };
  const cfg = map[engagement];
  if (!cfg) return <span className="text-ink-400">-</span>;
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>;
}

/* ---------------------------------------------------------------- Avatar */

const AVATAR_SIZES = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
  xl: 'h-20 w-20 text-2xl',
};

export function Avatar({ name = '', src, size = 'md', className }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={clsx('rounded-full object-cover', AVATAR_SIZES[size], className)}
      />
    );
  }
  return (
    <div
      className={clsx(
        'flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 font-semibold text-white',
        AVATAR_SIZES[size],
        className
      )}
      aria-hidden="true"
    >
      {initials(name) || '?'}
    </div>
  );
}

/* ----------------------------------------------------------- ProgressBar */

const PROGRESS_TONES = {
  auto: null,
  brand: 'bg-brand-600',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
};

/** Colour follows the value when tone is "auto": red low, amber middling, green high. */
export function ProgressBar({ value = 0, tone = 'auto', size = 'md', className, showLabel = false }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const autoTone = v >= 75 ? 'bg-emerald-500' : v >= 40 ? 'bg-amber-500' : 'bg-rose-500';
  const barColor = tone === 'auto' ? (v === 0 ? 'bg-ink-300' : autoTone) : PROGRESS_TONES[tone];

  return (
    <div className={clsx('flex items-center gap-2', className)}>
      <div
        className={clsx(
          'w-full overflow-hidden rounded-full bg-ink-100',
          size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-3' : 'h-2'
        )}
        role="progressbar"
        aria-valuenow={v}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={clsx('h-full rounded-full transition-all duration-500', barColor)}
          style={{ width: `${v}%` }}
        />
      </div>
      {showLabel ? (
        <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-ink-600">
          {v}%
        </span>
      ) : null}
    </div>
  );
}

/** Circular progress used on dashboard hero cards. */
export function ProgressRing({ value = 0, size = 120, stroke = 10, label, sublabel }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (v / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-ink-100"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="stroke-brand-600 transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums text-ink-900">{label ?? `${v}%`}</span>
        {sublabel ? <span className="text-xs text-ink-500">{sublabel}</span> : null}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- Modal */

export function Modal({ open, onClose, title, description, size = 'md', children, footer }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-4">
      <div
        className="fixed inset-0 bg-ink-950/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={clsx(
          'relative z-10 w-full animate-slide-up rounded-t-3xl bg-white shadow-elevated sm:rounded-2xl',
          widths[size]
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
            {description ? <p className="mt-0.5 text-sm text-ink-500">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-5">{children}</div>

        {footer ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-ink-100 px-5 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  description,
  confirmLabel = 'Confirm',
  tone = 'danger',
  loading = false,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <Fragment>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </Fragment>
      }
    >
      <p className="text-sm text-ink-600">{description}</p>
    </Modal>
  );
}

/* ----------------------------------------------------------------- Forms */

export function Field({ label, error, hint, required, children, className }) {
  return (
    <div className={className}>
      {label ? (
        <label className="label">
          {label}
          {required ? <span className="ml-0.5 text-rose-500">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? <p className="mt-1.5 text-xs font-medium text-rose-600">{error}</p> : null}
      {!error && hint ? <p className="mt-1.5 text-xs text-ink-500">{hint}</p> : null}
    </div>
  );
}

export function Input({ className, error, ...rest }) {
  return <input className={clsx('input', error && 'border-rose-400', className)} {...rest} />;
}

export function Textarea({ className, error, rows = 4, ...rest }) {
  return (
    <textarea
      rows={rows}
      className={clsx('input resize-y', error && 'border-rose-400', className)}
      {...rest}
    />
  );
}

export function Select({ className, error, options = [], placeholder, children, ...rest }) {
  return (
    <select className={clsx('input pr-8', error && 'border-rose-400', className)} {...rest}>
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
      {children}
    </select>
  );
}

export function Checkbox({ label, description, className, ...rest }) {
  return (
    <label className={clsx('flex cursor-pointer items-start gap-3', className)}>
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
        {...rest}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink-800">{label}</span>
        {description ? <span className="block text-xs text-ink-500">{description}</span> : null}
      </span>
    </label>
  );
}

export function Toggle({ checked, onChange, label, description, disabled }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink-800">{label}</span>
        {description ? <span className="block text-xs text-ink-500">{description}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50',
          checked ? 'bg-brand-600' : 'bg-ink-300'
        )}
      >
        <span
          className={clsx(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          )}
        />
      </button>
    </label>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search', className, onClear }) {
  return (
    <div className={clsx('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input pl-9"
      />
      {value && onClear ? (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-ink-400 hover:text-ink-700"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ Tabs */

export function Tabs({ tabs, active, onChange, className }) {
  return (
    <div className={clsx('flex gap-1 overflow-x-auto scrollbar-none border-b border-ink-200', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={clsx(
            'relative whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors',
            active === tab.value
              ? 'text-brand-700'
              : 'text-ink-500 hover:text-ink-800'
          )}
        >
          <span className="flex items-center gap-2">
            {tab.label}
            {tab.count !== undefined ? (
              <span
                className={clsx(
                  'rounded-full px-1.5 py-0.5 text-[11px] font-semibold',
                  active === tab.value ? 'bg-brand-100 text-brand-700' : 'bg-ink-100 text-ink-600'
                )}
              >
                {tab.count}
              </span>
            ) : null}
          </span>
          {active === tab.value ? (
            <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-600" />
          ) : null}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ Pagination */

export function Pagination({ pagination, onPageChange, className }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  const { page, totalPages, total, limit } = pagination;

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className={clsx('flex flex-wrap items-center justify-between gap-3 px-4 py-3', className)}>
      <p className="text-sm text-ink-500">
        Showing <span className="font-medium text-ink-700">{from}</span> to{' '}
        <span className="font-medium text-ink-700">{to}</span> of{' '}
        <span className="font-medium text-ink-700">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="secondary"
          size="sm"
          icon={ChevronLeft}
          disabled={!pagination.hasPrevPage}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <span className="px-3 text-sm font-medium text-ink-600">
          {page} / {totalPages}
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={!pagination.hasNextPage}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- Multi pick */

/** Searchable multi-select used for choosing meeting attendees. */
export function MultiSelect({ options, selected, onChange, placeholder = 'Search', emptyLabel }) {
  const [query, setQuery] = useState('');
  const selectedSet = new Set(selected);

  const filtered = options.filter((o) =>
    `${o.label} ${o.sublabel || ''}`.toLowerCase().includes(query.toLowerCase())
  );

  const toggle = (value) => {
    const next = new Set(selectedSet);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange([...next]);
  };

  return (
    <div className="rounded-xl border border-ink-200">
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 p-2">
        <SearchInput value={query} onChange={setQuery} placeholder={placeholder} className="flex-1 min-w-[180px]" />
        <Button variant="ghost" size="sm" onClick={() => onChange(options.map((o) => o.value))}>
          Select all
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onChange([])}>
          Clear
        </Button>
      </div>

      <div className="max-h-64 overflow-y-auto p-1">
        {filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-ink-500">{emptyLabel || 'No matches'}</p>
        ) : (
          filtered.map((o) => {
            const isSelected = selectedSet.has(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => toggle(o.value)}
                className={clsx(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors',
                  isSelected ? 'bg-brand-50' : 'hover:bg-ink-50'
                )}
              >
                <span
                  className={clsx(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                    isSelected ? 'border-brand-600 bg-brand-600' : 'border-ink-300 bg-white'
                  )}
                >
                  {isSelected ? <Check className="h-3.5 w-3.5 text-white" /> : null}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink-800">{o.label}</span>
                  {o.sublabel ? (
                    <span className="block truncate text-xs text-ink-500">{o.sublabel}</span>
                  ) : null}
                </span>
              </button>
            );
          })
        )}
      </div>

      <div className="border-t border-ink-100 px-3 py-2 text-xs text-ink-500">
        {selected.length} selected
      </div>
    </div>
  );
}
