import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Lock,
  LogOut,
  Radio,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { meetingApi } from '../../services/endpoints';
import { onSocketEvent, SOCKET_EVENTS } from '../../services/socket';
import { useAuth } from '../../context/AuthContext';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Pagination,
  SkeletonCard,
  Tabs,
} from '../../components/ui';
import { formatDate, formatTime, formatDateTime } from '../../utils/format';

const SCOPES = [
  { value: 'LIVE', label: 'Live now' },
  { value: 'UPCOMING', label: 'Upcoming' },
  { value: 'PAST', label: 'Previous' },
];

export default function StudentLiveClassesPage() {
  const { platform } = useAuth();
  const queryClient = useQueryClient();
  const [scope, setScope] = useState('LIVE');
  const [page, setPage] = useState(1);
  const [joined, setJoined] = useState(new Set());

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['meetings', 'student', scope, page],
    queryFn: () => meetingApi.list({ scope, page, limit: 12 }),
    keepPreviousData: true,
    refetchInterval: scope === 'LIVE' ? 30000 : false,
  });

  // A class starting should appear without a manual refresh.
  useEffect(() => {
    const off = onSocketEvent(SOCKET_EVENTS.MEETING_LIVE, () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      toast('A live class just started', { icon: '🔴', duration: 8000 });
    });
    return off;
  }, [queryClient]);

  const join = useMutation({
    mutationFn: (id) => meetingApi.join(id),
    onSuccess: (res, id) => {
      setJoined((prev) => new Set(prev).add(id));
      window.open(res.data.meetingUrl, '_blank', 'noopener');
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
    },
    onError: (e) => toast.error(e.message),
  });

  const leave = useMutation({
    mutationFn: (id) => meetingApi.leave(id),
    onSuccess: (_res, id) => {
      setJoined((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.success('Your attendance was recorded');
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
    },
    onError: (e) => toast.error(e.message),
  });

  const meetings = data?.data ?? [];

  return (
    <div className="space-y-5">
      <Tabs
        tabs={SCOPES}
        active={scope}
        onChange={(v) => {
          setScope(v);
          setPage(1);
        }}
      />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : isError ? (
        <ErrorState message={error?.message} onRetry={refetch} />
      ) : meetings.length === 0 ? (
        <Card>
          <EmptyState
            icon={Radio}
            title={
              scope === 'LIVE'
                ? 'Nothing live right now'
                : scope === 'UPCOMING'
                  ? 'No upcoming classes'
                  : 'No previous classes'
            }
            description={
              scope === 'LIVE'
                ? 'When your teacher goes live, it appears here and you get a notification.'
                : 'You will be notified when a live class is scheduled for you.'
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {meetings.map((m) => {
            const isLive = m.liveNow;
            const inSession = joined.has(m._id);

            return (
              <Card
                key={m._id}
                className={isLive ? 'overflow-hidden border-rose-300 shadow-elevated' : 'overflow-hidden'}
              >
                {isLive ? (
                  <div className="flex items-center gap-2 bg-rose-600 px-4 py-2 text-white">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                    <span className="text-xs font-bold uppercase tracking-wider">Live now</span>
                  </div>
                ) : null}

                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                        {platform?.teacherName || 'Your teacher'}
                      </p>
                      <h3 className="truncate text-lg font-bold text-ink-900">{m.title}</h3>
                      {m.module?.title ? (
                        <p className="truncate text-sm text-ink-500">{m.module.title}</p>
                      ) : null}
                    </div>

                    {!isLive ? (
                      <Badge
                        tone={
                          m.status === 'UPCOMING'
                            ? 'info'
                            : m.status === 'CANCELLED'
                              ? 'neutral'
                              : 'success'
                        }
                      >
                        {m.status === 'CANCELLED' ? 'Cancelled' : m.status === 'ENDED' ? 'Ended' : 'Upcoming'}
                      </Badge>
                    ) : null}
                  </div>

                  {m.description ? (
                    <p className="mt-2 line-clamp-2 text-sm text-ink-600">{m.description}</p>
                  ) : null}

                  <div className="mt-3 space-y-1.5 text-sm text-ink-600">
                    <p className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-ink-400" />
                      {formatDate(m.startTime)}
                    </p>
                    <p className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-ink-400" />
                      {formatTime(m.startTime)} to {formatTime(m.endTime)}
                    </p>
                  </div>

                  {m.status === 'CANCELLED' && m.cancelledReason ? (
                    <p className="mt-3 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">
                      {m.cancelledReason}
                    </p>
                  ) : null}

                  {/* Attendance for past classes */}
                  {m.status === 'ENDED' && m.myAttendance ? (
                    <div className="mt-4 flex items-center gap-2">
                      {m.myAttendance.status === 'ATTENDED' ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          <span className="text-sm text-emerald-700">
                            You attended
                            {m.myAttendance.durationMinutes
                              ? ` for ${m.myAttendance.durationMinutes} minutes`
                              : ''}
                          </span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-rose-500" />
                          <span className="text-sm text-rose-700">You were marked absent</span>
                        </>
                      )}
                    </div>
                  ) : null}

                  {isLive || m.status === 'UPCOMING' ? (
                    <div className="mt-5 flex gap-2 border-t border-ink-100 pt-4">
                      {m.canJoinNow ? (
                        <>
                          <Button
                            className={isLive ? 'flex-1 !bg-rose-600 hover:!bg-rose-700' : 'flex-1'}
                            icon={ExternalLink}
                            loading={join.isPending && join.variables === m._id}
                            onClick={() => join.mutate(m._id)}
                          >
                            JOIN MEETING
                          </Button>

                          {inSession ? (
                            <Button
                              variant="secondary"
                              icon={LogOut}
                              loading={leave.isPending}
                              onClick={() => leave.mutate(m._id)}
                            >
                              I left
                            </Button>
                          ) : null}
                        </>
                      ) : (
                        // The server only hands out the link shortly before the
                        // class, so do not offer a button that would be refused.
                        <div className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink-50 px-4 py-2.5 text-sm text-ink-600">
                          <Lock className="h-4 w-4 shrink-0 text-ink-400" />
                          The join button opens {formatTime(m.joinOpensAt)}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Pagination pagination={data?.pagination} onPageChange={setPage} />
    </div>
  );
}
