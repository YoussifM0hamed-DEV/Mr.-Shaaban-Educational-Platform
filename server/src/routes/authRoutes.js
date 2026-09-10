const express = require('express');
const controller = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  authLimiter,
  registerLimiter,
  passwordResetLimiter,
} = require('../middleware/rateLimit');
const {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  updateProfileSchema,
  forgotPasswordSchema,
  resetTokenParam,
  resetPasswordSchema,
} = require('../validators/authValidators');

const router = express.Router();

router.get('/platform', controller.platform);

router.post('/register', registerLimiter, validate({ body: registerSchema }), controller.register);
router.post('/login', authLimiter, validate({ body: loginSchema }), controller.login);
router.post('/logout', controller.logout);

// ---------- Forgotten password ----------
// Public by design: whoever asks has lost access to their account.
router.post(
  '/forgot-password',
  passwordResetLimiter,
  validate({ body: forgotPasswordSchema }),
  controller.forgotPassword
);

router.get(
  '/reset-password/:token',
  authLimiter,
  validate({ params: resetTokenParam }),
  controller.verifyResetToken
);

router.post(
  '/reset-password',
  authLimiter,
  validate({ body: resetPasswordSchema }),
  controller.resetPassword
);

// ---------- Signed in ----------
router.get('/me', authenticate, controller.me);
router.get('/socket-token', authenticate, controller.socketToken);

router.patch(
  '/password',
  authenticate,
  authLimiter,
  validate({ body: changePasswordSchema }),
  controller.changePassword
);

router.patch(
  '/profile',
  authenticate,
  validate({ body: updateProfileSchema }),
  controller.updateProfile
);

module.exports = router;
