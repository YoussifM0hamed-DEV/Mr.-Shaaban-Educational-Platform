import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, CheckCircle2, ClipboardList, FileText, PlayCircle } from 'lucide-react';
import { studentSelfApi } from '../../services/endpoints';
import ActivityTimeline from '../../components/shared/ActivityTimeline';
import StatCard from '../../components/shared/StatCard';
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  PageLoader,
  ProgressBar,
  ProgressRing,
} from '../../components/ui';

export default function StudentProgressPage() {
  const progressQuery = useQuery({
    queryKey: ['student', 'progress'],
    queryFn: studentSelfApi.progress,
  });

  const activityQuery = useQuery({
    queryKey: ['student', 'activity'],
    queryFn: studentSelfApi.activity,
  });

  if (progressQuery.isLoading) return <PageLoader label="Loading your progress" />;
  if (progressQuery.isError)
    return <ErrorState message={progressQuery.error?.message} onRetry={progressQuery.refetch} />;

  const progress = progressQuery.data.data;
  const s = progress.summary;

  return (
    <div className="space-y-5">
      <Card className="p-6">
        <div className="flex flex-col items-center gap-6 sm:flex-row">
          <ProgressRing value={progress.overall} size={140} sublabel="Overall" />
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <h2 className="text-xl font-bold text-ink-900">
              You have completed {progress.overall}% of the course
            </h2>
            <p className="mt-2 text-sm text-ink-600">
              {s.lessonsCompleted} of {s.lessonsTotal} lessons finished. Progress counts your video
              watching, the materials you opened and the quizzes you completed.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Lessons completed"
          value={`${s.lessonsCompleted}/${s.lessonsTotal}`}
          icon={BookOpen}
          tone="brand"
          progress={s.lessonsTotal ? (s.lessonsCompleted / s.lessonsTotal) * 100 : 0}
        />
        <StatCard
          label="Videos completed"
          value={`${s.videosCompleted}/${s.videosTotal}`}
          icon={PlayCircle}
          tone="info"
          progress={s.videosTotal ? (s.videosCompleted / s.videosTotal) * 100 : 0}
        />
        <StatCard
          label="Materials opened"
          value={`${s.materialsOpened}/${s.materialsTotal}`}
          icon={FileText}
          tone="success"
          progress={s.materialsTotal ? (s.materialsOpened / s.materialsTotal) * 100 : 0}
        />
        <StatCard
          label="Quizzes completed"
          value={`${s.quizzesCompleted}/${s.quizzesTotal}`}
          icon={ClipboardList}
          tone="warning"
          progress={s.quizzesTotal ? (s.quizzesCompleted / s.quizzesTotal) * 100 : 0}
        />
      </div>

      {progress.modules.length === 0 ? (
        <Card>
          <EmptyState
            icon={BookOpen}
            title="Nothing to track yet"
            description="Your teacher has not published any modules."
          />
        </Card>
      ) : (
        progress.modules.map((module) => (
          <Card key={module.moduleId}>
            <CardHeader
              title={module.title}
              subtitle={`${module.lessonCount} lesson${module.lessonCount === 1 ? '' : 's'}`}
              action={
                <div className="w-40">
                  <ProgressBar value={module.percentage} showLabel />
                </div>
              }
            />

            {module.lessons.length === 0 ? (
              <p className="px-5 py-6 text-sm text-ink-500">No published lessons yet.</p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {module.lessons.map((lesson) => (
                  <li key={lesson.lessonId}>
                    <Link
                      to={`/student/lessons/${lesson.lessonId}`}
                      className="flex flex-wrap items-center gap-4 px-5 py-4 transition-colors hover:bg-ink-50"
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                          lesson.completed
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-ink-100 text-ink-400'
                        }`}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink-900">{lesson.title}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {lesson.video ? (
                            <Badge tone={lesson.video.completed ? 'success' : 'neutral'}>
                              Video {lesson.video.percentage}%
                            </Badge>
                          ) : null}
                          {lesson.material ? (
                            <Badge tone={lesson.material.anyOpened ? 'success' : 'neutral'}>
                              {lesson.material.anyOpened
                                ? `Material ${lesson.material.opened}/${lesson.material.total}`
                                : 'Material not opened'}
                            </Badge>
                          ) : null}
                          {lesson.quiz ? (
                            <Badge tone={lesson.quiz.completed ? 'success' : 'warning'}>
                              {lesson.quiz.completed ? `Quiz ${lesson.quiz.score}%` : 'Quiz to do'}
                            </Badge>
                          ) : null}
                        </div>
                      </div>

                      <div className="w-32">
                        <ProgressBar value={lesson.percentage} size="sm" showLabel />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))
      )}

      <Card>
        <CardHeader title="Your recent activity" subtitle="What you have been doing" />
        <div className="p-5">
          <ActivityTimeline
            items={activityQuery.data?.data ?? []}
            emptyMessage="Open a lesson to start building your record."
          />
        </div>
      </Card>
    </div>
  );
}
