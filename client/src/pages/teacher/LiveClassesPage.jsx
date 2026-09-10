import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Ban,
  Calendar,
  Copy,
  ExternalLink,
  Pencil,
  Plus,
  Radio,
  Square,
  Trash2,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { meetingApi } from '../../services/endpoints';
import { useAuth } from '../../context/AuthContext';
import { onSocketEvent, SOCKET_EVENTS } from '../../services/socket';
import MeetingFormModal from './MeetingFormModal';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Pagination,
  ProgressBar,
  SkeletonCard,
  Tabs,
} from '../../components/ui';
import { formatDate, formatTime, formatDateTime } from '../../utils/format';
import { PERMISSIONS } from '../../utils/constants';

const SCOPES = [
  { value: 'UPCOMING', label: 'Upcoming' },
  { value: 'LIVE', label: 'Live now' },
  { value: 'PAST', label: 'Past' },
  { value: 'ALL', label: 'All' },
];

export default function LiveClassesPage({ basePath = '/teacher' }) {
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const canManage = can(PERMISSIONS.MANAGE_MEETINGS);

  const [scope, setScope] = useState('UPCOMING');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [finalizing, setFinalizing] = useState(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['meetings', scope, page],
    queryFn: () => meetingApi.list({ scope, page, limit: 12 }),
    keepPreviousData: true,
    refetchInterval: scope === 'LIVE' ? 30000 : false,
  });

  useEffect(() => {
    const off = onSocketEvent(SOCKET_EVENTS.MEETING_UPDATED, () =>
      queryClient.invalidateQueries({ queryKey: ['meetings'] })
    );
    const offJoin = onSocketEvent(SOCKET_EVENTS.MEETING_STUDENT_JOINED, (payload) => {
      toast(`${payload.studentName} joined the live class`, { icon: '👋' });
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
    });
    return () => {
      off();
      offJoin();
    };
  }, [queryClient]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['meetings'] });

  const cancel = useMutation({
    mutationFn: (id) => meetingApi.cancel(id, 'Cancelled by the teacher'),
    onSuccess: () => {
      toast.success('Meeting cancelled');
      setCancelling(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id) => meetingApi.remove(id),
    onSuccess: () => {
      toast.success('Meeting deleted');
      setDeleting(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const finalize = useMutation({
    mutationFn: (id) => meetingApi.finalize(id),
    onSuccess: () => {
      toast.success('Meeting closed and attendance finalized');
      setFinalizing(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const join = useMutation({
    mutationFn: (id) => meetingApi.join(id),
    onSuccess: (res) => {
      window.open(res.data.meetingUrl, '_blank', 'noopener');
    },
    onError: (e) => toast.error(e.message),
  });

  const copyLink = async (id) => {
    try {
      const res = await meetingApi.join(id);
      await navigator.clipboard.writeText(res.data.meetingUrl);
      toast.success('Meeting link copied');
    } catch (e) {
      toast.error(e.message || 'Could not copy the link');
    }
  };

  const meetings = data?.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-600">
          Create a class, choose who is invited, and see who actually attended.
        </p>
        {canManage ? (
          <Button icon={Plus} onClick={() => setEditing('new')}>
            Create meeting
          </Button>
        ) : null}
      </div>

      <Tabs
        tabs={SCOPES}
        active={scope}
        onChange={(v) => {
          setScope(v);
          setPage(1);
        }}
      />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : isError ? (
        <ErrorState message={error?.message} onRetry={refetch} />
      ) : meetings.length === 0 ? (
        <Card>
          <EmptyState
            icon={Radio}
            title={scope === 'LIVE' ? 'Nothing live right now' : 'No live classes here'}
            description={
              scope === 'UPCOMING'
                ? 'Schedule a live class and invite your students.'
                : 'Meetings appear here once they are scheduled.'
            }
            action={
              canManage ? (
                <Button icon={Plus} onClick={() => setEditing('new')}>
                  Create meeting
                </Button>
              ) : null
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {meetings.map((m) => (
            <Card key={m._id} className={m.liveNow ? 'border-rose-300 shadow-elevated' : ''}>
              {m.liveNow ? (
                <div className="flex items-center gap-2 rounded-t-2xl bg-rose-600 px-4 py-2 text-white">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                  <span className="text-xs font-bold uppercase tracking-wide">Live now</span>
                </div>
              ) : null}

              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-ink-900">{m.title}</h3>
                    {m.module?.title ? (
                      <p className="truncate text-sm text-ink-500">{m.module.title}</p>
                    ) : null}
                  </div>
                  <Badge
                    tone={
                      m.status === 'LIVE'
                        ? 'danger'
                        : m.status === 'UPCOMING'
                          ? 'info'
                          : m.status === 'CANCELLED'
                            ? 'neutral'
                            : 'success'
                    }
                  >
                    {m.status}
                  </Badge>
                </div>

                <div className="mt-3 space-y-1.5 text-sm text-ink-600">
                  <p className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-ink-400" />
                    {formatDate(m.startTime)} - {formatTime(m.startTime)} to {formatTime(m.endTime)}
                  </p>
                  <p className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-ink-400" />
                    {m.studentCount} invited - {m.provider}
                  </p>
                </div>

                {m.status === 'ENDED' ? (
                  <div className="mt-4">
                    <div className="mb-1.5 flex justify-between text-xs">
                      <span className="text-ink-500">Attendance</span>
                      <span className="font-semibold text-ink-800">
                        {m.attendance.attended}/{m.attendance.invited}
                      </span>
                    </div>
                    <ProgressBar value={m.attendance.percentage} size="sm" />
                  </div>
                ) : null}

                {m.status === 'CANCELLED' && m.cancelledReason ? (
                  <p className="mt-3 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">
                    {m.cancelledReason}
                  </p>
                ) : null}

                <div className="mt-5 flex flex-wrap gap-1.5 border-t border-ink-100 pt-4">
                  {m.status === 'LIVE' || m.status === 'UPCOMING' ? (
                    <Button
                      size="sm"
                      icon={ExternalLink}
                      loading={join.isPending && join.variables === m._id}
                      onClick={() => join.mutate(m._id)}
                    >
                      Open meeting
                    </Button>
                  ) : null}

                  <Link to={`${basePath}/live-classes/${m._id}/attendance`} className="btn-secondary btn-sm">
                    <Users className="h-3.5 w-3.5" />
                    Attendance
                  </Link>

                  {canManage ? (
                    <>
                      <Button size="sm" variant="ghost" icon={Copy} onClick={() => copyLink(m._id)}>
                        Copy link
                      </Button>

                      {m.status !== 'ENDED' && m.status !== 'CANCELLED' ? (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={Pencil}
                            onClick={() => setEditing(m)}
                            aria-label="Edit meeting"
                          />
                          {m.status === 'LIVE' ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={Square}
                              onClick={() => setFinalizing(m)}
                            >
                              End
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={Ban}
                              onClick={() => setCancelling(m)}
                            >
                              Cancel
                            </Button>
                          )}
                        </>
                      ) : null}

                      <Button
                        size="sm"
                        variant="ghost"
                        icon={Trash2}
                        onClick={() => setDeleting(m)}
                        aria-label="Delete meeting"
                      />
                    </>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Pagination pagination={data?.pagination} onPageChange={setPage} />

      {canManage ? (
        <MeetingFormModal
          open={Boolean(editing)}
          meeting={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            invalidate();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        onConfirm={() => cancel.mutate(cancelling._id)}
        loading={cancel.isPending}
        title={`Cancel "${cancelling?.title || ''}"?`}
        description="Every invited student is notified that the class is cancelled."
        confirmLabel="Cancel meeting"
      />

      <ConfirmDialog
        open={Boolean(finalizing)}
        onClose={() => setFinalizing(null)}
        onConfirm={() => finalize.mutate(finalizing._id)}
        loading={finalize.isPending}
        tone="primary"
        title={`End "${finalizing?.title || ''}" now?`}
        description="Attendance is closed and each student is marked attended or absent."
        confirmLabel="End and finalize"
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => remove.mutate(deleting._id)}
        loading={remove.isPending}
        title={`Delete "${deleting?.title || ''}"?`}
        description="The meeting and its attendance record are removed from your lists."
        confirmLabel="Delete meeting"
      />
    </div>
  );
}
