import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, CheckCircle2, Pencil, Plus, RefreshCw, Trash2, UserCog } from 'lucide-react';
import toast from 'react-hot-toast';
import { assistantApi } from '../../services/endpoints';
import {
  Avatar,
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
  SkeletonTable,
  Spinner,
  StatusBadge,
} from '../../components/ui';
import { formatDate, relativeDay } from '../../utils/format';

const EMPTY = { name: '', email: '', password: '', phone: '', permissions: [] };

export default function AssistantsPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null); // null | 'new' | assistant
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [deleting, setDeleting] = useState(null);

  const listQuery = useQuery({ queryKey: ['assistants'], queryFn: () => assistantApi.list() });

  // The catalogue of permissions never changes, so cache it for the session.
  // If this ever fails the dialog must say so rather than show an empty list,
  // which would read as "this platform has no permissions".
  const permissionsQuery = useQuery({
    queryKey: ['assistants', 'permissions'],
    queryFn: assistantApi.permissions,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (editing === 'new') setForm(EMPTY);
    else if (editing) {
      setForm({
        name: editing.name,
        email: editing.email,
        phone: editing.phone || '',
        password: '',
        permissions: editing.permissions || [],
      });
    }
    setErrors({});
  }, [editing]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['assistants'] });

  const save = useMutation({
    mutationFn: (payload) =>
      editing === 'new'
        ? assistantApi.create(payload)
        : assistantApi.update(editing._id, payload),
    onSuccess: (res) => {
      toast.success(res.message);
      setEditing(null);
      invalidate();
    },
    onError: (err) => {
      if (err.details) {
        const mapped = {};
        err.details.forEach((d) => {
          mapped[d.field] = d.message;
        });
        setErrors(mapped);
      }
      toast.error(err.message);
    },
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }) => assistantApi.setStatus(id, status),
    onSuccess: (res) => {
      toast.success(res.message);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id) => assistantApi.remove(id),
    onSuccess: () => {
      toast.success('Assistant deleted');
      setDeleting(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const assistants = listQuery.data?.data ?? [];
  const permissions = permissionsQuery.data?.data ?? [];

  const togglePermission = (key) =>
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(key)
        ? f.permissions.filter((p) => p !== key)
        : [...f.permissions, key],
    }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      phone: form.phone || undefined,
      permissions: form.permissions,
    };
    if (editing === 'new') {
      payload.email = form.email;
      payload.password = form.password;
    } else if (form.password) {
      payload.password = form.password;
    }
    save.mutate(payload);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-600">
          Assistants help you run this platform. They only get the permissions you grant.
        </p>
        <Button icon={Plus} onClick={() => setEditing('new')}>
          Create assistant
        </Button>
      </div>

      {listQuery.isLoading ? (
        <SkeletonTable rows={4} cols={4} />
      ) : listQuery.isError ? (
        <ErrorState message={listQuery.error?.message} onRetry={listQuery.refetch} />
      ) : assistants.length === 0 ? (
        <Card>
          <EmptyState
            icon={UserCog}
            title="No assistants yet"
            description="Create an assistant to help you approve students, upload content or run live classes."
            action={
              <Button icon={Plus} onClick={() => setEditing('new')}>
                Create assistant
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {assistants.map((a) => (
            <Card key={a._id} className="p-5">
              <div className="flex items-start gap-4">
                <Avatar name={a.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-semibold text-ink-900">{a.name}</h3>
                    <StatusBadge status={a.status} />
                  </div>
                  <p className="truncate text-sm text-ink-500">{a.email}</p>
                  {a.phone ? <p className="text-xs text-ink-400">{a.phone}</p> : null}
                  <p className="mt-1 text-xs text-ink-400">
                    Added {formatDate(a.createdAt)} - last sign-in {relativeDay(a.lastLoginAt)}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                  Permissions ({a.permissions.length})
                </p>
                {a.permissions.length === 0 ? (
                  <p className="mt-2 text-sm text-ink-500">
                    No permissions granted. This assistant can sign in but cannot do anything yet.
                  </p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {a.permissions.map((p) => (
                      <Badge key={p} tone="brand">
                        {permissions.find((x) => x.key === p)?.label || p}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-2 border-t border-ink-100 pt-4">
                <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEditing(a)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={a.status === 'DISABLED' ? CheckCircle2 : Ban}
                  loading={setStatus.isPending && setStatus.variables?.id === a._id}
                  onClick={() =>
                    setStatus.mutate({
                      id: a._id,
                      status: a.status === 'DISABLED' ? 'APPROVED' : 'DISABLED',
                    })
                  }
                >
                  {a.status === 'DISABLED' ? 'Enable' : 'Disable'}
                </Button>
                <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setDeleting(a)}>
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create / edit */}
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Create assistant' : 'Edit assistant'}
        description="Grant only the permissions this person actually needs."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={save.isPending}>
              {editing === 'new' ? 'Create assistant' : 'Save changes'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required error={errors.name}>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Fatma Assistant"
              />
            </Field>
            <Field label="Phone" error={errors.phone}>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+20 100 000 0000"
              />
            </Field>
          </div>

          <Field label="Email address" required error={errors.email}>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="assistant@example.com"
              disabled={editing !== 'new'}
            />
          </Field>

          <Field
            label={editing === 'new' ? 'Password' : 'New password'}
            required={editing === 'new'}
            error={errors.password}
            hint={editing === 'new' ? 'At least 8 characters with a letter and a number' : 'Leave blank to keep the current password'}
          >
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={editing === 'new' ? 'Choose a password' : 'Unchanged'}
              autoComplete="new-password"
            />
          </Field>

          <div>
            <p className="label">Permissions</p>

            {permissionsQuery.isError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                <p className="text-sm font-medium text-rose-800">
                  The permission list could not be loaded.
                </p>
                <p className="mt-1 text-sm text-rose-700">
                  {permissionsQuery.error?.message ||
                    'Check your connection and try again. You cannot grant permissions until it loads.'}
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={RefreshCw}
                  className="mt-3"
                  loading={permissionsQuery.isFetching}
                  onClick={() => permissionsQuery.refetch()}
                >
                  Try again
                </Button>
              </div>
            ) : permissions.length === 0 ? (
              <div className="flex items-center gap-3 rounded-xl border border-ink-200 p-4">
                <Spinner className="h-4 w-4" />
                <p className="text-sm text-ink-600">Loading the permission list</p>
              </div>
            ) : (
              <>
                <div className="grid gap-2.5 rounded-xl border border-ink-200 p-4 sm:grid-cols-2">
                  {permissions.map((p) => (
                    <Checkbox
                      key={p.key}
                      label={p.label}
                      checked={form.permissions.includes(p.key)}
                      onChange={() => togglePermission(p.key)}
                    />
                  ))}
                </div>
                <p className="mt-2 text-xs text-ink-500">
                  {form.permissions.length} of {permissions.length} granted. The backend rejects
                  anything outside this list.
                </p>
              </>
            )}
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => remove.mutate(deleting._id)}
        loading={remove.isPending}
        title={`Delete ${deleting?.name || 'this assistant'}?`}
        description="They lose access immediately. Content they created stays on the platform."
        confirmLabel="Delete assistant"
      />
    </div>
  );
}
