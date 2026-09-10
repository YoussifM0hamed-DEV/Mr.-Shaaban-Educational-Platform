const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, COOKIE_NAME } = require('../utils/token');
const { ROLES, ACCOUNT_STATUS } = require('../config/constants');

function extractToken(req) {
  if (req.cookies && req.cookies[COOKIE_NAME]) return req.cookies[COOKIE_NAME];
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

/**
 * Loads the authenticated user from the DB on every request.
 * Nothing about identity, role or permissions is ever taken from the request body.
 */
const authenticate = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) throw ApiError.unauthorized('Authentication required');

  let payload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    throw ApiError.unauthorized(
      err.name === 'TokenExpiredError' ? 'Session expired, please sign in again' : 'Invalid session'
    );
  }

  const user = await User.findById(payload.sub);
  if (!user || user.isDeleted) throw ApiError.unauthorized('Account no longer exists');

  // A password change ends every session opened before it, so a reset really
  // locks out whoever had the old password. The one second of slack keeps the
  // freshly issued token valid, since `iat` is only second-accurate.
  if (user.passwordChangedAt && payload.iat) {
    const issuedAt = payload.iat * 1000;
    if (issuedAt < user.passwordChangedAt.getTime() - 1000) {
      throw ApiError.unauthorized('Your password was changed. Please sign in again.');
    }
  }

  if (user.role === ROLES.ASSISTANT && user.status === ACCOUNT_STATUS.DISABLED) {
    throw ApiError.forbidden('This assistant account has been disabled');
  }

  req.user = user;
  next();
});

/** Restricts a route to one or more roles. */
function authorize(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden('Your role cannot access this resource'));
    }
    next();
  };
}

/** Blocks students whose registration is still PENDING or was REJECTED. */
function requireApprovedStudent(req, _res, next) {
  if (!req.user) return next(ApiError.unauthorized());
  if (req.user.role !== ROLES.STUDENT) return next();

  if (req.user.status === ACCOUNT_STATUS.PENDING) {
    return next(
      new ApiError(403, 'Your registration is still awaiting approval from the teacher', {
        accountStatus: ACCOUNT_STATUS.PENDING,
      })
    );
  }
  if (req.user.status === ACCOUNT_STATUS.REJECTED) {
    return next(
      new ApiError(403, 'Your registration was not approved', {
        accountStatus: ACCOUNT_STATUS.REJECTED,
        reason: req.user.rejectionReason || '',
      })
    );
  }
  next();
}

/** Teacher or assistant, i.e. anyone on the staff side of the platform. */
const requireStaff = authorize(ROLES.TEACHER, ROLES.ASSISTANT);

/** Teacher only - platform ownership operations. */
const requireTeacher = authorize(ROLES.TEACHER);

/** Attaches req.user when a token exists but never rejects the request. */
const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const payload = verifyToken(token);
    const user = await User.findById(payload.sub);
    if (user && !user.isDeleted) req.user = user;
  } catch {
    /* ignore - route stays anonymous */
  }
  next();
});

module.exports = {
  authenticate,
  authorize,
  requireApprovedStudent,
  requireStaff,
  requireTeacher,
  optionalAuth,
  extractToken,
};
