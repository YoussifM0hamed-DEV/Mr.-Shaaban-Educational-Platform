import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import clsx from 'clsx';
import { Bell, CheckCheck, Radio, Video, FileText, ClipboardList, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { notificationApi } from '../../services/endpoints';
import { onSocketEvent, SOCKET_EVENTS } from '../../services/socket';
import { relativeTime } from '../../utils/format';
import { Button, EmptyState, Spinner } from '../ui';

const ICONS = {
  NEW_LESSON: FileText,
  NEW_VIDEO: Video,
  NEW_MATERIAL: FileText,
  NEW_QUIZ: ClipboardList,
  NEW_EXAM: ClipboardList,
  NEW_MEETING: Radio,
  MEETING_SOON: Radio,
  MEETING_LIVE: Radio,
  NEW_REGISTRATION: UserPlus,
  QUIZ_COMPLETED: ClipboardList,
  EXAM_COMPLETED: ClipboardList,
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const countQuery = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: notificationApi.unreadCount,
    // Socket pushes keep this fresh; polling is only a fallback.
    refetchInterval: 120000,
  });

  const listQuery = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => notificationApi.list({ limit: 15 }),
    enabled: open,
  });

  const markAll = useMutation({
    mutationFn: notificationApi.markAllRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markOne = useMutation({
    mutationFn: notificationApi.markRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  // Live pushes: refresh the badge and surface urgent ones as a toast.
  useEffect(() => {
    const offNew = onSocketEvent(SOCKET_EVENTS.NOTIFICATION, (n) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      if (n?.type === 'MEETING_LIVE') {
        toast(n.title, { icon: '🔴', duration: 8000 });
      } else if (n?.title) {
        toast(n.title, { icon: '🔔' });
      }
    });

    const offCount = onSocketEvent(SOCKET_EVENTS.NOTIFICATION_COUNT, () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    });

    return () => {
      offNew();
      offCount();
    };
  }, [queryClient]);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const unread = countQuery.data?.data?.unread ?? 0;
  const items = listQuery.data?.data ?? [];

  const handleClick = (n) => {
    if (!n.read) markOne.mutate(n._id);
    setOpen(false);
    if (n.action?.url) navigate(n.action.url);
    else if (n.link) navigate(n.link);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-xl p-2.5 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 ? (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] animate-fade-in overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-elevated">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-ink-900">Notifications</h3>
            {unread > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                icon={CheckCheck}
                onClick={() => markAll.mutate()}
                loading={markAll.isPending}
              >
                Mark all read
              </Button>
            ) : null}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {listQuery.isLoading ? (
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            ) : items.length === 0 ? (
              <EmptyState
                icon={Bell}
                title="Nothing yet"
                description="New lessons, quizzes and live classes will show up here."
                className="py-10"
              />
            ) : (
              items.map((n) => {
                const Icon = ICONS[n.type] || Bell;
                const isLive = n.type === 'MEETING_LIVE';
                return (
                  <button
                    key={n._id}
                    type="button"
                    onClick={() => handleClick(n)}
                    className={clsx(
                      'flex w-full gap-3 border-b border-ink-50 px-4 py-3 text-left transition-colors last:border-0 hover:bg-ink-50',
                      !n.read && 'bg-brand-50/50'
                    )}
                  >
                    <span
                      className={clsx(
                        'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                        isLive ? 'bg-rose-100 text-rose-600' : 'bg-brand-100 text-brand-700'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="text-sm font-semibold text-ink-900">{n.title}</span>
                        {!n.read ? (
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-xs text-ink-600">{n.message}</span>
                      <span className="mt-1 block text-[11px] text-ink-400">
                        {relativeTime(n.createdAt)}
                      </span>
                      {n.action?.label ? (
                        <span className="mt-1.5 inline-block rounded-md bg-brand-600 px-2 py-1 text-[11px] font-bold text-white">
                          {n.action.label}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
