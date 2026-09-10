import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  ExternalLink,
  FileQuestion,
  FileText,
  PlayCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { lessonApi, materialApi } from '../../services/endpoints';
import VideoPlayer from '../../components/shared/VideoPlayer';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  PageLoader,
  ProgressBar,
} from '../../components/ui';
import { formatFileSize } from '../../utils/format';

export default function StudentLessonPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [openedIds, setOpenedIds] = useState(new Set());

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['lessons', id],
    queryFn: () => lessonApi.get(id),
  });

  /**
   * Opening a material is a tracked event: the server records the access and
   * only then returns the file URL, which we open in a new tab.
   */
  const openMaterial = useMutation({
    mutationFn: ({ materialId, download }) => materialApi.open(materialId, download),
    onSuccess: (res, variables) => {
      setOpenedIds((prev) => new Set(prev).add(variables.materialId));
      window.open(res.data.fileUrl, '_blank', 'noopener');
      queryClient.invalidateQueries({ queryKey: ['student'] });
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <PageLoader label="Loading lesson" />;
  if (isError) return <ErrorState message={error?.message} onRetry={refetch} />;

  const { lesson, video, materials, quiz, myProgress } = data.data;
  const materialState = new Map((myProgress?.materials || []).map((m) => [m.materialId, m.opened]));

  return (
    <div className="space-y-5">
      <Link
        to={`/student/modules/${lesson.module._id}`}
        className="inline-flex items-center gap-2 text-sm font-medium text-ink-500 hover:text-ink-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {lesson.module.title}
      </Link>

      <Card className="p-6">
        <h2 className="text-xl font-bold text-ink-900">{lesson.title}</h2>
        <p className="mt-1 text-sm text-ink-500">{lesson.module.title}</p>
        {lesson.description ? (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-700">
            {lesson.description}
          </p>
        ) : null}
      </Card>

      {/* Video */}
      {video ? (
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <PlayCircle className="h-5 w-5 text-brand-600" />
            <h3 className="font-semibold text-ink-900">{video.title}</h3>
          </div>

          <VideoPlayer
            video={video}
            initialProgress={myProgress?.video}
            onCompleted={() => {
              toast.success('Video completed');
              queryClient.invalidateQueries({ queryKey: ['student'] });
            }}
          />
        </Card>
      ) : (
        <Card>
          <EmptyState
            icon={PlayCircle}
            title="No video in this lesson"
            description="Your teacher has not added a video here."
            className="py-10"
          />
        </Card>
      )}

      {/* Materials */}
      <Card>
        <CardHeader
          title="Materials"
          subtitle={`${materials.length} file${materials.length === 1 ? '' : 's'} for this lesson`}
        />

        {materials.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No materials"
            description="Nothing to download for this lesson."
            className="py-10"
          />
        ) : (
          <ul className="divide-y divide-ink-100">
            {materials.map((m) => {
              const opened = openedIds.has(m._id) || materialState.get(m._id);
              return (
                <li key={m._id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-xs font-bold uppercase text-violet-600">
                    {m.fileType || 'file'}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink-900">{m.title || m.fileName}</p>
                    <p className="text-xs text-ink-500">
                      {m.fileType?.toUpperCase()} - {formatFileSize(m.fileSize)}
                    </p>
                  </div>

                  {opened ? (
                    <Badge tone="success">
                      <CheckCircle2 className="h-3 w-3" />
                      Opened
                    </Badge>
                  ) : (
                    <Badge tone="neutral">Not opened</Badge>
                  )}

                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      icon={ExternalLink}
                      loading={
                        openMaterial.isPending && openMaterial.variables?.materialId === m._id
                      }
                      onClick={() => openMaterial.mutate({ materialId: m._id, download: false })}
                    >
                      Open
                    </Button>
                    {m.allowDownload ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={Download}
                        onClick={() => openMaterial.mutate({ materialId: m._id, download: true })}
                      >
                        Download
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Quiz */}
      {quiz ? (
        <Card>
          <CardHeader title="Quiz" subtitle="Check that you understood this lesson" />
          <div className="p-5">
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <FileQuestion className="h-5 w-5" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink-900">{quiz.title}</p>
                <p className="text-sm text-ink-500">
                  {quiz.questionCount} questions - pass mark {quiz.passingGrade}%
                  {quiz.timeLimit ? ` - ${quiz.timeLimit} minutes` : ''}
                </p>

                {myProgress?.quiz ? (
                  <p className="mt-1 text-xs text-ink-500">
                    {myProgress.quiz.attemptsUsed} of {myProgress.quiz.attemptsAllowed} attempts used
                    {myProgress.quiz.bestScore !== null
                      ? ` - best score ${myProgress.quiz.bestScore}%`
                      : ''}
                  </p>
                ) : null}
              </div>

              {myProgress?.quiz?.canAttempt ? (
                <Link to={`/student/quizzes/${quiz._id}`} className="btn-primary">
                  {myProgress.quiz.inProgressAttemptId ? 'Resume quiz' : 'Start quiz'}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <Badge tone={myProgress?.quiz?.passed ? 'success' : 'neutral'}>
                  {myProgress?.quiz?.passed ? 'Passed' : 'No attempts left'}
                </Badge>
              )}
            </div>

            {myProgress?.quiz?.bestScore !== null && myProgress?.quiz?.bestScore !== undefined ? (
              <ProgressBar value={myProgress.quiz.bestScore} className="mt-4" showLabel />
            ) : null}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
