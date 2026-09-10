import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, ClipboardList, Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { examApi } from '../../services/endpoints';
import { useAuth } from '../../context/AuthContext';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  SkeletonCard,
} from '../../components/ui';
import { PERMISSIONS } from '../../utils/constants';
import { formatDate } from '../../utils/format';

export default function ExamsPage({ basePath = '/teacher' }) {
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const canEdit = can(PERMISSIONS.CREATE_EXAMS) || can(PERMISSIONS.MANAGE_CONTENT);
  const [deleting, setDeleting] = useState(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['exams'],
    queryFn: () => examApi.list(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['exams'] });

  const togglePublish = useMutation({
    mutationFn: (id) => examApi.togglePublish(id),
    onSuccess: (res) => {
      toast.success(res.message);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id) => examApi.remove(id),
    onSuccess: () => {
      toast.success('Exam deleted');
      setDeleting(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const exams = data?.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-600">Exams belong to a module and cover several lessons.</p>
        {canEdit ? (
          <Link to={`${basePath}/exams/new`} className="btn-primary">
            <Plus className="h-4 w-4" />
            Create exam
          </Link>
        ) : null}
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : isError ? (
        <ErrorState message={error?.message} onRetry={refetch} />
      ) : exams.length === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardList}
            title="No exams yet"
            description="Create an exam to assess a whole module."
            action={
              canEdit ? (
                <Link to={`${basePath}/exams/new`} className="btn-primary">
                  Create exam
                </Link>
              ) : null
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {exams.map((ex) => (
            <Card key={ex._id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-ink-900">{ex.title}</h3>
                  <p className="truncate text-sm text-ink-500">{ex.module?.title}</p>
                </div>
                <Badge tone={ex.isPublished ? 'success' : 'neutral'}>
                  {ex.isPublished ? 'Published' : 'Draft'}
                </Badge>
              </div>

              {ex.description ? (
                <p className="mt-2 line-clamp-2 text-sm text-ink-600">{ex.description}</p>
              ) : null}

              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-500">Questions</dt>
                  <dd className="font-semibold tabular-nums text-ink-800">{ex.questionCount}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-500">Points</dt>
                  <dd className="font-semibold tabular-nums text-ink-800">{ex.totalPoints}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-500">Pass mark</dt>
                  <dd className="font-semibold tabular-nums text-ink-800">{ex.passingGrade}%</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-500">Time limit</dt>
                  <dd className="font-semibold tabular-nums text-ink-800">
                    {ex.timeLimit ? `${ex.timeLimit} min` : 'None'}
                  </dd>
                </div>
              </dl>

              {ex.availableFrom || ex.availableTo ? (
                <p className="mt-3 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">
                  Open {ex.availableFrom ? `from ${formatDate(ex.availableFrom)}` : 'now'}
                  {ex.availableTo ? ` until ${formatDate(ex.availableTo)}` : ''}
                </p>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-1.5 border-t border-ink-100 pt-4">
                <Link to={`${basePath}/exams/${ex._id}/results`} className="btn-secondary btn-sm">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Results
                </Link>
                {canEdit ? (
                  <>
                    <Link to={`${basePath}/exams/${ex._id}/edit`} className="btn-ghost btn-sm">
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Link>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={ex.isPublished ? EyeOff : Eye}
                      loading={togglePublish.isPending && togglePublish.variables === ex._id}
                      onClick={() => togglePublish.mutate(ex._id)}
                    >
                      {ex.isPublished ? 'Unpublish' : 'Publish'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={Trash2}
                      onClick={() => setDeleting(ex)}
                      aria-label="Delete exam"
                    />
                  </>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => remove.mutate(deleting._id)}
        loading={remove.isPending}
        title={`Delete "${deleting?.title || ''}"?`}
        description="Students can no longer sit it. Existing attempts are kept."
        confirmLabel="Delete exam"
      />
    </div>
  );
}
