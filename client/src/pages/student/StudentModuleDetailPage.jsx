import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  FileQuestion,
  FileText,
  Lock,
  PlayCircle,
} from 'lucide-react';
import { moduleApi } from '../../services/endpoints';
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  PageLoader,
  ProgressBar,
} from '../../components/ui';
import { formatDuration } from '../../utils/format';

export default function StudentModuleDetailPage() {
  const { id } = useParams();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['modules', id],
    queryFn: () => moduleApi.get(id),
  });

  if (isLoading) return <PageLoader label="Loading module" />;
  if (isError) return <ErrorState message={error?.message} onRetry={refetch} />;

  const { module, lessons, exam } = data.data;
  const overall = lessons.length
    ? Math.round(lessons.reduce((s, l) => s + (l.progress?.percentage || 0), 0) / lessons.length)
    : 0;

  return (
    <div className="space-y-5">
      <Link
        to="/student/modules"
        className="inline-flex items-center gap-2 text-sm font-medium text-ink-500 hover:text-ink-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to my modules
      </Link>

      <Card className="p-6">
        <h2 className="text-xl font-bold text-ink-900">{module.title}</h2>
        {module.description ? (
          <p className="mt-2 max-w-2xl text-sm text-ink-600">{module.description}</p>
        ) : null}

        <div className="mt-5">
          <div className="mb-1.5 flex justify-between text-sm">
            <span className="text-ink-500">Your progress in this module</span>
            <span className="font-semibold tabular-nums text-ink-900">{overall}%</span>
          </div>
          <ProgressBar value={overall} size="lg" />
        </div>
      </Card>

      {exam ? (
        <Link to={`/student/exams/${exam._id}`} className="card card-hover flex items-center gap-4 p-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <ClipboardList className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-ink-900">{exam.title}</p>
            <p className="text-sm text-ink-500">
              {exam.questionCount} questions - pass mark {exam.passingGrade}%
              {exam.timeLimit ? ` - ${exam.timeLimit} minutes` : ''}
            </p>
          </div>
          <ArrowRight className="h-5 w-5 shrink-0 text-ink-400" />
        </Link>
      ) : null}

      <Card>
        <CardHeader title="Lessons" subtitle={`${lessons.length} in this module`} />

        {lessons.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No lessons yet"
            description="Your teacher has not published any lesson in this module."
            className="py-12"
          />
        ) : (
          <ul className="divide-y divide-ink-100">
            {lessons.map((lesson, index) => {
              const p = lesson.progress;
              const done = p?.completed;

              return (
                <li key={lesson._id}>
                  <Link
                    to={`/student/lessons/${lesson._id}`}
                    className="flex flex-wrap items-center gap-4 px-5 py-4 transition-colors hover:bg-ink-50"
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                        done ? 'bg-emerald-50 text-emerald-600' : 'bg-brand-50 text-brand-700'
                      }`}
                    >
                      {done ? <CheckCircle2 className="h-5 w-5" /> : index + 1}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink-900">{lesson.title}</p>

                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        {lesson.hasVideo ? (
                          <Badge tone={p?.video?.completed ? 'success' : 'neutral'}>
                            <PlayCircle className="h-3 w-3" />
                            {formatDuration(lesson.videoDuration)}
                            {p?.video?.percentage ? ` - ${p.video.percentage}%` : ''}
                          </Badge>
                        ) : null}

                        {lesson.materialCount ? (
                          <Badge tone={p?.material?.anyOpened ? 'success' : 'neutral'}>
                            <FileText className="h-3 w-3" />
                            {lesson.materialCount} file{lesson.materialCount === 1 ? '' : 's'}
                          </Badge>
                        ) : null}

                        {lesson.hasQuiz ? (
                          <Badge tone={p?.quiz?.completed ? 'success' : 'warning'}>
                            <FileQuestion className="h-3 w-3" />
                            {p?.quiz?.completed ? `Quiz ${p.quiz.score}%` : 'Quiz to do'}
                          </Badge>
                        ) : null}
                      </div>

                      <ProgressBar
                        value={p?.percentage || 0}
                        className="mt-2 max-w-xs"
                        size="sm"
                        showLabel
                      />
                    </div>

                    <ArrowRight className="h-4 w-4 shrink-0 text-ink-400" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
