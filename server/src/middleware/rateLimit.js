const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const skipInDev = () => !env.isProd && process.env.FORCE_RATE_LIMIT !== 'true';

const message = (msg) => ({ success: false, message: msg });

/** Tight limit on credential endpoints to slow down brute force attempts. */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInDev,
  message: message('Too many attempts. Please try again in 15 minutes.'),
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInDev,
  message: message('Too many registrations from this network. Please try again later.'),
});

/**
 * Password reset requests. Tight, because each one sends an email and a loose
 * limit would let someone flood a student's inbox or burn the daily send quota.
 */
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInDev,
  message: message('Too many reset requests. Please try again in an hour.'),
});

/** General API ceiling. */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInDev,
  message: message('Too many requests. Please slow down.'),
});

/** Video progress pings are frequent by design, so they get their own budget. */
const trackingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInDev,
  message: message('Too many tracking events.'),
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInDev,
  message: message('Upload limit reached. Please try again later.'),
});

module.exports = {
  authLimiter,
  registerLimiter,
  passwordResetLimiter,
  apiLimiter,
  trackingLimiter,
  uploadLimiter,
};
