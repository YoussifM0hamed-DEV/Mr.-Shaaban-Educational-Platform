import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { BookOpen, Pencil, Plus, Radio, Trash2, Users, UsersRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { groupApi, studentApi } from '../../services/endpoints';
import { useAuth } from '../../context/AuthContext';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  MultiSelect,
  Select,
  SkeletonCard,
  Textarea,
} from '../../components/ui';
import { MODULE_COLORS, PERMISSIONS } from '../../utils/constants';
import { pluralize } from '../../utils/format';

const EMPTY = { name: '', description: '', color: 'indigo', students: [] };

const BAR = {
  indigo: 'bg-brand-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  sky: 'bg-sky-500',
  violet: 'bg-violet-500',
};

export default function GroupsPage({ basePath = '/teacher' }) {
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const canEdit = can(PERMISSIONS.MANAGE_CONTENT);

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [deleting, setDeleting] = useState(null);

  const listQuery = useQuery({ queryKey: ['groups'], queryFn: () => groupApi.list() });

  const studentsQuery = useQuery({
    queryKey: ['students', 'options'],
    queryFn: () => studentApi.options(),
    enabled: Boolean(editing),
  });

  // The full record carries the member list, which the summary does not.
  const detailQuery = useQuery({
    queryKey: ['groups', editing?._id],
    queryFn: () => groupApi.get(editing._id),
    enabled: Boolean(editing) && editing !== 'new',
  });

  useEffect(() => {
    if (editing === 'new') setForm(EMPTY);
  }, [editing]);

  useEffect(() => {
    const g = detailQuery.data?.data;
    if (g && editing && editing !== 'new') {
      setForm({
        name: g.group.name,
        description: g.group.description || '',
        color: g.group.color || 'indigo',
        students: g.students.map((s) => s._id),
      });
    }
  }, [detailQuery.data, editing]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['groups'] });
    queryClient.invalidateQueries({ queryKey: ['modules'] });
    queryClient.invalidateQueries({ queryKey: ['analytics'] });
  };

  const save = useMutation({
    mutationFn: (payload) =>
      editing === 'new' ? groupApi.create(payload) : groupApi.update(editing._id, payload),
    onSuccess: (res) => {
      toast.success(res.message);
      setEditing(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id) => groupApi.remove(id),
    onSuccess: (res) => {
      const opened = res.data?.modulesNowOpenToEveryone || [];
      toast.success(res.message);
      if (opened.length) {
        toast(
          `${pluralize(opened.length, 'module')} now open to every student: ${opened.join(', ')}`,
          { icon: '⚠️', duration: 8000 }
        );
      }
      setDeleting(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const groups = listQuery.data?.data ?? [];
  const students = studentsQuery.data?.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-ink-600">
          A group is a set of students. Give a module to a group and only those students can open
          it. Invite a group to a live class and everyone in it is invited at once.
        </p>
        {canEdit ? (
          <Button icon={Plus} onClick={() => setEditing('new')}>
            Create group
          </Button>
        ) : null}
      </div>

      {listQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : listQuery.isError ? (
        <ErrorState message={listQuery.error?.message} onRetry={listQuery.refetch} />
      ) : groups.length === 0 ? (
        <Card>
          <EmptyState
            icon={UsersRound}
            title="No groups yet"
            description="Without groups every approved student sees every published module. Create a group when you teach more than one class."
            action={
              canEdit ? (
                <Button icon={Plus} onClick={() => setEditing('new')}>
                  Create group
                </Button>
              ) : null
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((g) => (
            <Card key={g._id} className="overflow-hidden">
              <div className={clsx('h-1.5', BAR[g.color] || BAR.indigo)} />
              <div className="p-5">
                <Link to={`${basePath}/groups/${g._id}`} className="block">
                  <h3 className="truncate font-semibold text-ink-900 hover:text-brand-700">
                    {g.name}
                  </h3>
                </Link>
                {g.description ? (
                  <p className="mt-1 line-clamp-2 text-sm text-ink-600">{g.description}</p>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-1.5">
                  <Badge tone="brand">
                    <Users className="h-3 w-3" />
                    {pluralize(g.studentCount, 'student')}
                  </Badge>
                  <Badge tone={g.moduleCount ? 'info' : 'neutral'}>
                    <BookOpen className="h-3 w-3" />
                    {pluralize(g.moduleCount, 'module')}
                  </Badge>
                  <Badge tone="neutral">
                    <Radio className="h-3 w-3" />
                    {pluralize(g.meetingCount, 'class', 'classes')}
                  </Badge>
                </div>

                <div className="mt-5 flex flex-wrap gap-1.5 border-t border-ink-100 pt-4">
                  <Link to={`${basePath}/groups/${g._id}`} className="btn-secondary btn-sm">
                    Open
                  </Link>
                  {canEdit ? (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={Pencil}
                        onClick={() => setEditing(g)}
                        aria-label="Edit group"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={Trash2}
                        onClick={() => setDeleting(g)}
                        aria-label="Delete group"
                      />
                    </>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Create group' : 'Edit group'}
        description="Pick the students who belong to this group."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate(form)} loading={save.isPending}>
              {editing === 'new' ? 'Create group' : 'Save changes'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Group name" required>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Grade 3 Secondary - Saturday 5pm"
            />
          </Field>

          <Field label="Description" hint="Only you and your assistants see this.">
            <Textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Which class this is, and when it meets."
            />
          </Field>

          <Field label="Accent colour">
            <Select
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
              options={MODULE_COLORS}
            />
          </Field>

          <div>
            <p className="label">Students</p>
            <MultiSelect
              options={students.map((s) => ({
                value: s._id,
                label: s.name,
                sublabel: `${s.email}${s.studentInfo?.grade ? ` - ${s.studentInfo.grade}` : ''}`,
              }))}
              selected={form.students}
              onChange={(students2) => setForm({ ...form, students: students2 })}
              placeholder="Search students"
              emptyLabel="No approved students yet"
            />
            <p className="mt-2 text-xs text-ink-500">
              Only approved students can be added. A student can be in more than one group.
            </p>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => remove.mutate(deleting._id)}
        loading={remove.isPending}
        title={`Delete "${deleting?.name || ''}"?`}
        description={
          deleting?.moduleCount
            ? `This group is used by ${pluralize(deleting.moduleCount, 'module')}. Any module left with no group becomes open to every student.`
            : 'The students stay on the platform. Only the grouping is removed.'
        }
        confirmLabel="Delete group"
      />
    </div>
  );
}
