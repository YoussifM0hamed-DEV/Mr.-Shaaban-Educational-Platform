import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BookOpen,
  ClipboardList,
  Radio,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { studentApi } from '../../services/endpoints';
import { useAuth } from '../../context/AuthContext';
import StatCard from '../../components/shared/StatCard';
import { Badge, Card, CardHeader, EmptyState } from '../../components/ui';
import { PERMISSIONS } from '../../utils/constants';

const SHORTCUTS = [
  {
    to: '/assistant/students',
    label: 'Students',
    description: 'Review registrations and check progress.',
    icon: Users,
    permissions: [PERMISSIONS.VIEW_STUDENTS],
  },
  {
    to: '/assistant/modules',
    label: 'Modules and lessons',
    description: 'Upload videos and materials.',
    icon: BookOpen,
    permissions: [PERMISSIONS.MANAGE_CONTENT, PERMISSIONS.UPLOAD_VIDEOS, PERMISSIONS.UPLOAD_MATERIALS],
  },
  {
    to: '/assistant/quizzes',
    label: 'Quizzes and exams',
    description: 'Build assessments and review results.',
    icon: ClipboardList,
    permissions: [PERMISSIONS.CREATE_QUIZZES, PERMISSIONS.CREATE_EXAMS, PERMISSIONS.REVIEW_RESULTS],
  },
  {
    to: '/assistant/live-classes',
    label: 'Live classes',
    description: 'Schedule sessions and check attendance.',
    icon: Radio,
    permissions: [PERMISSIONS.MANAGE_MEETINGS, PERMISSIONS.VIEW_ATTENDANCE],
  },
];

/**
 * The assistant home screen only surfaces what the teacher actually granted.
 * Everything here is re-checked by the backend on each request.
 */
export default function AssistantDashboard() {
  const { user, can, platform } = useAuth();

  const statsQuery = useQuery({
    queryKey: ['students', 'stats'],
    queryFn: studentApi.stats,
    enabled: can(PERMISSIONS.VIEW_STUDENTS),
  });

  const stats = statsQuery.data?.data;
  const available = SHORTCUTS.filter((s) => s.permissions.some((p) => can(p)));

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-brand-600 to-brand-800 p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-200">
            {platform?.name}
          </p>
          <h2 className="mt-1 text-2xl font-bold text-white">Welcome, {user?.name}</h2>
          <p className="mt-1 text-sm text-brand-100">
            You are helping {platform?.teacherName || 'the teacher'} run this platform.
          </p>
        </div>

        <div className="p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink-800">
            <ShieldCheck className="h-4 w-4 text-brand-600" />
            What you can do
          </div>

          {user?.permissions?.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {user.permissions.map((p) => (
                <Badge key={p} tone="brand">
                  {p.replace(/_/g, ' ').toLowerCase()}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-ink-500">
              The teacher has not granted you any permissions yet. Ask them to enable what you need.
            </p>
          )}
        </div>
      </Card>

      {can(PERMISSIONS.VIEW_STUDENTS) && stats ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total students" value={stats.total} icon={Users} tone="brand" to="/assistant/students" />
          <StatCard
            label="Pending approval"
            value={stats.pending}
            icon={UserPlus}
            tone={stats.pending > 0 ? 'warning' : 'neutral'}
            to="/assistant/students?status=PENDING"
          />
          <StatCard label="Active" value={stats.engagement.active} tone="success" />
          <StatCard label="Needing attention" value={stats.engagement.atRisk + stats.engagement.inactive} tone="danger" />
        </div>
      ) : null}

      <Card>
        <CardHeader title="Your tools" subtitle="Only what the teacher granted you" />

        {available.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="Nothing enabled yet"
            description="Once the teacher grants you a permission, the matching tools appear here."
            className="py-12"
          />
        ) : (
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            {available.map((s) => (
              <Link key={s.to} to={s.to} className="card card-hover flex items-center gap-4 p-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <s.icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink-900">{s.label}</p>
                  <p className="text-sm text-ink-500">{s.description}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-ink-400" />
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
