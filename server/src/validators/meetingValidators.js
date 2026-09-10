const { z } = require('zod');
const { objectId, safeText, url } = require('./common');
const { MEETING_PROVIDERS, MEETING_STATUS } = require('../config/constants');

const baseMeeting = z.object({
  title: safeText(200).pipe(z.string().min(2, 'Title is too short')),
  description: safeText(2000).optional().default(''),
  provider: z.enum(Object.values(MEETING_PROVIDERS)).optional().default(MEETING_PROVIDERS.ZOOM),
  // Optional here because Zoom fills it in when autoCreate is set. The refine
  // below requires it for every other case.
  meetingUrl: url.optional(),
  externalMeetingId: safeText(120).optional().default(''),
  meetingPassword: safeText(60).optional().default(''),
  module: objectId.optional().nullable(),
  lesson: objectId.optional().nullable(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  attendees: z.array(objectId).max(2000).optional().default([]),
  groups: z.array(objectId).max(200).optional().default([]),
  invitedAll: z.boolean().optional().default(false),
  /** Ask the platform to create the room on Zoom instead of pasting a link. */
  autoCreate: z.boolean().optional().default(false),
});

const createMeetingSchema = baseMeeting.superRefine((d, ctx) => {
  if (d.endTime <= d.startTime) {
    ctx.addIssue({
      code: 'custom',
      path: ['endTime'],
      message: 'The end time must be after the start time',
    });
  }
  const hasSomeone =
    d.invitedAll || (d.attendees && d.attendees.length) || (d.groups && d.groups.length);
  if (!hasSomeone) {
    ctx.addIssue({
      code: 'custom',
      path: ['attendees'],
      message: 'Choose a group, pick students, or invite everyone',
    });
  }
  if (!d.autoCreate && !d.meetingUrl) {
    ctx.addIssue({
      code: 'custom',
      path: ['meetingUrl'],
      message: 'Paste the meeting link, or let the platform create it on Zoom',
    });
  }
  if (d.autoCreate && d.provider !== MEETING_PROVIDERS.ZOOM) {
    ctx.addIssue({
      code: 'custom',
      path: ['provider'],
      message: 'Only Zoom meetings can be created automatically',
    });
  }
});

const updateMeetingSchema = baseMeeting.partial().superRefine((d, ctx) => {
  if (d.startTime && d.endTime && d.endTime <= d.startTime) {
    ctx.addIssue({
      code: 'custom',
      path: ['endTime'],
      message: 'The end time must be after the start time',
    });
  }
});

const cancelMeetingSchema = z.object({
  reason: safeText(300).optional().default(''),
});

const meetingListQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().max(120).optional(),
  status: z.enum([...Object.values(MEETING_STATUS), 'ALL']).optional(),
  scope: z.enum(['UPCOMING', 'LIVE', 'PAST', 'ALL']).optional(),
});

module.exports = {
  createMeetingSchema,
  updateMeetingSchema,
  cancelMeetingSchema,
  meetingListQuery,
};
