const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, created } = require('../utils/response');
const { signToken, signSocketToken, setAuthCookie, clearAuthCookie } = require('../utils/token');
const env = require('../config/env');
const { ROLES, ACCOUNT_STATUS, ACTIVITY_TYPES, NOTIFICATION_TYPES } = require('../config/constants');
const activityService = require('../services/activityService');
const notificationService = require('../services/notificationService');
const mailService = require('../services/mailService');
const logger = require('../utils/logger');
const { EVENTS } = require('../sockets');

/** Public shape of the signed-in user. Never includes the password hash. */
function publicUser(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    avatarUrl: user.avatarUrl,
    permissions: user.role === ROLES.ASSISTANT ? user.permissions : [],
    studentInfo: user.role === ROLES.STUDENT ? user.studentInfo : undefined,
    rejectionReason: user.status === ACCOUNT_STATUS.REJECTED ? user.rejectionReason : undefined,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

/**
 * POST /api/auth/register
 * Students only. Role and status are assigned by the server, never by the request.
 */
const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone, grade, school, parentPhone } = req.body;

  const existing = await User.findOne({ email });
  if (existing) throw ApiError.conflict('An account with this email already exists');

  const student = await User.create({
    name,
    email,
    password,
    phone,
    role: ROLES.STUDENT,
    status: ACCOUNT_STATUS.PENDING,
    studentInfo: { grade, school, parentPhone },
  });

  await notificationService.notifyTeacher(
    {
      type: NOTIFICATION_TYPES.NEW_REGISTRATION,
      title: 'New student registration',
      message: `${student.name} registered and is waiting for approval.`,
      link: '/teacher/students?status=PENDING',
      action: { label: 'REVIEW', url: '/teacher/students?status=PENDING' },
      meta: { studentId: String(student._id) },
    },
    EVENTS.STUDENT_REGISTERED,
    { studentId: String(student._id), name: student.name, email: student.email }
  );

  return created(
    res,
    { user: publicUser(student) },
    'Registration received. Your account is pending approval by the teacher.'
  );
});

/** POST /api/auth/login */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email, isDeleted: false }).select('+password');
  // Same message for unknown email and wrong password so accounts cannot be enumerated.
  if (!user) throw ApiError.unauthorized('Incorrect email or password');

  const matches = await user.comparePassword(password);
  if (!matches) throw ApiError.unauthorized('Incorrect email or password');

  if (user.role === ROLES.ASSISTANT && user.status === ACCOUNT_STATUS.DISABLED) {
    throw ApiError.forbidden('This assistant account has been disabled by the teacher');
  }

  user.lastLoginAt = new Date();
  if (user.role === ROLES.STUDENT && user.status === ACCOUNT_STATUS.APPROVED) {
    user.lastActivityAt = new Date();
  }
  await user.save();

  setAuthCookie(res, signToken(user));

  if (user.role === ROLES.STUDENT && user.status === ACCOUNT_STATUS.APPROVED) {
    activityService.logActivity({
      studentId: user._id,
      activityType: ACTIVITY_TYPES.LOGGED_IN,
      touchUser: false,
    });
  }

  return ok(res, { user: publicUser(user) }, 'Signed in');
});

/** POST /api/auth/logout */
const logout = asyncHandler(async (_req, res) => {
  clearAuthCookie(res);
  return ok(res, null, 'Signed out');
});

/** GET /api/auth/me */
const me = asyncHandler(async (req, res) => {
  return ok(res, {
    user: publicUser(req.user),
    platform: {
      name: env.PLATFORM_NAME,
      teacherName: env.TEACHER_NAME,
      subject: env.TEACHER_SUBJECT,
    },
  });
});

/**
 * GET /api/auth/socket-token
 * Handed to Socket.IO so real-time works even when the API is on another domain
 * and the browser refuses to send the cookie there.
 */
const socketToken = asyncHandler(async (req, res) => {
  return ok(res, { token: signSocketToken(req.user), expiresInSeconds: 300 });
});

/** GET /api/auth/platform - public branding for the login and landing pages. */
const platform = asyncHandler(async (_req, res) => {
  const teacher = await User.findOne({ role: ROLES.TEACHER, isDeleted: false })
    .select('name avatarUrl')
    .lean();

  return ok(res, {
    name: env.PLATFORM_NAME,
    teacherName: teacher ? teacher.name : env.TEACHER_NAME,
    teacherAvatar: teacher ? teacher.avatarUrl : '',
    subject: env.TEACHER_SUBJECT,
  });
});

/**
 * POST /api/auth/forgot-password
 *
 * Always answers the same way whether or not the email exists, so this cannot be
 * used to discover who has an account. The token is single use, expires, and
 * only its hash is stored.
 */
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const sameAnswer = () =>
    ok(
      res,
      { emailConfigured: mailService.isConfigured },
      'If an account exists for that email, a reset link is on its way. Check your inbox and your spam folder.'
    );

  const user = await User.findOne({ email, isDeleted: false });
  if (!user) {
    logger.debug(`Password reset requested for an unknown email: ${email}`);
    return sameAnswer();
  }

  const ttl = env.PASSWORD_RESET_TTL_MINUTES;
  const token = user.createPasswordResetToken(ttl);
  await user.save({ validateBeforeSave: false });

  const resetUrl = `${env.primaryOrigin}/reset-password?token=${token}`;

  // Deliberately not awaited. Waiting for the mail server would make this
  // request take seconds when the address exists and milliseconds when it does
  // not, which hands an attacker the very answer the identical wording is meant
  // to withhold. It would also hang the caller whenever the mail host is slow.
  mailService
    .sendPasswordReset({ to: user.email, name: user.name, resetUrl, expiresInMinutes: ttl })
    .then((result) => {
      // Without working email the link cannot reach the student, so surface it
      // for the operator instead of losing it.
      if (!result.sent) logger.warn(`Password reset link for ${user.email}: ${resetUrl}`);
    })
    .catch((err) => logger.error(`Password reset email failed for ${user.email}:`, err.message));

  return sameAnswer();
});

/**
 * GET /api/auth/reset-password/:token
 * Lets the page tell the user the link is dead before they type a new password.
 */
const verifyResetToken = asyncHandler(async (req, res) => {
  const user = await User.findByPasswordResetToken(req.params.token);
  if (!user) {
    throw ApiError.badRequest('This reset link is invalid or has expired. Please request a new one.');
  }
  return ok(res, { valid: true, name: user.name, email: user.email });
});

/**
 * POST /api/auth/reset-password
 * Consumes the token, sets the new password and clears any existing session.
 */
const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  const user = await User.findByPasswordResetToken(token);
  if (!user) {
    throw ApiError.badRequest('This reset link is invalid or has expired. Please request a new one.');
  }

  const sameAsOld = await user.comparePassword(password);
  if (sameAsOld) {
    throw ApiError.badRequest('Choose a password you have not used before on this account.');
  }

  user.password = password;
  user.clearPasswordResetToken();
  await user.save();

  // Any session opened before the reset is no longer trusted.
  clearAuthCookie(res);

  await mailService.sendPasswordChanged({ to: user.email, name: user.name });

  return ok(res, null, 'Your password has been changed. You can sign in now.');
});

/** PATCH /api/auth/password */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+password');
  const matches = await user.comparePassword(currentPassword);
  if (!matches) throw ApiError.badRequest('Your current password is incorrect');

  user.password = newPassword;
  await user.save();

  // Force a fresh session so the new credentials are the only way back in.
  setAuthCookie(res, signToken(user));
  return ok(res, null, 'Password updated');
});

/** PATCH /api/auth/profile */
const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, grade, school, parentPhone } = req.body;
  const user = await User.findById(req.user._id);

  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;

  if (user.role === ROLES.STUDENT) {
    user.studentInfo = {
      ...user.studentInfo,
      ...(grade !== undefined ? { grade } : {}),
      ...(school !== undefined ? { school } : {}),
      ...(parentPhone !== undefined ? { parentPhone } : {}),
    };
  }

  await user.save();
  return ok(res, { user: publicUser(user) }, 'Profile updated');
});

module.exports = {
  register,
  login,
  logout,
  me,
  platform,
  socketToken,
  forgotPassword,
  verifyResetToken,
  resetPassword,
  changePassword,
  updateProfile,
  publicUser,
};
