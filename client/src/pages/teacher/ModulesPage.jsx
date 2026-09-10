import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Layers,
  Pencil,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { moduleApi, groupApi } from '../../services/endpoints';
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
  Select,
  SkeletonCard,
  Textarea,
  Toggle,
} from '../../components/ui';
import { MODULE_COLORS, PERMISSIONS } from '../../utils/constants';
import { pluralize } from '../../utils/format';

const EMPTY = { title: '', description: '', color: 'indigo', groups: [], isPublished: false };

const COLOR_BAR = {
  indigo: 'bg-brand-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  sky: 'bg-sky-500',
  violet: 'bg-violet-500',
};

export default function ModulesPage({ basePath = '/teacher' }) {
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const canEdit = can(PERMISSIONS.MANAGE_CONTENT);

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [deleting, setDeleting] = useState(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['modules'],
    queryFn: moduleApi.list,
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
        description: editing.description || '',
        color: editing.color || 'indigo',
        groups: (editing.groups || []).map((g) => (typeof g === 'string' ? g : g._id)),
        isPublished: editing.isPublished,
      });
    }
  }, [editing]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['modules'] });
    queryClient.invalidateQueries({ queryKey: ['analytics'] });
  };

  const save = useMutation({
    mutationFn: (payload) =>
      editing === 'new' ? moduleApi.create(payload) : moduleApi.update(editing._id, payload),
    onSuccess: (res) => {
      toast.success(res.message);
      setEditing(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const togglePublish = useMutation({
    mutationFn: (id) => moduleApi.togglePublish(id),
    onSuccess: (res) => {
      toast.success(res.message);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const reorder = useMutation({
    mutationFn: (items) => moduleApi.reorder(items),
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id) => moduleApi.remove(id),
    onSuccess: () => {
      toast.success('Module deleted');
      setDeleting(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const modules = data?.data ?? [];

  /** Swaps a module with its neighbour and persists both orders. */
  const move = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= modules.length) return;
    const a = modules[index];
    const b = modules[target];
    reorder.mutate([
      { id: a._id, order: b.order },
      { id: b._id, order: a.order },
    ]);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-600">
          Modules hold your lessons. Students only see published modules.
        </p>
        {canEdit ? (
          <Button icon={Plus} onClick={() => setEditing('new')}>
            Create module
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : isError ? (
        <ErrorState message={error?.message} onRetry={refetch} />
      ) : modules.length === 0 ? (
        <Card>
          <EmptyState
            icon={Layers}
            title="No modules yet"
            description="Create your first module, then add lessons, videos, materials and a quiz."
            action={
              canEdit ? (
                <Button icon={Plus} onClick={() => setEditing('new')}>
                  Create module
                </Button>
              ) : null
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((m, index) => (
            <Card key={m._id} className="overflow-hidden">
              <div className={`h-1.5 ${COLOR_BAR[m.color] || COLOR_BAR.indigo}`} />
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <Link to={`${basePath}/modules/${m._id}`} className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold text-ink-900 hover:text-brand-700">
                      {m.title}
                    </h3>
                  </Link>
                  <Badge tone={m.isPublished ? 'success' : 'neutral'}>
                    {m.isPublished ? 'Published' : 'Draft'}
                  </Badge>
                </div>

                {m.description ? (
                  <p className="mt-2 line-clamp-2 text-sm text-ink-600">{m.description}</p>
                ) : (
                  <p className="mt-2 text-sm italic text-ink-400">No description</p>
                )}

                <div className="mt-4 flex items-center gap-2 text-sm text-ink-500">
                  <BookOpen className="h-4 w-4" />
                  {pluralize(m.lessonCount || 0, 'lesson')}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {(m.groups || []).length === 0 ? (
                    <Badge tone="neutral" icon={Users}>
                      Everyone
                    </Badge>
                  ) : (
                    m.groups.map((g) => (
                      <Badge key={g._id || g} tone="brand" icon={Users}>
                        {g.name || 'Group'}
                      </Badge>
                    ))
                  )}
                </div>

                {canEdit ? (
                  <div className="mt-5 flex flex-wrap gap-1.5 border-t border-ink-100 pt-4">
                    <Link to={`${basePath}/modules/${m._id}`} className="btn-primary btn-sm">
                      Open
                    </Link>
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={m.isPublished ? EyeOff : Eye}
                      loading={togglePublish.isPending && togglePublish.variables === m._id}
                      onClick={() => togglePublish.mutate(m._id)}
                    >
                      {m.isPublished ? 'Unpublish' : 'Publish'}
                    </Button>
                    <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(m)} aria-label="Edit" />
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={ChevronUp}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                      aria-label="Move up"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={ChevronDown}
                      disabled={index === modules.length - 1}
                      onClick={() => move(index, 1)}
                      aria-label="Move down"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={Trash2}
                      onClick={() => setDeleting(m)}
                      aria-label="Delete"
                    />
                  </div>
                ) : (
                  <div className="mt-5 border-t border-ink-100 pt-4">
                    <Link to={`${basePath}/modules/${m._id}`} className="btn-secondary btn-sm">
                      Open module
                    </Link>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Create module' : 'Edit module'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate(form)} loading={save.isPending}>
              {editing === 'new' ? 'Create module' : 'Save changes'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Title" required>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Module 1 - Arabic Grammar Foundations"
            />
          </Field>

          <Field label="Description" hint="Shown to students on the module card.">
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What this module covers"
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
            <p className="label">Who can see it</p>
            {(groupsQuery.data?.data || []).length === 0 ? (
              <p className="rounded-xl border border-ink-200 px-4 py-3 text-sm text-ink-500">
                You have no groups yet, so this module is open to every approved student. Create a
                group first if you teach more than one class.
              </p>
            ) : (
              <>
                <div className="space-y-2 rounded-xl border border-ink-200 p-4">
                  {(groupsQuery.data?.data || []).map((g) => (
                    <Checkbox
                      key={g._id}
                      label={g.name}
                      description={pluralize(g.studentCount, 'student')}
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
                    ? 'No group chosen, so every approved student can open this module.'
                    : `Only students in ${pluralize(form.groups.length, 'group')} can open it.`}
                </p>
              </>
            )}
          </div>

          <div className="rounded-xl border border-ink-200 p-4">
            <Toggle
              checked={form.isPublished}
              onChange={(v) => setForm({ ...form, isPublished: v })}
              label="Published"
              description="Unpublished modules are hidden from every student."
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
        description="Its lessons, quizzes and exams are removed from student view. Recorded progress is kept."
        confirmLabel="Delete module"
      />
    </div>
  );
}
