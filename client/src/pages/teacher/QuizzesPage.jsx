import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, Eye, EyeOff, FileQuestion, Pencil, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { quizApi } from '../../services/endpoints';
import { useAuth } from '../../context/AuthContext';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  SkeletonTable,
} from '../../components/ui';
import { PERMISSIONS } from '../../utils/constants';
import { formatDate } from '../../utils/format';

export default function QuizzesPage({ basePath = '/teacher' }) {
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const canEdit = can(PERMISSIONS.CREATE_QUIZZES) || can(PERMISSIONS.MANAGE_CONTENT);

  const [deleting, setDeleting] = useState(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['quizzes'],
    queryFn: () => quizApi.list(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['quizzes'] });

  const togglePublish = useMutation({
    mutationFn: (id) => quizApi.togglePublish(id),
    onSuccess: (res) => {
      toast.success(res.message);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id) => quizApi.remove(id),
    onSuccess: () => {
      toast.success('Quiz deleted');
      setDeleting(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const quizzes = data?.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-600">Each quiz belongs to one lesson.</p>
        {canEdit ? (
          <Link to={`${basePath}/quizzes/new`} className="btn-primary">
            <Plus className="h-4 w-4" />
            Create quiz
          </Link>
        ) : null}
      </div>

      {isLoading ? (
        <SkeletonTable rows={5} cols={5} />
      ) : isError ? (
        <ErrorState message={error?.message} onRetry={refetch} />
      ) : quizzes.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileQuestion}
            title="No quizzes yet"
            description="Create a quiz so you can see who actually understood the lesson."
            action={
              canEdit ? (
                <Link to={`${basePath}/quizzes/new`} className="btn-primary">
                  Create quiz
                </Link>
              ) : null
            }
          />
        </Card>
      ) : (
        <div className="table-wrap">
          <table className="w-full">
            <thead className="border-b border-ink-200 bg-ink-50/60">
              <tr>
                <th className="th">Quiz</th>
                <th className="th">Lesson</th>
                <th className="th">Questions</th>
                <th className="th">Pass mark</th>
                <th className="th">Attempts</th>
                <th className="th">Status</th>
                <th className="th">Created</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {quizzes.map((q) => (
                <tr key={q._id} className="transition-colors hover:bg-ink-50/60">
                  <td className="td font-medium text-ink-900">{q.title}</td>
                  <td className="td text-ink-600">
                    {q.module?.title ? `${q.module.title} - ` : ''}
                    {q.lesson?.title || '-'}
                  </td>
                  <td className="td tabular-nums">
                    {q.questionCount} <span className="text-ink-400">({q.totalPoints} pts)</span>
                  </td>
                  <td className="td tabular-nums">{q.passingGrade}%</td>
                  <td className="td tabular-nums">{q.attemptsAllowed}</td>
                  <td className="td">
                    <Badge tone={q.isPublished ? 'success' : 'neutral'}>
                      {q.isPublished ? 'Published' : 'Draft'}
                    </Badge>
                  </td>
                  <td className="td text-ink-500">{formatDate(q.createdAt)}</td>
                  <td className="td text-right">
                    <div className="flex justify-end gap-1">
                      <Link to={`${basePath}/quizzes/${q._id}/results`} className="btn-secondary btn-sm">
                        <BarChart3 className="h-3.5 w-3.5" />
                        Results
                      </Link>
                      {canEdit ? (
                        <>
                          <Link to={`${basePath}/quizzes/${q._id}/edit`} className="btn-ghost btn-sm">
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={q.isPublished ? EyeOff : Eye}
                            onClick={() => togglePublish.mutate(q._id)}
                            aria-label={q.isPublished ? 'Unpublish' : 'Publish'}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={Trash2}
                            onClick={() => setDeleting(q)}
                            aria-label="Delete quiz"
                          />
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => remove.mutate(deleting._id)}
        loading={remove.isPending}
        title={`Delete "${deleting?.title || ''}"?`}
        description="Students can no longer take it. Existing attempts are kept for your records."
        confirmLabel="Delete quiz"
      />
    </div>
  );
}
