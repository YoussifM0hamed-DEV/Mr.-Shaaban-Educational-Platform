import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Pencil, Pin, Plus, Trash2, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { announcementApi, groupApi } from '../../services/endpoints';
import { useAuth } from '../../context/AuthContext';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  Pagination,
  SkeletonCard,
  Textarea,
  Toggle,
} from '../../components/ui';
import { formatDateTime } from '../../utils/format';
import { PERMISSIONS } from '../../utils/constants';

const EMPTY = { title: '', body: '', groups: [], pinned: false, isPublished: true };

export default function AnnouncementsPage() {
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const canManage = can(PERMISSIONS.MANAGE_ANNOUNCEMENTS);

  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [deleting, setDeleting] = useState(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['announcements', page],
    queryFn: () => announcementApi.list({ page, limit: 10 }),
    keepPreviousData: true,
  });

  const groupsQuery = useQuery({
    queryKey: ['groups'],
    queryFn: () => groupApi.list(),
    enabled: Boolean(editing),
  });

  useEffect(() => {
    if (editing === 'new') setForm(EMPTY);
    else if (editing) {
      setForm({
        title: editing.title,
        body: editing.body,
        groups: (editing.groups || []).map((g) => (typeof g === 'string' ? g : g._id)),
        pinned: editing.pinned,
        isPublished: editing.isPublished,
      });
    }
  }, [editing]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['announcements'] });

  const save = useMutation({
    mutationFn: (payload) =>
      editing === 'new'
        ? announcementApi.create(payload)
        : announcementApi.update(editing._id, payload),
    onSuccess: (res) => {
      toast.success(res.message);
      setEditing(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id) => announcementApi.remove(id),
    onSuccess: () => {
      toast.success('Announcement deleted');
      setDeleting(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const items = data?.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-600">
          Publishing an announcement notifies every approved student.
        </p>
        {canManage ? (
          <Button icon={Plus} onClick={() => setEditing('new')}>
            New announcement
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : isError ? (
        <ErrorState message={error?.message} onRetry={refetch} />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={Megaphone}
            title="No announcements yet"
            description="Tell your students about a schedule change or an upcoming exam."
            action={
              canManage ? (
                <Button icon={Plus} onClick={() => setEditing('new')}>
                  New announcement
                </Button>
              ) : null
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((a) => (
            <Card key={a._id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-ink-900">{a.title}</h3>
                    {a.pinned ? (
                      <Badge tone="brand" icon={Pin}>
                        Pinned
                      </Badge>
                    ) : null}
                    <Badge tone={a.isPublished ? 'success' : 'neutral'}>
                      {a.isPublished ? 'Published' : 'Draft'}
                    </Badge>
                    {(a.groups || []).length === 0 ? (
                      <Badge tone="neutral" icon={Users}>
                        Everyone
                      </Badge>
                    ) : (
                      a.groups.map((g) => (
                        <Badge key={g._id || g} tone="brand" icon={Users}>
                          {g.name || 'Group'}
                        </Badge>
                      ))
                    )}
                  </div>
                  <p className="mt-1 text-xs text-ink-400">
                    {formatDateTime(a.createdAt)}
                    {a.createdBy?.name ? ` by ${a.createdBy.name}` : ''}
                  </p>
                </div>

                {canManage ? (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(a)} aria-label="Edit" />
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={Trash2}
                      onClick={() => setDeleting(a)}
                      aria-label="Delete"
                    />
                  </div>
                ) : null}
              </div>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-700">{a.body}</p>
            </Card>
          ))}
        </div>
      )}

      <Pagination pagination={data?.pagination} onPageChange={setPage} />

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'New announcement' : 'Edit announcement'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate(form)} loading={save.isPending}>
              {editing === 'new' ? 'Publish' : 'Save changes'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Title" required>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Tomorrow's Arabic class starts at 7 PM"
            />
          </Field>
          <Field label="Message" required>
            <Textarea
              rows={6}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="Write what your students need to know."
            />
          </Field>
          <div>
            <p className="label">Who receives it</p>
            {(groupsQuery.data?.data || []).length === 0 ? (
              <p className="rounded-xl border border-ink-200 px-4 py-3 text-sm text-ink-500">
                You have no groups, so this goes to every approved student.
              </p>
            ) : (
              <>
                <div className="space-y-2 rounded-xl border border-ink-200 p-4">
                  {(groupsQuery.data?.data || []).map((g) => (
                    <Checkbox
                      key={g._id}
                      label={g.name}
                      description={`${g.studentCount} student${g.studentCount === 1 ? '' : 's'}`}
                      checked={form.groups.includes(g._id)}
                      onChange={() =>
                        setForm((f) => ({
                          ...f,
                          groups: f.groups.includes(g._id)
                            ? f.groups.filter((x) => x !== g._id)
                            : [...f.groups, g._id],
                        }))
                      }
                    />
                  ))}
                </div>
                <p className="mt-2 text-xs text-ink-500">
                  {form.groups.length === 0
                    ? 'No group chosen, so every approved student receives it.'
                    : `Only the chosen group${form.groups.length === 1 ? '' : 's'} receive it.`}
                </p>
              </>
            )}
          </div>

          <div className="grid gap-3 rounded-xl border border-ink-200 p-4">
            <Toggle
              checked={form.pinned}
              onChange={(v) => setForm({ ...form, pinned: v })}
              label="Pin to the top"
            />
            <Toggle
              checked={form.isPublished}
              onChange={(v) => setForm({ ...form, isPublished: v })}
              label="Published"
              description="Publishing sends a notification to every approved student."
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => remove.mutate(deleting._id)}
        loading={remove.isPending}
        title={`Delete "${deleting?.title || ''}"?`}
        description="Students will no longer see it."
        confirmLabel="Delete announcement"
      />
    </div>
  );
}
