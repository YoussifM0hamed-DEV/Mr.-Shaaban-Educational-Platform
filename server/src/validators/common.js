const { z } = require('zod');
const mongoose = require('mongoose');

const objectId = z
  .string()
  .refine((v) => mongoose.Types.ObjectId.isValid(v), { message: 'Invalid id' });

const idParam = z.object({ id: objectId });

const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().max(120).optional(),
  sort: z.string().trim().max(60).optional(),
});

const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(160);

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .refine((v) => /[a-zA-Z]/.test(v) && /[0-9]/.test(v), {
    message: 'Password must contain at least one letter and one number',
  });

const name = z.string().trim().min(2, 'Name is too short').max(120);

const phone = z
  .string()
  .trim()
  .min(7, 'Enter a valid phone number')
  .max(30)
  .regex(/^[+()\-\s0-9]+$/, 'Enter a valid phone number');

// Control characters (U+0000-U+001F and U+007F) are stripped from stored text.
const CONTROL_CHARS = new RegExp('[\\u0000-\\u001F\\u007F]', 'g');

/** Trims, length-caps and strips control characters from free text. */
const safeText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v.replace(CONTROL_CHARS, ''));

const url = z.string().trim().url('Enter a valid URL').max(2000);

module.exports = {
  objectId,
  idParam,
  paginationQuery,
  email,
  password,
  name,
  phone,
  safeText,
  url,
  CONTROL_CHARS,
};
