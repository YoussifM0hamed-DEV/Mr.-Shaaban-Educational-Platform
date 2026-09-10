const { z } = require('zod');
const { email, password, name, phone, safeText, objectId } = require('./common');
const { PERMISSION_LIST, ACCOUNT_STATUS, ENGAGEMENT } = require('../config/constants');

const permissionArray = z.array(z.enum(PERMISSION_LIST)).max(PERMISSION_LIST.length).default([]);

const createAssistantSchema = z.object({
  name,
  email,
  password,
  phone: phone.optional(),
  permissions: permissionArray,
});

const updateAssistantSchema = z.object({
  name: name.optional(),
  phone: phone.optional(),
  permissions: permissionArray.optional(),
  password: password.optional(),
});

const setAssistantStatusSchema = z.object({
  status: z.enum([ACCOUNT_STATUS.APPROVED, ACCOUNT_STATUS.DISABLED]),
});

const reviewStudentSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  reason: safeText(300).optional(),
});

const bulkReviewSchema = z.object({
  studentIds: z.array(objectId).min(1).max(200),
  decision: z.enum(['APPROVE', 'REJECT']),
  reason: safeText(300).optional(),
});

const studentListQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().max(120).optional(),
  status: z
    .enum([ACCOUNT_STATUS.PENDING, ACCOUNT_STATUS.APPROVED, ACCOUNT_STATUS.REJECTED, 'ALL'])
    .optional(),
  engagement: z
    .enum([ENGAGEMENT.ACTIVE, ENGAGEMENT.AT_RISK, ENGAGEMENT.INACTIVE, 'ALL'])
    .optional(),
  sort: z.enum(['name', '-name', 'createdAt', '-createdAt', 'lastActivityAt', '-lastActivityAt'])
    .optional(),
  withProgress: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v !== 'false'),
});

const updateStudentSchema = z.object({
  name: name.optional(),
  phone: phone.optional(),
  grade: safeText(60).optional(),
  school: safeText(120).optional(),
  parentPhone: phone.optional().or(z.literal('')),
  notes: safeText(500).optional(),
});

/** The teacher setting a new password for a student who cannot use email. */
const setStudentPasswordSchema = z.object({ password });

module.exports = {
  setStudentPasswordSchema,
  createAssistantSchema,
  updateAssistantSchema,
  setAssistantStatusSchema,
  reviewStudentSchema,
  bulkReviewSchema,
  studentListQuery,
  updateStudentSchema,
};
