import clsx from 'clsx';
import {
  BookOpen,
  ClipboardList,
  FileText,
  LogIn,
  PlayCircle,
  Radio,
  CheckCircle2,
  LogOut,
} from 'lucide-react';
import { relativeTime, formatDateTime } from '../../utils/format';
import { ACTIVITY_LABELS } from '../../utils/constants';
import { EmptyState } from '../ui';

const CONFIG = {
  LOGGED_IN: { icon: LogIn, tone: 'bg-ink-100 text-ink-600' },
  MODULE_OPENED: { icon: BookOpen, tone: 'bg-brand-50 text-brand-600' },
  LESSON_OPENED: { icon: BookOpen, tone: 'bg-brand-50 text-brand-600' },
  VIDEO_STARTED: { icon: PlayCircle, tone: 'bg-sky-50 text-sky-600' },
  VIDEO_PROGRESS: { icon: PlayCircle, tone: 'bg-sky-50 text-sky-600' },
  VIDEO_COMPLETED: { icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-600' },
  MATERIAL_OPENED: { icon: FileText, tone: 'bg-violet-50 text-violet-600' },
  QUIZ_STARTED: { icon: ClipboardList, tone: 'bg-amber-50 text-amber-600' },
  QUIZ_COMPLETED: { icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-600' },
  EXAM_STARTED: { icon: ClipboardList, tone: 'bg-amber-50 text-amber-600' },
  EXAM_COMPLETED: { icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-600' },
  LIVE_MEETING_JOINED: { icon: Radio, tone: 'bg-rose-50 text-rose-600' },
  LIVE_MEETING_LEFT: { icon: LogOut, tone: 'bg-ink-100 text-ink-600' },
};

/** Builds the human-readable second line for an activity row. */
function contextFor(item) {
  const parts = [];
  if (item.lesson?.title) parts.push(item.lesson.title);
  else if (item.module?.title) parts.push(item.module.title);

  const meta = item.metadata || {};
  if (meta.percentage !== undefined) parts.push(`${meta.percentage}% watched`);
  if (meta.score !== undefined) parts.push(`Scored ${meta.score}%`);
  if (meta.fileName) parts.push(meta.fileName);
  if (meta.title && !parts.length) parts.push(meta.title);

  return parts.join(' - ');
}

export default function ActivityTimeline({ items = [], showStudent = false, emptyMessage }) {
  if (!items.length) {
    return (
      <EmptyState
        title="No activity yet"
        description={emptyMessage || 'Activity appears here as soon as a student opens a lesson.'}
        className="py-10"
      />
    );
  }

  return (
    <ol className="relative space-y-1 px-1">
      {items.map((item, index) => {
        const cfg = CONFIG[item.activityType] || CONFIG.LESSON_OPENED;
        const Icon = cfg.icon;
        const context = contextFor(item);
        const isLast = index === items.length - 1;

        return (
          <li key={item._id} className="relative flex gap-3 pb-4 last:pb-0">
            {!isLast ? (
              <span className="absolute left-[15px] top-9 bottom-0 w-px bg-ink-200" aria-hidden="true" />
            ) : null}

            <span
              className={clsx(
                'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-white',
                cfg.tone
              )}
            >
              <Icon className="h-4 w-4" />
            </span>

            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm font-medium text-ink-800">
                {showStudent && item.student?.name ? (
                  <span className="font-semibold">{item.student.name} </span>
                ) : null}
                {ACTIVITY_LABELS[item.activityType] || item.activityType}
              </p>
              {context ? <p className="truncate text-xs text-ink-500">{context}</p> : null}
              <p className="mt-0.5 text-[11px] text-ink-400" title={formatDateTime(item.createdAt)}>
                {relativeTime(item.createdAt)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
