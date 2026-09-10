import { Link } from 'react-router-dom';
import { GraduationCap, BarChart3, Radio, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const HIGHLIGHTS = [
  {
    icon: BarChart3,
    title: 'Real progress, not guesswork',
    body: 'Every video watched, file opened and quiz answered is recorded.',
  },
  {
    icon: Radio,
    title: 'Live classes built in',
    body: 'Scheduled sessions with an invite list and real attendance.',
  },
  {
    icon: ShieldCheck,
    title: 'Only approved students',
    body: 'Nobody reaches your lessons until you approve them.',
  },
];

/** Split-screen shell shared by the sign-in, register and status screens. */
export default function AuthShell({ title, subtitle, children, footer }) {
  const { platform } = useAuth();
  const teacherName = platform?.teacherName || 'Your teacher';
  const platformName = platform?.name || 'Educational Platform';

  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <div className="relative hidden w-1/2 overflow-hidden bg-ink-900 lg:flex lg:flex-col lg:justify-between">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(99,102,241,0.5), transparent 45%), radial-gradient(circle at 80% 70%, rgba(79,70,229,0.45), transparent 45%)',
          }}
          aria-hidden="true"
        />

        <div className="relative p-12">
          <Link to="/" className="inline-flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-glow">
              <GraduationCap className="h-6 w-6 text-white" />
            </span>
            <span className="text-lg font-bold text-white">{platformName}</span>
          </Link>
        </div>

        <div className="relative px-12 pb-16">
          <h2 className="max-w-md text-4xl font-bold leading-tight text-white">
            Learn with {teacherName}.
          </h2>
          <p className="mt-4 max-w-md text-base text-ink-300">
            One teacher, one classroom, and a clear record of what every student actually studied.
          </p>

          <div className="mt-10 space-y-5">
            {HIGHLIGHTS.map((h) => (
              <div key={h.title} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                  <h.icon className="h-5 w-5 text-brand-300" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{h.title}</p>
                  <p className="text-sm text-ink-400">{h.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex w-full flex-col justify-center px-5 py-10 sm:px-10 lg:w-1/2 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <Link to="/" className="mb-8 inline-flex items-center gap-3 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700">
              <GraduationCap className="h-5 w-5 text-white" />
            </span>
            <span className="text-base font-bold text-ink-900">{platformName}</span>
          </Link>

          <h1 className="text-2xl font-bold text-ink-900 sm:text-3xl">{title}</h1>
          {subtitle ? <p className="mt-2 text-sm text-ink-500">{subtitle}</p> : null}

          <div className="mt-8">{children}</div>

          {footer ? <div className="mt-6 text-center text-sm text-ink-500">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}
