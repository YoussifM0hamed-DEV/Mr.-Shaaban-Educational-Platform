import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import {
  BookOpen,
  ClipboardList,
  LayoutDashboard,
  Megaphone,
  Radio,
  Settings,
  TrendingUp,
} from 'lucide-react';
import Sidebar from '../components/layout/Sidebar';
import Topbar from '../components/layout/Topbar';

const TITLES = [
  { match: /^\/student$/, title: 'My learning', subtitle: 'Pick up where you stopped' },
  { match: /^\/student\/modules\/[^/]+/, title: 'Module', subtitle: 'Lessons in this module' },
  { match: /^\/student\/modules/, title: 'My modules', subtitle: 'Everything in the course' },
  { match: /^\/student\/lessons\/[^/]+/, title: 'Lesson', subtitle: 'Video, material and quiz' },
  { match: /^\/student\/quizzes\/[^/]+/, title: 'Quiz', subtitle: '' },
  { match: /^\/student\/exams\/[^/]+/, title: 'Exam', subtitle: '' },
  { match: /^\/student\/exams/, title: 'My exams', subtitle: 'Assessments to sit' },
  { match: /^\/student\/live-classes/, title: 'My live classes', subtitle: 'Upcoming, live now and past' },
  { match: /^\/student\/progress/, title: 'My progress', subtitle: 'How far you have come' },
  { match: /^\/student\/announcements/, title: 'Announcements', subtitle: 'From your teacher' },
  { match: /^\/student\/settings/, title: 'Settings', subtitle: 'Your account' },
];

export default function StudentLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  const sections = [
    {
      title: 'Learning',
      items: [
        { to: '/student', label: 'Dashboard', icon: LayoutDashboard, end: true },
        { to: '/student/modules', label: 'My modules', icon: BookOpen },
        { to: '/student/exams', label: 'Exams', icon: ClipboardList },
        { to: '/student/live-classes', label: 'Live classes', icon: Radio },
      ],
    },
    {
      title: 'Me',
      items: [
        { to: '/student/progress', label: 'My progress', icon: TrendingUp },
        { to: '/student/announcements', label: 'Announcements', icon: Megaphone },
        { to: '/student/settings', label: 'Settings', icon: Settings },
      ],
    },
  ];

  const found = TITLES.find((t) => t.match.test(location.pathname));
  const { title, subtitle } = found || { title: 'My learning', subtitle: '' };

  return (
    <div className="flex min-h-screen bg-ink-50">
      <Sidebar sections={sections} open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          title={title}
          subtitle={subtitle}
          onMenuClick={() => setMenuOpen(true)}
          settingsPath="/student/settings"
        />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
