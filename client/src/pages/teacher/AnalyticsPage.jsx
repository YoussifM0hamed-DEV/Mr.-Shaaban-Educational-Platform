import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BookOpen, FileQuestion, FileText, PlayCircle, Radio } from 'lucide-react';
import { analyticsApi, moduleApi } from '../../services/endpoints';
import {
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  PageLoader,
  ProgressBar,
  Select,
  Tabs,
} from '../../components/ui';
import { formatDate } from '../../utils/format';

/**
 * Answers the question the teacher actually cares about:
 * "Did my students really study this lesson?"
 */
export default function AnalyticsPage() {
  const [tab, setTab] = useState('lessons');
  const [moduleId, setModuleId] = useState('');

  const modulesQuery = useQuery({ queryKey: ['modules'], queryFn: moduleApi.list });

  const lessonsQuery = useQuery({
    queryKey: ['analytics', 'lessons', moduleId],
    queryFn: () => analyticsApi.lessons(moduleId ? { module: moduleId } : undefined),
    enabled: tab === 'lessons',
  });

  const meetingsQuery = useQuery({
    queryKey: ['analytics', 'meetings'],
    queryFn: () => analyticsApi.meetings({ limit: 12 }),
    enabled: tab === 'meetings',
  });

  const modules = modulesQuery.data?.data ?? [];

  return (
    <div className="space-y-5">
      <Tabs
        tabs={[
          { value: 'lessons', label: 'Lesson engagement' },
          { value: 'meetings', label: 'Live attendance' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'lessons' ? (
        <>
          <Card className="p-4">
            <Select
              value={moduleId}
              onChange={(e) => setModuleId(e.target.value)}
              placeholder="All modules"
              options={modules.map((m) => ({ value: m._id, label: m.title }))}
              className="max-w-sm"
            />
          </Card>

          {lessonsQuery.isLoading ? (
            <PageLoader label="Loading lesson analytics" />
          ) : lessonsQuery.isError ? (
            <ErrorState message={lessonsQuery.error?.message} onRetry={lessonsQuery.refetch} />
          ) : (lessonsQuery.data?.data ?? []).length === 0 ? (
            <Card>
              <EmptyState
                icon={BookOpen}
                title="No lessons to analyse"
                description="Create a lesson and your students' engagement shows up here."
              />
            </Card>
          ) : (
            <div className="space-y-4">
              {lessonsQuery.data.data.map((l) => (
                <LessonAnalyticsCard key={l.lessonId} lesson={l} />
              ))}
            </div>
          )}
        </>
      ) : (
        <MeetingAnalytics query={meetingsQuery} />
      )}
    </div>
  );
}

function LessonAnalyticsCard({ lesson }) {
  const pct = (n) => (lesson.totalStudents ? Math.round((n / lesson.totalStudents) * 100) : 0);

  const chartData = [
    { name: 'Video started', value: lesson.video.started, fill: '#38bdf8' },
    { name: 'Video completed', value: lesson.video.completed, fill: '#10b981' },
    { name: 'Material opened', value: lesson.material.studentsOpened, fill: '#8b5cf6' },
    { name: 'Quiz completed', value: lesson.quiz.completed, fill: '#f59e0b' },
  ];

  return (
    <Card>
      <CardHeader
        title={lesson.title}
        subtitle={`${lesson.module?.title || 'Module'} - ${lesson.totalStudents} approved students`}
      />

      <div className="grid gap-6 p-5 lg:grid-cols-2">
        <div className="space-y-4">
          <Metric
            icon={PlayCircle}
            iconClass="text-sky-500"
            label="Video"
            rows={
              lesson.video.exists
                ? [
                    { label: 'Started', value: lesson.video.started, percent: pct(lesson.video.started) },
                    {
                      label: 'Completed',
                      value: lesson.video.completed,
                      percent: pct(lesson.video.completed),
                    },
                    {
                      label: 'Average progress',
                      value: `${lesson.video.avgProgress}%`,
                      percent: lesson.video.avgProgress,
                    },
                  ]
                : null
            }
            emptyLabel="No video attached"
          />

          <Metric
            icon={FileText}
            iconClass="text-violet-500"
            label="Materials"
            rows={
              lesson.material.count
                ? [
                    { label: 'Files attached', value: lesson.material.count },
                    {
                      label: 'Students who opened',
                      value: lesson.material.studentsOpened,
                      percent: pct(lesson.material.studentsOpened),
                    },
                  ]
                : null
            }
            emptyLabel="No materials attached"
          />

          <Metric
            icon={FileQuestion}
            iconClass="text-amber-500"
            label="Quiz"
            rows={
              lesson.quiz.exists
                ? [
                    { label: 'Completed', value: lesson.quiz.completed, percent: pct(lesson.quiz.completed) },
                    { label: 'Passed', value: lesson.quiz.passed, percent: pct(lesson.quiz.passed) },
                    {
                      label: 'Average score',
                      value: `${lesson.quiz.avgScore}%`,
                      percent: lesson.quiz.avgScore,
                    },
                  ]
                : null
            }
            emptyLabel="No quiz attached"
          />
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis
                type="number"
                domain={[0, lesson.totalStudents || 1]}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={110}
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(v) => [`${v} of ${lesson.totalStudents} students`, '']}
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
              />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={20}>
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}

function Metric({ icon: Icon, iconClass, label, rows, emptyLabel }) {
  return (
    <div className="rounded-xl border border-ink-200 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-ink-800">
        <Icon className={`h-4 w-4 ${iconClass}`} />
        {label}
      </div>

      {rows ? (
        <div className="mt-3 space-y-2.5">
          {rows.map((r) => (
            <div key={r.label}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm text-ink-600">{r.label}</span>
                <span className="text-sm font-bold tabular-nums text-ink-900">{r.value}</span>
              </div>
              {r.percent !== undefined ? (
                <ProgressBar value={r.percent} size="sm" className="mt-1" />
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-ink-500">{emptyLabel}</p>
      )}
    </div>
  );
}

function MeetingAnalytics({ query }) {
  if (query.isError) return <ErrorState message={query.error?.message} onRetry={query.refetch} />;
  // Covers both loading and the first render after the tab enables the query.
  if (!query.data?.data) return <PageLoader label="Loading attendance" />;

  const rows = query.data.data;

  if (!rows.length) {
    return (
      <Card>
        <EmptyState
          icon={Radio}
          title="No live classes yet"
          description="Attendance analytics appear once you have run a live class."
        />
      </Card>
    );
  }

  const chartData = rows.map((r) => ({
    name: r.title.length > 22 ? `${r.title.slice(0, 22)}...` : r.title,
    Attended: r.attended,
    Absent: r.absent,
  }));

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Attendance by class" subtitle="Invited students who actually turned up" />
        <div className="h-80 p-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 12, left: -18, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
                angle={-25}
                textAnchor="end"
                height={60}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Attended" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Absent" stackId="a" fill="#f43f5e" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="table-wrap">
        <table className="w-full">
          <thead className="border-b border-ink-200 bg-ink-50/60">
            <tr>
              <th className="th">Live class</th>
              <th className="th">Date</th>
              <th className="th">Invited</th>
              <th className="th">Attended</th>
              <th className="th">Absent</th>
              <th className="th">Attendance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {[...rows].reverse().map((r) => (
              <tr key={r.meetingId} className="transition-colors hover:bg-ink-50/60">
                <td className="td font-medium text-ink-900">{r.title}</td>
                <td className="td text-ink-500">{formatDate(r.startTime)}</td>
                <td className="td tabular-nums">{r.invited}</td>
                <td className="td tabular-nums text-emerald-600">{r.attended}</td>
                <td className="td tabular-nums text-rose-600">{r.absent}</td>
                <td className="td w-48">
                  <ProgressBar value={r.attendancePercentage} showLabel size="sm" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
