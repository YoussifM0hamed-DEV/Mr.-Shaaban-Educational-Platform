const { z } = require('zod');
const { objectId, safeText } = require('./common');

const createGroupSchema = z.object({
  name: safeText(120).pipe(z.string().min(2, 'Give the group a name')),
  description: safeText(500).optional().default(''),
  color: z.enum(['indigo', 'emerald', 'amber', 'rose', 'sky', 'violet']).optional(),
  students: z.array(objectId).max(2000).optional().default([]),
});

const updateGroupSchema = createGroupSchema.partial();

const changeMembersSchema = z
  .object({
    add: z.array(objectId).max(2000).optional().default([]),
    remove: z.array(objectId).max(2000).optional().default([]),
  })
  .refine((d) => d.add.length > 0 || d.remove.length > 0, {
    message: 'Nothing to change',
  });

module.exports = { createGroupSchema, updateGroupSchema, changeMembersSchema };
