const ApiError = require('../utils/ApiError');
const { ROLES } = require('../config/constants');

/**
 * Permission gate for staff routes.
 * The teacher owns the platform and implicitly holds every permission.
 * Assistants only hold what the teacher granted, read fresh from the database.
 */
function requirePermission(...permissions) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());

    if (req.user.role === ROLES.TEACHER) return next();

    if (req.user.role !== ROLES.ASSISTANT) {
      return next(ApiError.forbidden('Your role cannot access this resource'));
    }

    const granted = req.user.permissions || [];
    const allowed = permissions.some((p) => granted.includes(p));
    if (!allowed) {
      return next(
        ApiError.forbidden(
          'You have not been granted permission for this action. Ask the teacher to enable it.'
        )
      );
    }
    next();
  };
}

/** Requires every listed permission rather than any of them. */
function requireAllPermissions(...permissions) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (req.user.role === ROLES.TEACHER) return next();
    if (req.user.role !== ROLES.ASSISTANT) {
      return next(ApiError.forbidden('Your role cannot access this resource'));
    }
    const granted = req.user.permissions || [];
    const missing = permissions.filter((p) => !granted.includes(p));
    if (missing.length) return next(ApiError.forbidden('Missing required permissions'));
    next();
  };
}

module.exports = { requirePermission, requireAllPermissions };
