import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Eye,
  EyeOff,
  FileQuestion,
  FileText,
  Pencil,
  Plus,
  PlayCircle,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { moduleApi, lessonApi } from '../../services/endpoints';
import { useAuth } from '../../context/AuthContext';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  PageLoader,
  Textarea,
  Toggle,
} from '../../components/ui';
import { PERMISSIONS } from '../../utils/constants';
import { formatDuration } from '../../utils/format';

const EMPTY = { title: '', description: '', isPublished: false };

export default function ModuleDetailPage({ basePath = '/teacher' }) {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const canEdit = can(PERMISSIONS.MANAGE_CONTENT);

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [deleting, setDeleting] = useState(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['modules', id],
    queryFn: () => moduleApi.get(id),
  });

  useEffect(() => {
    if (editing === 'new') setForm(EMPTY);
    else if (editing) {
      setForm({
        title: editing.title,
        description: editing.description || '',
        isPublished: editing.isPublished,
      });
    }
  }, [editing]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['modules'] });
    queryClient.invalidateQueries({ queryKey: ['lessons'] });
  };

  const save = useMutation({
    mutationFn: (payload) =>
      editing === 'new'
        ? lessonApi.create({ ...payload, module: id })
        : lessonApi.update(editing._id, payload),
    onSuccess: (res) => {
      toast.success(res.message);
      setEditing(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const togglePublish = useMutation({
    mutationFn: (lessonId) => lessonApi.togglePublish(lessonId),
    onSuccess: (res) => {
      toast.success(res.message);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const reorder = useMutation({
    mutationFn: (items) => lessonApi.reorder(items),
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (lessonId) => lessonApi.remove(lessonId),
    onSuccess: () => {
      toast.success('Lesson deleted');
      setDeleting(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <PageLoader label="Loading module" />;
  if (isError) return <ErrorState message={error?.message} onRetry={refetch} />;

  const { module, lessons, exam } = data.data;

  const move = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= lessons.length) return;
    const a = lessons[index];
    const b = lessons[target];
    reorder.mutate([
      { id: a._id, order: b.order },
      { id: b._id, order: a.order },
    ]);
  };

  return (
    <div className="space-y-5">
      <Link
        to={`${basePath}/modules`}
        className="inline-flex items-center gap-2 text-sm font-medium text-ink-500 hover:text-ink-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to modules
      </Link>

      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-ink-900">{module.title}</h2>
              <Badge tone={module.isPublished ? 'success' : 'neutral'}>
                {module.isPublished ? 'Published' : 'Draft'}
              </Badge>
            </div>
            {module.description ? (
              <p className="mt-2 max-w-2xl text-sm text-ink-600">{module.description}</p>
            ) : null}
          </div>

          {canEdit ? (
            <Button icon={Plus} onClick={() => setEditing('new')}>
              Add lesson
            </Button>
          ) : null}
        </div>

        {!module.isPublished ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            This module is a draft. Students cannot see it or any lesson inside it.
          </div>
        ) : null}
      </Card>

      {/* Exam */}
      <Card>
        <CardHeader
          title="Module exam"
          subtitle="The larger assessment for this module"
          action={
            exam ? (
              <Link to={`${basePath}/exams/${exam._id}/results`} className="btn-secondary btn-sm">
                View results
              </Link>
            ) : (
              <Link to={`${basePath}/exams?module=${module._id}`} className="btn-secondary btn-sm">
                Create exam
              </Link>
            )
          }
        />
        <div className="px-5 py-4">
          {exam ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <ClipboardList className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-900">{exam.title}</p>
                <p className="text-xs text-ink-500">
                  {exam.questionCount} questions - pass mark {exam.passingGrade}% - {exam.timeLimit || 'no'}{' '}
                  {exam.timeLimit ? 'minute limit' : 'time limit'}
                </p>
              </div>
              <Badge tone={exam.isPublished ? 'success' : 'neutral'}>
                {exam.isPublished ? 'Published' : 'Draft'}
              </Badge>
            </div>
          ) : (
            <p className="text-sm text-ink-500">No exam attached to this module yet.</p>
          )}
        </div>
      </Card>

      {/* Lessons */}
      <Card>
        <CardHeader title="Lessons" subtitle={`${lessons.length} in this module`} />

        {lessons.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No lessons yet"
            description="Add your first lesson, then upload a video, attach materials and build a quiz."
            action={
              canEdit ? (
                <Button icon={Plus} onClick={() => setEditing('new')}>
                  Add lesson
                </Button>
              ) : null
            }
            className="py-12"
          />
        ) : (
          <ul className="divide-y divide-ink-100">
            {lessons.map((lesson, index) => (
              <li key={lesson._id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-sm font-bold text-brand-700">
                  {index + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <Link
                    to={`${basePath}/lessons/${lesson._id}`}
                    className="truncate font-medium text-ink-900 hover:text-brand-700"
                  >
                    {lesson.title}
                  </Link>

                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Badge tone={lesson.hasVideo ? 'info' : 'neutral'}>
                      <PlayCircle className="h-3 w-3" />
                      {lesson.hasVideo ? formatDuration(lesson.videoDuration) : 'No video'}
                    </Badge>
                    <Badge tone={lesson.materialCount ? 'brand' : 'neutral'}>
                      <FileText className="h-3 w-3" />
                      {lesson.materialCount} file{lesson.materialCount === 1 ? '' : 's'}
                    </Badge>
                    <Badge tone={lesson.hasQuiz ? 'warning' : 'neutral'}>
                      <FileQuestion className="h-3 w-3" />
                      {lesson.hasQuiz ? `${lesson.quizQuestionCount} questions` : 'No quiz'}
                    </Badge>
                    <Badge tone={lesson.isPublished ? 'success' : 'neutral'}>
                      {lesson.isPublished ? 'Published' : 'Draft'}
                    </Badge>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <Link to={`${basePath}/lessons/${lesson._id}`} className="btn-secondary btn-sm">
                    Open
                  </Link>
                  {canEdit ? (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={lesson.isPublished ? EyeOff : Eye}
                        onClick={() => togglePublish.mutate(lesson._id)}
                        aria-label={lesson.isPublished ? 'Unpublish' : 'Publish'}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={Pencil}
                        onClick={() => setEditing(lesson)}
                        aria-label="Edit lesson"
                      />
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
                        disabled={index === lessons.length - 1}
                        onClick={() => move(index, 1)}
                        aria-label="Move down"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={Trash2}
                        onClick={() => setDeleting(lesson)}
                        aria-label="Delete lesson"
                      />
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Add lesson' : 'Edit lesson'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate(form)} loading={save.isPending}>
              {editing === 'new' ? 'Add lesson' : 'Save changes'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Title" required>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Lesson 1 - Types of Words"
            />
          </Field>
          <Field label="Description" hint="What the student will learn.">
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={5}
            />
          </Field>
          <div className="rounded-xl border border-ink-200 p-4">
            <Toggle
              checked={form.isPublished}
              onChange={(v) => setForm({ ...form, isPublished: v })}
              label="Published"
              description="Publishing notifies every approved student."
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
        description="The lesson and its quiz are removed from student view."
        confirmLabel="Delete lesson"
      />
    </div>
  );
}
