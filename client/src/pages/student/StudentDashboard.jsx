import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  ClipboardList,
  ExternalLink,
  FileQuestion,
  Megaphone,
  PlayCircle,
  Radio,
  TrendingUp,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { studentSelfApi, meetingApi } from '../../services/endpoints';
import { onSocketEvent, SOCKET_EVENTS } from '../../services/socket';
import StatCard from '../../components/shared/StatCard';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  ProgressBar,
  ProgressRing,
  SkeletonCard,
} from '../../components/ui';
import { formatDate, formatTime, relativeTime } from '../../utils/format';

export default function StudentDashboard() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['student', 'dashboard'],
    queryFn: studentSelfApi.dashboard,
    staleTime: 30000,
  });

  // A class going live should show up without a refresh.
  useEffect(() => {
    const off = onSocketEvent(SOCKET_EVENTS.MEETING_LIVE, () =>
      queryClient.invalidateQueries({ queryKey: ['student', 'dashboard'] })
    );
    const offContent = onSocketEvent(SOCKET_EVENTS.CONTENT_UPDATED, () =>
      queryClient.invalidateQueries({ queryKey: ['student'] })
    );
    return () => {
      off();
      offContent();
    };
  }, [queryClient]);

  const join = async (meetingId) => {
    try {
      const res = await meetingApi.join(meetingId);
      window.open(res.data.meetingUrl, '_blank', 'noopener');
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-5">
        <SkeletonCard />
        <div className="grid gap-4 sm:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (isError) return <ErrorState message={error?.message} onRetry={refetch} />;

  const {
    teacher,
    progress,
    continueLesson,
    pendingQuizzes,
    upcomingExams,
    liveNow,
    upcomingMeetings,
    announcements,
    attendance,
  } = data.data;

  return (
    <div className="space-y-5">
      {/* Live now */}
      {liveNow.length > 0 ? (
        <div className="space-y-3">
          {liveNow.map((m) => (
            <div
              key={m._id}
              className="flex flex-wrap items-center gap-4 rounded-2xl bg-gradient-to-r from-rose-600 to-rose-700 px-5 py-4 shadow-elevated"
            >
              <span className="flex h-11 w-11 shrink-0 animate-pulse-ring items-center justify-center rounded-xl bg-white/20 text-white">
                <Radio className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-100">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                  Live now
                </p>
                <p className="truncate text-base font-bold text-white">{teacher.name}</p>
                <p className="truncate text-sm text-rose-100">
                  {m.moduleTitle ? `${m.moduleTitle} - ` : ''}
                  {m.title} - {formatTime(m.startTime)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => join(m._id)}
                className="btn shrink-0 bg-white px-5 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-50"
              >
                <ExternalLink className="h-4 w-4" />
                JOIN MEETING
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {/* Hero */}
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-6 bg-gradient-to-br from-brand-600 to-brand-800 p-6 sm:flex-row sm:items-center">
          <Avatar name={teacher.name} src={teacher.avatarUrl} size="lg" className="ring-4 ring-white/20" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-200">
              Your teacher
            </p>
            <h2 className="text-2xl font-bold text-white">{teacher.name}</h2>
            <p className="text-sm text-brand-100">
              {teacher.subject} - {teacher.platformName}
            </p>
          </div>
          <div className="flex shrink-0 justify-center rounded-2xl bg-white/10 p-3">
            <ProgressRing value={progress.overall} size={104} stroke={9} sublabel="Overall" />
          </div>
        </div>

        <div className="grid grid-cols-2 divide-x divide-ink-100 border-t border-ink-100 sm:grid-cols-4">
          {[
            {
              label: 'Lessons done',
              value: `${progress.summary.lessonsCompleted}/${progress.summary.lessonsTotal}`,
              icon: BookOpen,
            },
            {
              label: 'Videos done',
              value: `${progress.summary.videosCompleted}/${progress.summary.videosTotal}`,
              icon: PlayCircle,
            },
            {
              label: 'Quizzes done',
              value: `${progress.summary.quizzesCompleted}/${progress.summary.quizzesTotal}`,
              icon: FileQuestion,
            },
            {
              label: 'Live attendance',
              value: `${attendance.attended}/${attendance.invited}`,
              icon: Radio,
            },
          ].map((s) => (
            <div key={s.label} className="px-5 py-4">
              <div className="flex items-center gap-2 text-xs text-ink-500">
                <s.icon className="h-3.5 w-3.5" />
                {s.label}
              </div>
              <p className="mt-1 text-lg font-bold tabular-nums text-ink-900">{s.value}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Continue */}
      {continueLesson ? (
        <Link
          to={`/student/lessons/${continueLesson.lessonId}`}
          className="card card-hover flex flex-wrap items-center gap-4 p-5"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <PlayCircle className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
              {continueLesson.percentage > 0 ? 'Continue where you stopped' : 'Start next'}
            </p>
            <p className="truncate font-semibold text-ink-900">{continueLesson.title}</p>
            <p className="truncate text-sm text-ink-500">{continueLesson.moduleTitle}</p>
            <ProgressBar value={continueLesson.percentage} className="mt-2 max-w-sm" size="sm" showLabel />
          </div>
          <ArrowRight className="h-5 w-5 shrink-0 text-ink-400" />
        </Link>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Modules */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="My modules"
            subtitle="Your progress in each module"
            action={
              <Link to="/student/modules" className="btn-ghost btn-sm">
                See all
              </Link>
            }
          />

          {progress.modules.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No modules yet"
              description="Your teacher has not published any modules."
              className="py-10"
            />
          ) : (
            <ul className="divide-y divide-ink-100">
              {progress.modules.map((m) => (
                <li key={m.moduleId}>
                  <Link
                    to={`/student/modules/${m.moduleId}`}
                    className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-ink-50"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                      <BookOpen className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink-900">{m.title}</p>
                      <p className="text-xs text-ink-500">
                        {m.lessonCount} lesson{m.lessonCount === 1 ? '' : 's'}
                      </p>
                      <ProgressBar value={m.percentage} className="mt-1.5" size="sm" showLabel />
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-ink-400" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-5">
          {/* Pending quizzes */}
          <Card>
            <CardHeader title="Quizzes to finish" />
            {pendingQuizzes.length === 0 ? (
              <EmptyState
                icon={FileQuestion}
                title="All caught up"
                description="No quizzes waiting for you."
                className="py-8"
              />
            ) : (
              <ul className="divide-y divide-ink-100">
                {pendingQuizzes.map((q) => (
                  <li key={q.quizId}>
                    <Link
                      to={`/student/quizzes/${q.quizId}`}
                      className="block px-5 py-3.5 transition-colors hover:bg-ink-50"
                    >
                      <p className="truncate text-sm font-medium text-ink-900">{q.title}</p>
                      <p className="truncate text-xs text-ink-500">{q.lessonTitle}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Upcoming exams */}
          <Card>
            <CardHeader title="Upcoming exams" />
            {upcomingExams.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="Nothing scheduled"
                description="No exams waiting."
                className="py-8"
              />
            ) : (
              <ul className="divide-y divide-ink-100">
                {upcomingExams.map((ex) => (
                  <li key={ex._id}>
                    <Link
                      to={`/student/exams/${ex._id}`}
                      className="block px-5 py-3.5 transition-colors hover:bg-ink-50"
                    >
                      <p className="truncate text-sm font-medium text-ink-900">{ex.title}</p>
                      <p className="truncate text-xs text-ink-500">
                        {ex.questionCount} questions
                        {ex.timeLimit ? ` - ${ex.timeLimit} min` : ''}
                        {ex.availableTo ? ` - closes ${formatDate(ex.availableTo)}` : ''}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Upcoming live classes */}
        <Card>
          <CardHeader
            title="Upcoming live classes"
            action={
              <Link to="/student/live-classes" className="btn-ghost btn-sm">
                See all
              </Link>
            }
          />
          {upcomingMeetings.length === 0 ? (
            <EmptyState
              icon={Radio}
              title="No live classes scheduled"
              description="You will get a notification when one is scheduled."
              className="py-8"
            />
          ) : (
            <ul className="divide-y divide-ink-100">
              {upcomingMeetings.map((m) => (
                <li key={m._id} className="flex items-center gap-4 px-5 py-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                    <Calendar className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-900">{m.title}</p>
                    <p className="truncate text-xs text-ink-500">
                      {formatDate(m.startTime)} at {formatTime(m.startTime)}
                      {m.moduleTitle ? ` - ${m.moduleTitle}` : ''}
                    </p>
                  </div>
                  <Badge tone="info">Upcoming</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Announcements */}
        <Card>
          <CardHeader
            title="Announcements"
            action={
              <Link to="/student/announcements" className="btn-ghost btn-sm">
                See all
              </Link>
            }
          />
          {announcements.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="Nothing new"
              description="Messages from your teacher appear here."
              className="py-8"
            />
          ) : (
            <ul className="divide-y divide-ink-100">
              {announcements.map((a) => (
                <li key={a._id} className="px-5 py-4">
                  <p className="text-sm font-semibold text-ink-900">{a.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-ink-600">{a.body}</p>
                  <p className="mt-1 text-[11px] text-ink-400">{relativeTime(a.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Overall progress"
          value={`${progress.overall}%`}
          icon={TrendingUp}
          tone="brand"
          progress={progress.overall}
          to="/student/progress"
        />
        <StatCard
          label="Materials opened"
          value={`${progress.summary.materialsOpened}/${progress.summary.materialsTotal}`}
          icon={BookOpen}
          tone="info"
        />
        <StatCard
          label="Live attendance"
          value={`${attendance.percentage}%`}
          icon={Radio}
          tone="success"
          progress={attendance.percentage}
          to="/student/live-classes"
        />
      </div>
    </div>
  );
}
