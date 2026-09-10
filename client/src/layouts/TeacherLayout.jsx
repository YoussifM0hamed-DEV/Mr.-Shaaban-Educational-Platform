import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  BookOpen,
  ClipboardList,
  FileQuestion,
  LayoutDashboard,
  Megaphone,
  Radio,
  Settings,
  UserCog,
  Users,
  UsersRound,
} from 'lucide-react';
import Sidebar from '../components/layout/Sidebar';
import Topbar from '../components/layout/Topbar';
import { useAuth } from '../context/AuthContext';
import { studentApi } from '../services/endpoints';
import { PERMISSIONS } from '../utils/constants';

/** Page heading derived from the URL so the topbar always reflects the route. */
const TITLES = [
  { match: /^\/teacher$/, title: 'Dashboard', subtitle: 'How your students are actually doing' },
  { match: /^\/teacher\/students\/[^/]+$/, title: 'Student details', subtitle: 'Progress, activity and attendance' },
  { match: /^\/teacher\/students/, title: 'Students', subtitle: 'Registrations, progress and engagement' },
  { match: /^\/teacher\/groups\/[^/]+/, title: 'Group', subtitle: 'Members and the modules they can open' },
  { match: /^\/teacher\/groups/, title: 'Groups', subtitle: 'Who studies what' },
  { match: /^\/teacher\/assistants/, title: 'Assistants', subtitle: 'Accounts and permissions' },
  { match: /^\/teacher\/modules\/[^/]+/, title: 'Module', subtitle: 'Lessons, videos, materials and quizzes' },
  { match: /^\/teacher\/modules/, title: 'Modules', subtitle: 'Your curriculum' },
  { match: /^\/teacher\/lessons\/[^/]+/, title: 'Lesson', subtitle: 'Content and engagement' },
  { match: /^\/teacher\/quizzes\/[^/]+\/results/, title: 'Quiz results', subtitle: 'Who completed it and how they scored' },
  { match: /^\/teacher\/quizzes/, title: 'Quizzes', subtitle: 'Lesson checks' },
  { match: /^\/teacher\/exams\/[^/]+\/results/, title: 'Exam results', subtitle: 'Who sat it and how they scored' },
  { match: /^\/teacher\/exams/, title: 'Exams', subtitle: 'Larger assessments' },
  { match: /^\/teacher\/live-classes\/[^/]+\/attendance/, title: 'Attendance', subtitle: 'Who attended this live class' },
  { match: /^\/teacher\/live-classes/, title: 'Live classes', subtitle: 'Schedule and attendance' },
  { match: /^\/teacher\/analytics/, title: 'Analytics', subtitle: 'Did your students study this lesson?' },
  { match: /^\/teacher\/announcements/, title: 'Announcements', subtitle: 'Messages for your students' },
  { match: /^\/teacher\/activity/, title: 'Activity', subtitle: 'Everything your students did' },
  { match: /^\/teacher\/settings/, title: 'Settings', subtitle: 'Your account' },
];

function titleFor(pathname) {
  const found = TITLES.find((t) => t.match.test(pathname));
  return found || { title: 'Teacher', subtitle: '' };
}

export default function TeacherLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const { can } = useAuth();

  // Badge on the Students link so a pending registration is never missed.
  const statsQuery = useQuery({
    queryKey: ['students', 'stats'],
    queryFn: studentApi.stats,
    refetchInterval: 120000,
    enabled: can(PERMISSIONS.VIEW_STUDENTS),
  });
  const pending = statsQuery.data?.data?.pending ?? 0;

  const sections = [
    {
      title: 'Overview',
      items: [
        { to: '/teacher', label: 'Dashboard', icon: LayoutDashboard, end: true },
        { to: '/teacher/analytics', label: 'Analytics', icon: BarChart3 },
        { to: '/teacher/activity', label: 'Student activity', icon: ClipboardList },
      ],
    },
    {
      title: 'People',
      items: [
        { to: '/teacher/students', label: 'Students', icon: Users, badge: pending || undefined },
        { to: '/teacher/groups', label: 'Groups', icon: UsersRound },
        { to: '/teacher/assistants', label: 'Assistants', icon: UserCog },
      ],
    },
    {
      title: 'Teaching',
      items: [
        { to: '/teacher/modules', label: 'Modules', icon: BookOpen },
        { to: '/teacher/quizzes', label: 'Quizzes', icon: FileQuestion },
        { to: '/teacher/exams', label: 'Exams', icon: ClipboardList },
        { to: '/teacher/live-classes', label: 'Live classes', icon: Radio },
        { to: '/teacher/announcements', label: 'Announcements', icon: Megaphone },
      ],
    },
    {
      title: 'Account',
      items: [{ to: '/teacher/settings', label: 'Settings', icon: Settings }],
    },
  ];

  const { title, subtitle } = titleFor(location.pathname);

  return (
    <div className="flex min-h-screen bg-ink-50">
      <Sidebar sections={sections} open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          title={title}
          subtitle={subtitle}
          onMenuClick={() => setMenuOpen(true)}
          settingsPath="/teacher/settings"
        />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
