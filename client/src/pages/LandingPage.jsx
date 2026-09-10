import { Link } from 'react-router-dom';
import {
  BarChart3,
  BookOpen,
  ClipboardCheck,
  GraduationCap,
  PlayCircle,
  Radio,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { homeFor } from '../routes/ProtectedRoute';

const FEATURES = [
  {
    icon: BookOpen,
    title: 'Modules and lessons',
    body: 'The course is organised into modules, each with its own lessons, videos, materials and quiz.',
  },
  {
    icon: PlayCircle,
    title: 'Videos that remember you',
    body: 'Every video resumes exactly where you stopped, and your progress is recorded honestly.',
  },
  {
    icon: ClipboardCheck,
    title: 'Quizzes and exams',
    body: 'Timed assessments with instant results when the teacher enables them.',
  },
  {
    icon: Radio,
    title: 'Live classes',
    body: 'Scheduled online sessions with an invite list and real attendance tracking.',
  },
  {
    icon: BarChart3,
    title: 'Honest progress',
    body: 'Your teacher can see who is studying and who needs a hand, lesson by lesson.',
  },
  {
    icon: ShieldCheck,
    title: 'Approved students only',
    body: 'Registrations are reviewed before anyone reaches the course content.',
  },
];

export default function LandingPage() {
  const { platform, user } = useAuth();
  const teacherName = platform?.teacherName || 'Your teacher';
  const platformName = platform?.name || 'Educational Platform';
  const subject = platform?.subject || 'your subject';

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-30 border-b border-ink-200/70 bg-white/85 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-glow">
              <GraduationCap className="h-5 w-5 text-white" />
            </span>
            <span className="truncate text-base font-bold text-ink-900">{platformName}</span>
          </div>

          <nav className="flex items-center gap-2">
            {user ? (
              <Link to={homeFor(user)} className="btn-primary btn-sm sm:!px-4 sm:!py-2.5 sm:!text-sm">
                Go to dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn-ghost btn-sm sm:!px-4 sm:!py-2.5 sm:!text-sm">
                  Sign in
                </Link>
                <Link to="/register" className="btn-primary btn-sm sm:!px-4 sm:!py-2.5 sm:!text-sm">
                  Register
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-ink-900">
        <div
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              'radial-gradient(circle at 15% 25%, rgba(99,102,241,0.55), transparent 45%), radial-gradient(circle at 85% 60%, rgba(79,70,229,0.45), transparent 45%)',
          }}
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-6xl px-5 py-20 sm:py-28">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-brand-200">
            <Users className="h-3.5 w-3.5" />
            One teacher. One classroom.
          </span>

          <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
            Study {subject} with {teacherName}.
          </h1>

          <p className="mt-6 max-w-2xl text-lg text-ink-300">
            Watch the lessons, read the material, sit the quizzes and join the live classes. Your
            teacher sees exactly what you studied, so nobody quietly falls behind.
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            {user ? (
              <Link to={homeFor(user)} className="btn-primary !px-6 !py-3 !text-base">
                Continue learning
              </Link>
            ) : (
              <>
                <Link to="/register" className="btn-primary !px-6 !py-3 !text-base">
                  Register as a student
                </Link>
                <Link
                  to="/login"
                  className="btn !px-6 !py-3 !text-base border border-white/25 text-white hover:bg-white/10"
                >
                  I already have an account
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold text-ink-900">Everything the course needs</h2>
          <p className="mt-3 text-ink-600">
            Content, assessment, live classes and honest reporting, in one place.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card card-hover p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50">
                <f.icon className="h-5 w-5 text-brand-600" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-ink-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-ink-200 bg-ink-50">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="text-3xl font-bold text-ink-900">How you get started</h2>
          <ol className="mt-10 grid gap-6 sm:grid-cols-3">
            {[
              { n: '1', title: 'Register', body: 'Create your account with your name, email and phone number.' },
              { n: '2', title: 'Get approved', body: `${teacherName} reviews your registration and approves it.` },
              { n: '3', title: 'Start learning', body: 'Open your modules, watch the videos and sit the quizzes.' },
            ].map((step) => (
              <li key={step.n} className="card p-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                  {step.n}
                </span>
                <h3 className="mt-4 font-semibold text-ink-900">{step.title}</h3>
                <p className="mt-1.5 text-sm text-ink-600">{step.body}</p>
              </li>
            ))}
          </ol>

          {!user ? (
            <div className="mt-10">
              <Link to="/register" className="btn-primary !px-6 !py-3 !text-base">
                Register now
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-ink-200 pt-8">
          <p className="text-sm text-ink-500">
            {platformName} - {teacherName}
          </p>
          <div className="flex gap-4 text-sm">
            <Link to="/login" className="text-ink-600 hover:text-brand-600">
              Sign in
            </Link>
            <Link to="/register" className="text-ink-600 hover:text-brand-600">
              Register
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
