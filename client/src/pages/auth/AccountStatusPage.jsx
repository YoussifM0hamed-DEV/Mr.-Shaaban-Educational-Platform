import { useNavigate } from 'react-router-dom';
import { Clock, RefreshCw, XCircle, LogOut } from 'lucide-react';
import AuthShell from './AuthShell';
import { Button } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { homeFor } from '../../routes/ProtectedRoute';

/**
 * Shown to a student whose account is not APPROVED.
 * They can re-check without signing out, in case the teacher just approved them.
 */
export default function AccountStatusPage({ variant = 'pending' }) {
  const { user, logout, refreshUser, platform } = useAuth();
  const navigate = useNavigate();

  const isRejected = variant === 'rejected';

  const handleRefresh = async () => {
    const updated = await refreshUser();
    const target = homeFor(updated);
    if (target === '/student') navigate('/student', { replace: true });
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <AuthShell
      title={isRejected ? 'Registration not approved' : 'Waiting for approval'}
      subtitle={
        isRejected
          ? `${platform?.teacherName || 'The teacher'} did not approve this registration.`
          : `${platform?.teacherName || 'Your teacher'} is reviewing your registration.`
      }
    >
      <div className="space-y-6">
        <div
          className={`flex gap-4 rounded-2xl border p-5 ${
            isRejected ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50'
          }`}
        >
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
              isRejected ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'
            }`}
          >
            {isRejected ? <XCircle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
          </span>
          <div className="min-w-0">
            <p className={`text-sm font-semibold ${isRejected ? 'text-rose-800' : 'text-amber-800'}`}>
              {isRejected ? 'Your account cannot access the lessons' : 'Your account is pending'}
            </p>
            <p className={`mt-1 text-sm ${isRejected ? 'text-rose-700' : 'text-amber-700'}`}>
              {isRejected
                ? user?.rejectionReason ||
                  'Please contact your teacher directly if you think this is a mistake.'
                : 'You will be able to open modules, videos and quizzes as soon as the teacher approves you.'}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-ink-200 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Your details</p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-500">Name</dt>
              <dd className="font-medium text-ink-800">{user?.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-500">Email</dt>
              <dd className="truncate font-medium text-ink-800">{user?.email}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-500">Status</dt>
              <dd className="font-medium text-ink-800">{user?.status}</dd>
            </div>
          </dl>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          {!isRejected ? (
            <Button icon={RefreshCw} onClick={handleRefresh} className="flex-1">
              Check again
            </Button>
          ) : null}
          <Button variant="secondary" icon={LogOut} onClick={handleLogout} className="flex-1">
            Sign out
          </Button>
        </div>
      </div>
    </AuthShell>
  );
}
