import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PageLoader } from '../components/ui';
import { ROLES, ACCOUNT_STATUS } from '../utils/constants';

/** Where a signed-in user belongs, based on role and account status. */
export function homeFor(user) {
  if (!user) return '/login';
  if (user.role === ROLES.TEACHER) return '/teacher';
  if (user.role === ROLES.ASSISTANT) return '/assistant';
  if (user.status === ACCOUNT_STATUS.PENDING) return '/pending';
  if (user.status === ACCOUNT_STATUS.REJECTED) return '/rejected';
  return '/student';
}

/**
 * Route guard. The server enforces all of this again on every request -
 * this only decides what the browser shows.
 */
export function ProtectedRoute({ roles, requireApproved = false }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader label="Checking your session" />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={homeFor(user)} replace />;
  }

  if (requireApproved && user.role === ROLES.STUDENT && user.status !== ACCOUNT_STATUS.APPROVED) {
    return <Navigate to={user.status === ACCOUNT_STATUS.REJECTED ? '/rejected' : '/pending'} replace />;
  }

  return <Outlet />;
}

/** Keeps signed-in users away from the login and register screens. */
export function PublicOnlyRoute() {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader label="Loading" />;
  if (user) return <Navigate to={homeFor(user)} replace />;
  return <Outlet />;
}

/** Hides a route behind an assistant permission the teacher may not have granted. */
export function PermissionRoute({ permission, children }) {
  const { can, user } = useAuth();
  if (!can(permission)) return <Navigate to={homeFor(user)} replace />;
  return children ?? <Outlet />;
}
