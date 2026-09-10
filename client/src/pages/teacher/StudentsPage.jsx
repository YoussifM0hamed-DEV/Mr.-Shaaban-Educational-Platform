import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Trash2, Users, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { studentApi } from '../../services/endpoints';
import { useAuth } from '../../context/AuthContext';
import { useDebounced } from '../../hooks/useDebounced';
import {
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  EngagementBadge,
  ErrorState,
  Field,
  Modal,
  Pagination,
  ProgressBar,
  SearchInput,
  Select,
  SkeletonTable,
  StatusBadge,
  Tabs,
  Textarea,
} from '../../components/ui';
import { relativeDay } from '../../utils/format';
import { PERMISSIONS, ROLES } from '../../utils/constants';

const STATUS_TABS = [
  { value: 'ALL', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

const ENGAGEMENT_OPTIONS = [
  { value: 'ALL', label: 'Any engagement' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'AT_RISK', label: 'At risk' },
  { value: 'INACTIVE', label: 'Inactive' },
];

const SORT_OPTIONS = [
  { value: '-createdAt', label: 'Newest first' },
  { value: 'createdAt', label: 'Oldest first' },
  { value: 'name', label: 'Name A-Z' },
  { value: '-name', label: 'Name Z-A' },
  { value: '-lastActivityAt', label: 'Recently active' },
  { value: 'lastActivityAt', label: 'Least recently active' },
];

export default function StudentsPage({ basePath = '/teacher' }) {
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { can, user } = useAuth();

  const status = params.get('status') || 'ALL';
  const engagement = params.get('engagement') || 'ALL';
  const sort = params.get('sort') || '-createdAt';
  const page = Number(params.get('page') || 1);

  const [search, setSearch] = useState(params.get('search') || '');
  const debouncedSearch = useDebounced(search, 350);

  const [selected, setSelected] = useState([]);
  const [rejecting, setRejecting] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [deleting, setDeleting] = useState(null);

  const canApprove = can(PERMISSIONS.MANAGE_STUDENT_APPROVAL);
  const isTeacher = user?.role === ROLES.TEACHER;

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (!value || value === 'ALL') next.delete(key);
    else next.set(key, value);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  useEffect(() => {
    setParam('search', debouncedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  useEffect(() => setSelected([]), [status, engagement, page, debouncedSearch]);

  const listQuery = useQuery({
    queryKey: ['students', 'list', { status, engagement, sort, page, search: debouncedSearch }],
    queryFn: () =>
      studentApi.list({
        status,
        engagement,
        sort,
        page,
        limit: 20,
        search: debouncedSearch || undefined,
      }),
    keepPreviousData: true,
  });

  const statsQuery = useQuery({ queryKey: ['students', 'stats'], queryFn: studentApi.stats });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['students'] });
    queryClient.invalidateQueries({ queryKey: ['analytics'] });
  };

  const review = useMutation({
    mutationFn: ({ id, decision, reason }) => studentApi.review(id, { decision, reason }),
    onSuccess: (res) => {
      toast.success(res.message);
      invalidate();
      setRejecting(null);
      setRejectReason('');
    },
    onError: (e) => toast.error(e.message),
  });

  const bulkReview = useMutation({
    mutationFn: (payload) => studentApi.bulkReview(payload),
    onSuccess: (res) => {
      toast.success(res.message);
      setSelected([]);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id) => studentApi.remove(id),
    onSuccess: () => {
      toast.success('Student removed');
      setDeleting(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const students = listQuery.data?.data ?? [];
  const pagination = listQuery.data?.pagination;
  const stats = statsQuery.data?.data;

  const tabs = useMemo(
    () =>
      STATUS_TABS.map((t) => ({
        ...t,
        count:
          t.value === 'ALL'
            ? stats?.total
            : t.value === 'PENDING'
              ? stats?.pending
              : t.value === 'APPROVED'
                ? stats?.approved
                : stats?.rejected,
      })),
    [stats]
  );

  const pendingOnScreen = students.filter((s) => s.status === 'PENDING');
  const allPendingSelected =
    pendingOnScreen.length > 0 && pendingOnScreen.every((s) => selected.includes(s._id));

  const toggleAllPending = () => {
    if (allPendingSelected) setSelected([]);
    else setSelected(pendingOnScreen.map((s) => s._id));
  };

  return (
    <div className="space-y-5">
      {/* Filters */}
      <Card className="p-4">
        <Tabs tabs={tabs} active={status} onChange={(v) => setParam('status', v)} className="-mt-1 mb-4" />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SearchInput
            value={search}
            onChange={setSearch}
            onClear={() => setSearch('')}
            placeholder="Search name, email or phone"
            className="lg:col-span-2"
          />
          <Select
            value={engagement}
            onChange={(e) => setParam('engagement', e.target.value)}
            options={ENGAGEMENT_OPTIONS}
          />
          <Select value={sort} onChange={(e) => setParam('sort', e.target.value)} options={SORT_OPTIONS} />
        </div>

        {stats ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone="success">{stats.engagement.active} active</Badge>
            <Badge tone="warning">{stats.engagement.atRisk} at risk</Badge>
            <Badge tone="danger">{stats.engagement.inactive} inactive</Badge>
          </div>
        ) : null}
      </Card>

      {/* Bulk approval bar */}
      {canApprove && selected.length > 0 ? (
        <div className="sticky top-20 z-20 flex flex-wrap items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 shadow-card">
          <p className="flex-1 text-sm font-medium text-brand-900">
            {selected.length} student{selected.length === 1 ? '' : 's'} selected
          </p>
          <Button
            size="sm"
            icon={Check}
            loading={bulkReview.isPending}
            onClick={() => bulkReview.mutate({ studentIds: selected, decision: 'APPROVE' })}
          >
            Approve
          </Button>
          <Button
            size="sm"
            variant="danger"
            icon={X}
            loading={bulkReview.isPending}
            onClick={() =>
              bulkReview.mutate({
                studentIds: selected,
                decision: 'REJECT',
                reason: 'Registration not approved',
              })
            }
          >
            Reject
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
            Clear
          </Button>
        </div>
      ) : null}

      {/* Table */}
      {listQuery.isLoading ? (
        <SkeletonTable rows={8} cols={6} />
      ) : listQuery.isError ? (
        <ErrorState message={listQuery.error?.message} onRetry={listQuery.refetch} />
      ) : students.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title="No students match"
            description={
              debouncedSearch
                ? 'Try a different search term or clear the filters.'
                : 'Students appear here as soon as they register.'
            }
          />
        </Card>
      ) : (
        <div className="table-wrap">
          <table className="w-full">
            <thead className="border-b border-ink-200 bg-ink-50/60">
              <tr>
                {canApprove ? (
                  <th className="th w-10">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-ink-300 text-brand-600"
                      checked={allPendingSelected}
                      onChange={toggleAllPending}
                      disabled={pendingOnScreen.length === 0}
                      aria-label="Select all pending students"
                    />
                  </th>
                ) : null}
                <th className="th">Student</th>
                <th className="th">Status</th>
                <th className="th">Progress</th>
                <th className="th">Engagement</th>
                <th className="th">Video</th>
                <th className="th">Quiz</th>
                <th className="th">Exam</th>
                <th className="th">Attendance</th>
                <th className="th">Last activity</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-ink-100">
              {students.map((s) => {
                const p = s.progress || {};
                return (
                  <tr key={s._id} className="transition-colors hover:bg-ink-50/60">
                    {canApprove ? (
                      <td className="td">
                        {s.status === 'PENDING' ? (
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-ink-300 text-brand-600"
                            checked={selected.includes(s._id)}
                            onChange={() =>
                              setSelected((prev) =>
                                prev.includes(s._id)
                                  ? prev.filter((id) => id !== s._id)
                                  : [...prev, s._id]
                              )
                            }
                            aria-label={`Select ${s.name}`}
                          />
                        ) : null}
                      </td>
                    ) : null}

                    <td className="td">
                      <Link to={`${basePath}/students/${s._id}`} className="flex items-center gap-3">
                        <Avatar name={s.name} src={s.avatarUrl} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-ink-900">{s.name}</span>
                          <span className="block truncate text-xs text-ink-500">{s.email}</span>
                        </span>
                      </Link>
                    </td>

                    <td className="td">
                      <StatusBadge status={s.status} />
                    </td>

                    <td className="td w-40">
                      <ProgressBar value={p.overall || 0} showLabel size="sm" />
                    </td>

                    <td className="td">
                      <EngagementBadge engagement={s.engagement} />
                    </td>

                    <td className="td tabular-nums">
                      {p.videosTotal ? `${p.videoProgress || 0}%` : '-'}
                    </td>

                    <td className="td tabular-nums">
                      {p.quizzesTotal ? `${p.quizzesCompleted || 0}/${p.quizzesTotal}` : '-'}
                    </td>

                    <td className="td">
                      {p.examsTaken > 0 ? (
                        <Badge tone="success">{p.avgExamScore ?? 0}%</Badge>
                      ) : (
                        <span className="text-ink-400">Not taken</span>
                      )}
                    </td>

                    <td className="td tabular-nums">
                      {p.meetingsInvited
                        ? `${p.meetingsAttended || 0}/${p.meetingsInvited}`
                        : '-'}
                    </td>

                    <td className="td text-ink-500">{relativeDay(s.lastActivityAt)}</td>

                    <td className="td text-right">
                      <div className="flex justify-end gap-1">
                        {canApprove && s.status !== 'APPROVED' ? (
                          <Button
                            size="sm"
                            icon={Check}
                            loading={review.isPending && review.variables?.id === s._id}
                            onClick={() => review.mutate({ id: s._id, decision: 'APPROVE' })}
                          >
                            Approve
                          </Button>
                        ) : null}
                        {canApprove && s.status !== 'REJECTED' ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={X}
                            onClick={() => setRejecting(s)}
                          >
                            Reject
                          </Button>
                        ) : null}
                        {isTeacher ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={Trash2}
                            onClick={() => setDeleting(s)}
                            aria-label={`Remove ${s.name}`}
                          />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <Pagination pagination={pagination} onPageChange={(p) => setParam('page', String(p))} />
        </div>
      )}

      {/* Reject with a reason */}
      <Modal
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title={`Reject ${rejecting?.name || ''}`}
        description="The student sees this reason on their account screen."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={review.isPending}
              onClick={() =>
                review.mutate({ id: rejecting._id, decision: 'REJECT', reason: rejectReason })
              }
            >
              Reject registration
            </Button>
          </>
        }
      >
        <Field label="Reason" hint="Optional, but it helps the student understand.">
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="For example: this registration is a duplicate."
          />
        </Field>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => remove.mutate(deleting._id)}
        loading={remove.isPending}
        title={`Remove ${deleting?.name || 'this student'}?`}
        description="They lose access immediately. Their recorded activity is kept for your reports."
        confirmLabel="Remove student"
      />
    </div>
  );
}
