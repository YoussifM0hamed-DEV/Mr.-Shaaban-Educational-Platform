import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  FileQuestion,
  FileText,
  Link2,
  PlayCircle,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  lessonApi,
  videoApi,
  materialApi,
  analyticsApi,
  quizApi,
} from '../../services/endpoints';
import { useAuth } from '../../context/AuthContext';
import {
  Avatar,
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
  ProgressBar,
  Tabs,
} from '../../components/ui';
import { formatDuration, formatFileSize, formatDate, relativeDay } from '../../utils/format';
import {
  detectVideoSource,
  SUPPORTED_SOURCES_HINT,
  UNSUPPORTED_SOURCE_MESSAGE,
} from '../../utils/videoSource';
import { PERMISSIONS } from '../../utils/constants';

export default function LessonEditorPage({ basePath = '/teacher' }) {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { can } = useAuth();

  const canVideo = can(PERMISSIONS.UPLOAD_VIDEOS) || can(PERMISSIONS.MANAGE_CONTENT);
  const canMaterial = can(PERMISSIONS.UPLOAD_MATERIALS) || can(PERMISSIONS.MANAGE_CONTENT);
  const canQuiz = can(PERMISSIONS.CREATE_QUIZZES) || can(PERMISSIONS.MANAGE_CONTENT);

  const [tab, setTab] = useState('content');
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkForm, setLinkForm] = useState({ title: '', videoUrl: '', duration: '' });
  const [uploadPercent, setUploadPercent] = useState(null);
  const [deletingMaterial, setDeletingMaterial] = useState(null);
  const [deleteVideoOpen, setDeleteVideoOpen] = useState(false);
  const [watchersOpen, setWatchersOpen] = useState(false);
  const [accessFor, setAccessFor] = useState(null);

  const materialInput = useRef(null);

  const lessonQuery = useQuery({ queryKey: ['lessons', id], queryFn: () => lessonApi.get(id) });
  const analyticsQuery = useQuery({
    queryKey: ['analytics', 'lesson', id],
    queryFn: () => analyticsApi.lesson(id),
    enabled: tab === 'engagement',
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['lessons', id] });

  const linkVideo = useMutation({
    mutationFn: (payload) => lessonApi.setVideo(id, payload),
    onSuccess: (res) => {
      toast.success(res.message || 'Video saved');
      setLinkOpen(false);
      setLinkForm({ title: '', videoUrl: '', duration: '' });
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteVideo = useMutation({
    mutationFn: (videoId) => videoApi.remove(videoId),
    onSuccess: () => {
      toast.success('Video removed');
      setDeleteVideoOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const uploadMaterials = useMutation({
    mutationFn: (files) => {
      const fd = new FormData();
      [...files].forEach((f) => fd.append('files', f));
      return lessonApi.uploadMaterials(id, fd, setUploadPercent);
    },
    onSuccess: () => {
      toast.success('Material uploaded');
      setUploadPercent(null);
      invalidate();
    },
    onError: (e) => {
      toast.error(e.message);
      setUploadPercent(null);
    },
  });

  const deleteMaterial = useMutation({
    mutationFn: (materialId) => materialApi.remove(materialId),
    onSuccess: () => {
      toast.success('Material deleted');
      setDeletingMaterial(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const togglePublish = useMutation({
    mutationFn: () => lessonApi.togglePublish(id),
    onSuccess: (res) => {
      toast.success(res.message);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleQuizPublish = useMutation({
    mutationFn: (quizId) => quizApi.togglePublish(quizId),
    onSuccess: (res) => {
      toast.success(res.message);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  if (lessonQuery.isLoading) return <PageLoader label="Loading lesson" />;
  if (lessonQuery.isError)
    return <ErrorState message={lessonQuery.error?.message} onRetry={lessonQuery.refetch} />;

  const { lesson, video, materials, quiz } = lessonQuery.data.data;

  // Validated in the browser purely so the teacher gets instant feedback.
  // The server checks the same rule again before saving.
  const detectedSource = linkForm.videoUrl ? detectVideoSource(linkForm.videoUrl.trim()) : null;

  return (
    <div className="space-y-5">
      <Link
        to={`${basePath}/modules/${lesson.module._id}`}
        className="inline-flex items-center gap-2 text-sm font-medium text-ink-500 hover:text-ink-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {lesson.module.title}
      </Link>

      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-ink-900">{lesson.title}</h2>
              <Badge tone={lesson.isPublished ? 'success' : 'neutral'}>
                {lesson.isPublished ? 'Published' : 'Draft'}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-ink-500">{lesson.module.title}</p>
            {lesson.description ? (
              <p className="mt-3 max-w-2xl text-sm text-ink-600">{lesson.description}</p>
            ) : null}
          </div>

          <Button
            variant="secondary"
            icon={lesson.isPublished ? EyeOff : Eye}
            loading={togglePublish.isPending}
            onClick={() => togglePublish.mutate()}
          >
            {lesson.isPublished ? 'Unpublish' : 'Publish lesson'}
          </Button>
        </div>
      </Card>

      <Tabs
        tabs={[
          { value: 'content', label: 'Content' },
          { value: 'engagement', label: 'Engagement' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'content' ? (
        <div className="space-y-5">
          {/* Video */}
          <Card>
            <CardHeader
              title="Video"
              subtitle="One video per lesson. Host it on YouTube and paste the link here."
              action={
                canVideo ? (
                  <Button size="sm" icon={Link2} onClick={() => setLinkOpen(true)}>
                    {video ? 'Change video' : 'Add video'}
                  </Button>
                ) : null
              }
            />

            <div className="p-5">
              {video ? (
                <div className="flex flex-wrap items-center gap-4">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                    <PlayCircle className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium text-ink-900">{video.title}</p>
                      <Badge tone={video.provider === 'YOUTUBE' ? 'danger' : 'info'}>
                        {video.provider === 'YOUTUBE' ? 'YouTube' : 'Direct file'}
                      </Badge>
                    </div>
                    <p className="text-xs text-ink-500">
                      {video.duration ? `${formatDuration(video.duration)} - ` : ''}
                      added {formatDate(video.addedAt || video.createdAt)}
                    </p>
                    <a
                      href={video.videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-0.5 block truncate text-xs text-brand-600 hover:underline"
                    >
                      {video.videoUrl}
                    </a>
                  </div>
                  <Button size="sm" variant="secondary" icon={Users} onClick={() => setWatchersOpen(true)}>
                    Who watched
                  </Button>
                  {canVideo ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={Trash2}
                      onClick={() => setDeleteVideoOpen(true)}
                      aria-label="Remove video"
                    />
                  ) : null}
                </div>
              ) : (
                <EmptyState
                  icon={PlayCircle}
                  title="No video yet"
                  description="Paste a YouTube link, or a direct link to a video file."
                  className="py-8"
                />
              )}
            </div>
          </Card>

          {/* Materials */}
          <Card>
            <CardHeader
              title="Materials"
              subtitle="PDF, DOCX, PPTX, images and other files"
              action={
                canMaterial ? (
                  <>
                    <Button
                      size="sm"
                      icon={Upload}
                      onClick={() => materialInput.current?.click()}
                      loading={uploadMaterials.isPending}
                    >
                      Upload files
                    </Button>
                    <input
                      ref={materialInput}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.length) uploadMaterials.mutate(e.target.files);
                        e.target.value = '';
                      }}
                    />
                  </>
                ) : null
              }
            />

            {materials.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No materials yet"
                description="Attach the notes, worksheets or slides for this lesson."
                className="py-8"
              />
            ) : (
              <ul className="divide-y divide-ink-100">
                {materials.map((m) => (
                  <li key={m._id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-xs font-bold uppercase text-violet-600">
                      {m.fileType || 'file'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink-900">{m.title || m.fileName}</p>
                      <p className="text-xs text-ink-500">
                        {formatFileSize(m.fileSize)} - uploaded {formatDate(m.uploadedAt)}
                        {m.allowDownload ? ' - download allowed' : ' - view only'}
                      </p>
                    </div>
                    <Button size="sm" variant="secondary" icon={Users} onClick={() => setAccessFor(m)}>
                      Who opened
                    </Button>
                    <a href={m.fileUrl} target="_blank" rel="noreferrer" className="btn-ghost btn-sm">
                      <Download className="h-3.5 w-3.5" />
                      Open
                    </a>
                    {canMaterial ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={Trash2}
                        onClick={() => setDeletingMaterial(m)}
                        aria-label="Delete material"
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Quiz */}
          <Card>
            <CardHeader
              title="Quiz"
              subtitle="A short check attached to this lesson"
              action={
                canQuiz ? (
                  quiz ? (
                    <div className="flex gap-2">
                      <Link to={`${basePath}/quizzes/${quiz._id}/edit`} className="btn-secondary btn-sm">
                        Edit quiz
                      </Link>
                      <Link to={`${basePath}/quizzes/${quiz._id}/results`} className="btn-secondary btn-sm">
                        Results
                      </Link>
                    </div>
                  ) : (
                    <Link to={`${basePath}/quizzes/new?lesson=${lesson._id}`} className="btn-primary btn-sm">
                      Create quiz
                    </Link>
                  )
                ) : null
              }
            />

            <div className="p-5">
              {quiz ? (
                <div className="flex flex-wrap items-center gap-4">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                    <FileQuestion className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink-900">{quiz.title}</p>
                    <p className="text-xs text-ink-500">
                      {quiz.questionCount} questions - pass mark {quiz.passingGrade}% -{' '}
                      {quiz.attemptsAllowed} attempt{quiz.attemptsAllowed === 1 ? '' : 's'}
                      {quiz.timeLimit ? ` - ${quiz.timeLimit} min limit` : ''}
                    </p>
                  </div>
                  <Badge tone={quiz.isPublished ? 'success' : 'neutral'}>
                    {quiz.isPublished ? 'Published' : 'Draft'}
                  </Badge>
                  {canQuiz ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={quiz.isPublished ? EyeOff : Eye}
                      loading={toggleQuizPublish.isPending}
                      onClick={() => toggleQuizPublish.mutate(quiz._id)}
                    >
                      {quiz.isPublished ? 'Unpublish' : 'Publish'}
                    </Button>
                  ) : null}
                </div>
              ) : (
                <EmptyState
                  icon={FileQuestion}
                  title="No quiz yet"
                  description="Add a quiz so you can see who understood this lesson."
                  className="py-8"
                />
              )}
            </div>
          </Card>
        </div>
      ) : (
        <LessonEngagement query={analyticsQuery} />
      )}

      {/* Add or change the lesson video */}
      <Modal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        title={video ? 'Change the lesson video' : 'Add the lesson video'}
        description="Videos are not stored on this platform. Host it, then paste the link."
        footer={
          <>
            <Button variant="secondary" onClick={() => setLinkOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={linkVideo.isPending}
              disabled={!linkForm.title.trim() || !detectedSource}
              onClick={() =>
                linkVideo.mutate({
                  title: linkForm.title,
                  videoUrl: linkForm.videoUrl,
                  duration: linkForm.duration ? Number(linkForm.duration) : undefined,
                })
              }
            >
              {video ? 'Replace video' : 'Add video'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Title" required>
            <Input
              value={linkForm.title}
              onChange={(e) => setLinkForm({ ...linkForm, title: e.target.value })}
              placeholder="Lesson 1 - video"
            />
          </Field>

          <Field
            label="Video link"
            required
            hint={!linkForm.videoUrl ? SUPPORTED_SOURCES_HINT : undefined}
            error={linkForm.videoUrl && !detectedSource ? UNSUPPORTED_SOURCE_MESSAGE : undefined}
          >
            <Input
              value={linkForm.videoUrl}
              onChange={(e) => setLinkForm({ ...linkForm, videoUrl: e.target.value })}
              placeholder="https://www.youtube.com/watch?v=..."
              error={Boolean(linkForm.videoUrl && !detectedSource)}
            />
          </Field>

          {detectedSource ? (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <p className="text-sm text-emerald-800">
                {detectedSource.provider === 'YOUTUBE'
                  ? 'YouTube video recognised. Watch progress will be tracked.'
                  : 'Direct video file recognised. Watch progress will be tracked.'}
              </p>
            </div>
          ) : null}

          {video ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              This lesson already has a video. Replacing it clears every student&apos;s recorded
              watch progress for the old one.
            </div>
          ) : null}

          <Field
            label="Duration in seconds"
            hint="Optional. The player reads the real duration once it loads."
          >
            <Input
              type="number"
              min="0"
              value={linkForm.duration}
              onChange={(e) => setLinkForm({ ...linkForm, duration: e.target.value })}
              placeholder="600"
            />
          </Field>
        </div>
      </Modal>

      <WatchersModal open={watchersOpen} onClose={() => setWatchersOpen(false)} videoId={video?._id} />
      <MaterialAccessModal material={accessFor} onClose={() => setAccessFor(null)} />

      <ConfirmDialog
        open={deleteVideoOpen}
        onClose={() => setDeleteVideoOpen(false)}
        onConfirm={() => deleteVideo.mutate(video._id)}
        loading={deleteVideo.isPending}
        title="Delete this video?"
        description="The file is removed from storage and every student's watch progress for it is cleared."
        confirmLabel="Delete video"
      />

      <ConfirmDialog
        open={Boolean(deletingMaterial)}
        onClose={() => setDeletingMaterial(null)}
        onConfirm={() => deleteMaterial.mutate(deletingMaterial._id)}
        loading={deleteMaterial.isPending}
        title={`Delete "${deletingMaterial?.fileName || ''}"?`}
        description="The file is removed from storage."
        confirmLabel="Delete file"
      />
    </div>
  );
}

/* ---------------------------------------------------- Engagement tab */

function LessonEngagement({ query }) {
  if (query.isError) return <ErrorState message={query.error?.message} onRetry={query.refetch} />;
  // Covers both loading and the first render after the tab enables the query.
  if (!query.data?.data) return <PageLoader label="Loading engagement" />;

  const a = query.data.data;
  const pct = (n) => (a.totalStudents ? Math.round((n / a.totalStudents) * 100) : 0);

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <p className="text-sm text-ink-500">Approved students</p>
        <p className="text-3xl font-bold tabular-nums text-ink-900">{a.totalStudents}</p>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-ink-600">
            <PlayCircle className="h-4 w-4 text-sky-500" />
            Video
          </div>
          {a.video.exists ? (
            <div className="mt-4 space-y-3">
              <Row label="Started" value={a.video.started} percent={pct(a.video.started)} />
              <Row label="Completed" value={a.video.completed} percent={pct(a.video.completed)} />
              <Row label="Average progress" value={`${a.video.avgProgress}%`} percent={a.video.avgProgress} />
            </div>
          ) : (
            <p className="mt-4 text-sm text-ink-500">No video attached.</p>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-ink-600">
            <FileText className="h-4 w-4 text-violet-500" />
            Materials
          </div>
          {a.material.count ? (
            <div className="mt-4 space-y-3">
              <Row label="Files attached" value={a.material.count} />
              <Row
                label="Students who opened"
                value={a.material.studentsOpened}
                percent={pct(a.material.studentsOpened)}
              />
            </div>
          ) : (
            <p className="mt-4 text-sm text-ink-500">No materials attached.</p>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-ink-600">
            <FileQuestion className="h-4 w-4 text-amber-500" />
            Quiz
          </div>
          {a.quiz.exists ? (
            <div className="mt-4 space-y-3">
              <Row label="Completed" value={a.quiz.completed} percent={pct(a.quiz.completed)} />
              <Row label="Passed" value={a.quiz.passed} percent={pct(a.quiz.passed)} />
              <Row label="Average score" value={`${a.quiz.avgScore}%`} percent={a.quiz.avgScore} />
            </div>
          ) : (
            <p className="mt-4 text-sm text-ink-500">No quiz attached.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, percent }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-ink-600">{label}</span>
        <span className="text-sm font-bold tabular-nums text-ink-900">{value}</span>
      </div>
      {percent !== undefined ? <ProgressBar value={percent} size="sm" className="mt-1.5" /> : null}
    </div>
  );
}

/* ---------------------------------------------- Watchers / access modals */

function WatchersModal({ open, onClose, videoId }) {
  const query = useQuery({
    queryKey: ['videos', videoId, 'watchers'],
    queryFn: () => videoApi.watchers(videoId),
    enabled: open && Boolean(videoId),
  });

  const data = query.data?.data;

  return (
    <Modal open={open} onClose={onClose} title="Who watched this video" size="lg">
      {query.isError ? (
        <ErrorState message={query.error?.message} onRetry={query.refetch} />
      ) : !data ? (
        // Covers loading and the disabled query while the modal is closed.
        <PageLoader label="Loading" />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-3 gap-3">
            <MiniStat label="Started" value={`${data.summary.started}/${data.summary.total}`} />
            <MiniStat label="Completed" value={`${data.summary.completed}/${data.summary.total}`} />
            <MiniStat label="Average" value={`${data.summary.averageProgress}%`} />
          </div>

          <ul className="divide-y divide-ink-100">
            {data.watchers.map((w) => (
              <li key={w.student._id} className="flex items-center gap-3 py-3">
                <Avatar name={w.student.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-900">{w.student.name}</p>
                  <ProgressBar value={w.percentage} size="sm" className="mt-1" />
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums text-ink-900">{w.percentage}%</p>
                  <p className="text-[11px] text-ink-400">
                    {w.completed ? 'Completed' : w.started ? relativeDay(w.lastWatchedAt) : 'Not started'}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}

function MaterialAccessModal({ material, onClose }) {
  const query = useQuery({
    queryKey: ['materials', material?._id, 'access'],
    queryFn: () => materialApi.access(material._id),
    enabled: Boolean(material),
  });

  const data = query.data?.data;

  return (
    <Modal
      open={Boolean(material)}
      onClose={onClose}
      title="Who opened this file"
      description={material?.fileName}
      size="lg"
    >
      {query.isError ? (
        <ErrorState message={query.error?.message} onRetry={query.refetch} />
      ) : !data ? (
        // Covers loading and the disabled query while the modal is closed.
        <PageLoader label="Loading" />
      ) : (
        <>
          <div className="mb-4">
            <MiniStat label="Opened" value={`${data.summary.opened}/${data.summary.total}`} />
          </div>
          <ul className="divide-y divide-ink-100">
            {data.rows.map((r) => (
              <li key={r.student._id} className="flex items-center gap-3 py-3">
                <Avatar name={r.student.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-900">{r.student.name}</p>
                  <p className="text-xs text-ink-500">
                    {r.opened
                      ? `Opened ${r.accessCount} time${r.accessCount === 1 ? '' : 's'} - last ${relativeDay(r.lastOpenedAt)}`
                      : 'Not opened'}
                  </p>
                </div>
                {r.opened ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                ) : (
                  <Badge tone="neutral">Not opened</Badge>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-xl bg-ink-50 px-4 py-3">
      <p className="text-xs text-ink-500">{label}</p>
      <p className="text-lg font-bold tabular-nums text-ink-900">{value}</p>
    </div>
  );
}
