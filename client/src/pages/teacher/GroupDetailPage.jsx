import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, Users } from 'lucide-react';
import { groupApi } from '../../services/endpoints';
import StatCard from '../../components/shared/StatCard';
import {
  Avatar,
  Badge,
  Card,
  CardHeader,
  EmptyState,
  EngagementBadge,
  ErrorState,
  PageLoader,
  ProgressBar,
} from '../../components/ui';
import { relativeDay, pluralize } from '../../utils/format';

export default function GroupDetailPage({ basePath = '/teacher' }) {
  const { id } = useParams();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['groups', id],
    queryFn: () => groupApi.get(id),
  });

  if (isLoading) return <PageLoader label="Loading group" />;
  if (isError) return <ErrorState message={error?.message} onRetry={refetch} />;

  const { group, students, modules } = data.data;

  const averageProgress = students.length
    ? Math.round(students.reduce((s, x) => s + (x.progress?.overall || 0), 0) / students.length)
    : 0;
  const needingAttention = students.filter((s) => s.engagement && s.engagement !== 'ACTIVE').length;

  return (
    <div className="space-y-5">
      <Link
        to={`${basePath}/groups`}
        className="inline-flex items-center gap-2 text-sm font-medium text-ink-500 hover:text-ink-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to groups
      </Link>

      <Card className="p-6">
        <h2 className="text-xl font-bold text-ink-900">{group.name}</h2>
        {group.description ? (
          <p className="mt-2 max-w-2xl text-sm text-ink-600">{group.description}</p>
        ) : null}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Students" value={students.length} icon={Users} tone="brand" />
        <StatCard
          label="Average progress"
          value={`${averageProgress}%`}
          tone="info"
          progress={averageProgress}
        />
        <StatCard
          label="Needing attention"
          value={needingAttention}
          tone={needingAttention > 0 ? 'warning' : 'success'}
        />
        <StatCard label="Modules given" value={modules.length} icon={BookOpen} tone="neutral" />
      </div>

      <Card>
        <CardHeader
          title="Modules this group can open"
          subtitle="A module with no group at all is open to every student"
        />
        {modules.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No module is reserved for this group"
            description="Open a module and choose this group under Who can see it."
            className="py-10"
          />
        ) : (
          <ul className="divide-y divide-ink-100">
            {modules.map((m) => (
              <li key={m._id} className="flex items-center gap-4 px-5 py-3.5">
                <Link
                  to={`${basePath}/modules/${m._id}`}
                  className="min-w-0 flex-1 truncate text-sm font-medium text-ink-900 hover:text-brand-700"
                >
                  {m.title}
                </Link>
                <Badge tone={m.isPublished ? 'success' : 'neutral'}>
                  {m.isPublished ? 'Published' : 'Draft'}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Students" subtitle={pluralize(students.length, 'member')} />

        {students.length === 0 ? (
          <EmptyState
            icon={Users}
            title="This group is empty"
            description="Edit the group to add students."
            className="py-10"
          />
        ) : (
          <div className="table-wrap border-0 shadow-none">
            <table className="w-full">
              <thead className="border-b border-ink-200 bg-ink-50/60">
                <tr>
                  <th className="th">Student</th>
                  <th className="th">Progress</th>
                  <th className="th">Engagement</th>
                  <th className="th">Video</th>
                  <th className="th">Quiz</th>
                  <th className="th">Last activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {students.map((s) => {
                  const p = s.progress || {};
                  return (
                    <tr key={s._id} className="transition-colors hover:bg-ink-50/60">
                      <td className="td">
                        <Link to={`${basePath}/students/${s._id}`} className="flex items-center gap-3">
                          <Avatar name={s.name} src={s.avatarUrl} size="sm" />
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-ink-900">{s.name}</span>
                            <span className="block truncate text-xs text-ink-500">{s.email}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="td w-40">
                        <ProgressBar value={p.overall || 0} showLabel size="sm" />
                      </td>
                      <td className="td">
                        <EngagementBadge engagement={s.engagement} />
                      </td>
                      <td className="td tabular-nums">
                        {p.videosTotal ? `${p.videoProgress || 0}%` : '-'}
                      </td>
                      <td className="td tabular-nums">
                        {p.quizzesTotal ? `${p.quizzesCompleted || 0}/${p.quizzesTotal}` : '-'}
                      </td>
                      <td className="td text-ink-500">{relativeDay(s.lastActivityAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
