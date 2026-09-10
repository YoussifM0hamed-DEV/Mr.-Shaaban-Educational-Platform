const { z } = require('zod');
const { email, password, name, phone, safeText } = require('./common');

/**
 * Students register directly on this platform - there is no teacher to choose.
 * Role and status are never accepted from the client.
 */
const registerSchema = z.object({
  name,
  email,
  password,
  phone,
  grade: safeText(60).optional(),
  school: safeText(120).optional(),
  parentPhone: phone.optional().or(z.literal('')),
});

const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required').max(128),
});

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required').max(128),
    newPassword: password,
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: 'The new password must be different from the current one',
    path: ['newPassword'],
  });

const updateProfileSchema = z.object({
  name: name.optional(),
  phone: phone.optional(),
  grade: safeText(60).optional(),
  school: safeText(120).optional(),
  parentPhone: phone.optional().or(z.literal('')),
});

const forgotPasswordSchema = z.object({ email });

// The token is 32 random bytes rendered as hex, so exactly 64 hex characters.
const resetTokenParam = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/, 'Invalid reset link'),
});

const resetPasswordSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/, 'Invalid reset link'),
  password,
});

module.exports = {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  updateProfileSchema,
  forgotPasswordSchema,
  resetTokenParam,
  resetPasswordSchema,
};
