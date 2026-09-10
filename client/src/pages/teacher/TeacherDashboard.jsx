import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  ClipboardList,
  FileQuestion,
  PlayCircle,
  Radio,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { analyticsApi } from '../../services/endpoints';
import { onSocketEvent, SOCKET_EVENTS } from '../../services/socket';
import StatCard, { EngagementTile } from '../../components/shared/StatCard';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  EngagementBadge,
  ErrorState,
  ProgressBar,
  SkeletonCard,
} from '../../components/ui';
import { formatDate, formatTime, relativeDay } from '../../utils/format';
import { useAuth } from '../../context/AuthContext';

export default function TeacherDashboard() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { platform } = useAuth();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['analytics', 'dashboard'],
    queryFn: analyticsApi.dashboard,
    staleTime: 60000,
  });

  // Live events keep the dashboard honest without polling.
  useEffect(() => {
    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['analytics', 'dashboard'] });
    const offs = [
      onSocketEvent(SOCKET_EVENTS.STUDENT_REGISTERED, invalidate),
      onSocketEvent(SOCKET_EVENTS.QUIZ_COMPLETED, invalidate),
      onSocketEvent(SOCKET_EVENTS.EXAM_COMPLETED, invalidate),
      onSocketEvent(SOCKET_EVENTS.MEETING_UPDATED, invalidate),
    ];
    return () => offs.forEach((off) => off());
  }, [queryClient]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (isError) return <ErrorState message={error?.message} onRetry={refetch} />;

  const { stats, studentsNeedingAttention, activityTrend, meetings } = data.data;
  const { students, content, meetings: meetingStats, engagement, assistants } = stats;

  return (
    <div className="space-y-6">
      {/* Pending registrations call to action */}
      {students.pending > 0 ? (
        <Link
          to="/teacher/students?status=PENDING"
          className="flex items-center gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 transition-colors hover:bg-amber-100/70"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <UserPlus className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-900">
              {students.pending} student{students.pending === 1 ? '' : 's'} waiting for approval
            </p>
            <p className="text-sm text-amber-700">
              They cannot open any lesson until you approve them.
            </p>
          </div>
          <ArrowRight className="h-5 w-5 shrink-0 text-amber-700" />
        </Link>
      ) : null}

      {/* Live now banner */}
      {meetingStats.live > 0 ? (
        <Link
          to="/teacher/live-classes"
          className="flex items-center gap-4 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 transition-colors hover:bg-rose-100/70"
        >
          <span className="flex h-11 w-11 shrink-0 animate-pulse-ring items-center justify-center rounded-xl bg-rose-600 text-white">
            <Radio className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-rose-900">
              {meetingStats.live} live class{meetingStats.live === 1 ? '' : 'es'} running now
            </p>
            <p className="text-sm text-rose-700">Open it to watch attendance as students join.</p>
          </div>
          <ArrowRight className="h-5 w-5 shrink-0 text-rose-700" />
        </Link>
      ) : null}

      {/* Headline counters */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total students"
          value={students.total}
          icon={Users}
          tone="brand"
          hint={`${students.approved} approved, ${students.rejected} rejected`}
          to="/teacher/students"
        />
        <StatCard
          label="Pending approval"
          value={students.pending}
          icon={UserPlus}
          tone={students.pending > 0 ? 'warning' : 'neutral'}
          hint={students.pending > 0 ? 'Needs your review' : 'Nothing waiting'}
          to="/teacher/students?status=PENDING"
        />
        <StatCard
          label="Active students"
          value={students.active}
          icon={UserCheck}
          tone="success"
          hint="Studied in the last few days"
          to="/teacher/students?engagement=ACTIVE"
        />
        <StatCard
          label="Live classes"
          value={meetingStats.live > 0 ? 'LIVE NOW' : meetingStats.upcoming}
          icon={Radio}
          tone={meetingStats.live > 0 ? 'danger' : 'info'}
          hint={
            meetingStats.live > 0
              ? `${meetingStats.upcoming} more scheduled`
              : `${meetingStats.upcoming} upcoming`
          }
          to="/teacher/live-classes"
        />
      </div>

      {/* Content counters */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Modules"
          value={content.modules}
          icon={BookOpen}
          tone="info"
          hint={`${content.publishedModules} published`}
          to="/teacher/modules"
        />
        <StatCard
          label="Lessons"
          value={content.lessons}
          icon={PlayCircle}
          tone="brand"
          hint={`${content.videos} videos, ${content.materials} files`}
          to="/teacher/modules"
        />
        <StatCard
          label="Quizzes"
          value={content.quizzes}
          icon={FileQuestion}
          tone="warning"
          to="/teacher/quizzes"
        />
        <StatCard
          label="Exams"
          value={content.exams}
          icon={ClipboardList}
          tone="success"
          hint={`${assistants} assistant${assistants === 1 ? '' : 's'}`}
          to="/teacher/exams"
        />
      </div>

      {/* Engagement */}
      <Card>
        <CardHeader
          title="Student engagement"
          subtitle="Across every approved student and every piece of content"
          action={
            <Button variant="secondary" size="sm" onClick={() => navigate('/teacher/analytics')}>
              Lesson breakdown
            </Button>
          }
        />
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-5">
          <EngagementTile label="Video completion" value={engagement.videoCompletion} icon={PlayCircle} />
          <EngagementTile label="Material access" value={engagement.materialAccess} icon={BookOpen} />
          <EngagementTile label="Quiz completion" value={engagement.quizCompletion} icon={FileQuestion} />
          <EngagementTile label="Exam completion" value={engagement.examCompletion} icon={ClipboardList} />
          <EngagementTile label="Live attendance" value={engagement.liveAttendance} icon={Radio} />
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Students needing attention */}
        <Card className="lg:col-span-3">
          <CardHeader
            title="Students needing attention"
            subtitle="Falling behind or gone quiet"
            action={
              <Link to="/teacher/students?engagement=AT_RISK" className="btn-ghost btn-sm">
                See all
              </Link>
            }
          />

          {studentsNeedingAttention.length === 0 ? (
            <EmptyState
              icon={UserCheck}
              title="Everyone is keeping up"
              description="No student is currently at risk or inactive."
              className="py-10"
            />
          ) : (
            <ul className="divide-y divide-ink-100">
              {studentsNeedingAttention.map((s) => (
                <li key={s._id}>
                  <Link
                    to={`/teacher/students/${s._id}`}
                    className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-ink-50"
                  >
                    <Avatar name={s.name} src={s.avatarUrl} />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-ink-900">{s.name}</p>
                        <EngagementBadge engagement={s.engagement} />
                      </div>

                      <div className="mt-2 grid gap-x-4 gap-y-1 text-xs text-ink-600 sm:grid-cols-3">
                        <span>
                          Video:{' '}
                          <span className="font-semibold text-ink-800">
                            {s.videoProgress > 0 ? `${s.videoProgress}%` : 'Not started'}
                          </span>
                        </span>
                        <span>
                          Material:{' '}
                          <span className="font-semibold text-ink-800">
                            {s.materialsOpened > 0 ? `${s.materialsOpened}/${s.materialsTotal}` : 'Not opened'}
                          </span>
                        </span>
                        <span>
                          Quiz:{' '}
                          <span className="font-semibold text-ink-800">
                            {s.quizzesCompleted > 0
                              ? `${s.quizzesCompleted}/${s.quizzesTotal}`
                              : 'Not completed'}
                          </span>
                        </span>
                      </div>

                      <ProgressBar value={s.overall} className="mt-2.5" size="sm" showLabel />
                    </div>

                    <div className="hidden shrink-0 text-right sm:block">
                      <p className="text-xs text-ink-400">Last activity</p>
                      <p className="text-xs font-medium text-ink-700">{relativeDay(s.lastActivityAt)}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Activity trend */}
        <Card className="lg:col-span-2">
          <CardHeader title="Activity" subtitle="Tracked events over the last 14 days" />
          <div className="h-64 px-2 pb-4 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activityTrend} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => formatDate(v, 'd MMM')}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={20}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  labelFormatter={(v) => formatDate(v, 'd MMM yyyy')}
                  formatter={(value, name) => [
                    value,
                    name === 'total' ? 'Events' : 'Active students',
                  ]}
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #e2e8f0',
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#activityFill)"
                />
                <Area
                  type="monotone"
                  dataKey="activeStudents"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={0}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Recent live class attendance */}
      <Card>
        <CardHeader
          title="Recent live class attendance"
          subtitle="Who actually turned up"
          action={
            <Link to="/teacher/live-classes" className="btn-ghost btn-sm">
              All live classes
            </Link>
          }
        />

        {meetings.length === 0 ? (
          <EmptyState
            icon={Radio}
            title="No live classes yet"
            description="Schedule a live class and invite your students."
            action={
              <Link to="/teacher/live-classes" className="btn-primary btn-sm">
                Create a live class
              </Link>
            }
            className="py-10"
          />
        ) : (
          <ul className="divide-y divide-ink-100">
            {[...meetings].reverse().map((m) => (
              <li key={m.meetingId}>
                <Link
                  to={`/teacher/live-classes/${m.meetingId}/attendance`}
                  className="flex flex-wrap items-center gap-4 px-5 py-4 transition-colors hover:bg-ink-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink-900">{m.title}</p>
                    <p className="text-xs text-ink-500">
                      {formatDate(m.startTime)} at {formatTime(m.startTime)}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-ink-500">
                      Invited <span className="font-semibold text-ink-800">{m.invited}</span>
                    </span>
                    <Badge tone="success">{m.attended} attended</Badge>
                    {m.absent > 0 ? <Badge tone="danger">{m.absent} absent</Badge> : null}
                  </div>

                  <div className="w-full sm:w-40">
                    <ProgressBar value={m.attendancePercentage} showLabel size="sm" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="pb-2 text-center text-xs text-ink-400">
        {platform?.name} - every number above comes from tracked student activity.
      </p>
    </div>
  );
}
