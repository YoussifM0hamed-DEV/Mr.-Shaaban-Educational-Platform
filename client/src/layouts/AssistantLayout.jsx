import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import {
  BookOpen,
  ClipboardList,
  FileQuestion,
  LayoutDashboard,
  Megaphone,
  Radio,
  Settings,
  Users,
  UsersRound,
} from 'lucide-react';
import Sidebar from '../components/layout/Sidebar';
import Topbar from '../components/layout/Topbar';
import { useAuth } from '../context/AuthContext';
import { PERMISSIONS } from '../utils/constants';

const TITLES = [
  { match: /^\/assistant$/, title: 'Dashboard', subtitle: 'What you can help with today' },
  { match: /^\/assistant\/students\/[^/]+$/, title: 'Student details', subtitle: 'Progress and activity' },
  { match: /^\/assistant\/students/, title: 'Students', subtitle: 'Registrations and progress' },
  { match: /^\/assistant\/groups\/[^/]+/, title: 'Group', subtitle: 'Members and modules' },
  { match: /^\/assistant\/groups/, title: 'Groups', subtitle: 'Who studies what' },
  { match: /^\/assistant\/modules\/[^/]+/, title: 'Module', subtitle: 'Lessons and content' },
  { match: /^\/assistant\/modules/, title: 'Modules', subtitle: 'Curriculum' },
  { match: /^\/assistant\/lessons\/[^/]+/, title: 'Lesson', subtitle: 'Content and engagement' },
  { match: /^\/assistant\/quizzes/, title: 'Quizzes', subtitle: 'Lesson checks' },
  { match: /^\/assistant\/exams/, title: 'Exams', subtitle: 'Assessments' },
  { match: /^\/assistant\/live-classes/, title: 'Live classes', subtitle: 'Schedule and attendance' },
  { match: /^\/assistant\/announcements/, title: 'Announcements', subtitle: 'Messages for students' },
  { match: /^\/assistant\/settings/, title: 'Settings', subtitle: 'Your account' },
];

/**
 * The assistant shell mirrors the teacher's, but every link is gated on a
 * permission the teacher granted. The backend enforces the same rules again.
 */
export default function AssistantLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const { can } = useAuth();

  const sections = [
    {
      title: 'Overview',
      items: [{ to: '/assistant', label: 'Dashboard', icon: LayoutDashboard, end: true }],
    },
    {
      title: 'People',
      items: [
        {
          to: '/assistant/students',
          label: 'Students',
          icon: Users,
          visible: can(PERMISSIONS.VIEW_STUDENTS),
        },
        {
          to: '/assistant/groups',
          label: 'Groups',
          icon: UsersRound,
          visible: can(PERMISSIONS.VIEW_STUDENTS),
        },
      ],
    },
    {
      title: 'Teaching',
      items: [
        {
          to: '/assistant/modules',
          label: 'Modules',
          icon: BookOpen,
          visible:
            can(PERMISSIONS.MANAGE_CONTENT) ||
            can(PERMISSIONS.UPLOAD_MATERIALS) ||
            can(PERMISSIONS.UPLOAD_VIDEOS),
        },
        {
          to: '/assistant/quizzes',
          label: 'Quizzes',
          icon: FileQuestion,
          visible: can(PERMISSIONS.CREATE_QUIZZES) || can(PERMISSIONS.REVIEW_RESULTS),
        },
        {
          to: '/assistant/exams',
          label: 'Exams',
          icon: ClipboardList,
          visible: can(PERMISSIONS.CREATE_EXAMS) || can(PERMISSIONS.REVIEW_RESULTS),
        },
        {
          to: '/assistant/live-classes',
          label: 'Live classes',
          icon: Radio,
          visible: can(PERMISSIONS.MANAGE_MEETINGS) || can(PERMISSIONS.VIEW_ATTENDANCE),
        },
        {
          to: '/assistant/announcements',
          label: 'Announcements',
          icon: Megaphone,
          visible: can(PERMISSIONS.MANAGE_ANNOUNCEMENTS),
        },
      ],
    },
    {
      title: 'Account',
      items: [{ to: '/assistant/settings', label: 'Settings', icon: Settings }],
    },
  ];

  const found = TITLES.find((t) => t.match.test(location.pathname));
  const { title, subtitle } = found || { title: 'Assistant', subtitle: '' };

  return (
    <div className="flex min-h-screen bg-ink-50">
      <Sidebar sections={sections} open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          title={title}
          subtitle={subtitle}
          onMenuClick={() => setMenuOpen(true)}
          settingsPath="/assistant/settings"
        />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
