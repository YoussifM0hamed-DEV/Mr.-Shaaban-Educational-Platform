const { LiveMeeting, MeetingAttendance, User } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, created, paginated } = require('../utils/response');
const { getPagination, escapeRegex } = require('../utils/pagination');
const {
  ROLES,
  ACCOUNT_STATUS,
  MEETING_STATUS,
  MEETING_PROVIDERS,
  MEETING_JOIN_WINDOW_MINUTES,
  ATTENDANCE_STATUS,
  ACTIVITY_TYPES,
  NOTIFICATION_TYPES,
} = require('../config/constants');
const env = require('../config/env');
const meetingService = require('../services/meetingService');
const zoomService = require('../services/zoomService');
const logger = require('../utils/logger');
const activityService = require('../services/activityService');
const notificationService = require('../services/notificationService');
const { emitToStaff, emitToMeeting, EVENTS } = require('../sockets');

const isStaff = (user) => user.role === ROLES.TEACHER || user.role === ROLES.ASSISTANT;

const JOIN_WINDOW_MS = MEETING_JOIN_WINDOW_MINUTES * 60 * 1000;

function scopeFilter(scope, now) {
  switch (scope) {
    case 'UPCOMING':
      return { status: MEETING_STATUS.UPCOMING, startTime: { $gte: now } };
    case 'LIVE':
      return { status: MEETING_STATUS.LIVE };
    case 'PAST':
      return { status: { $in: [MEETING_STATUS.ENDED, MEETING_STATUS.CANCELLED] } };
    default:
      return {};
  }
}

/**
 * GET /api/meetings
 * Staff see every meeting. A student only ever sees meetings they were invited to.
 */
const listMeetings = asyncHandler(async (req, res) => {
  const query = req.validatedQuery || req.query;
  const { page, limit, skip } = getPagination(query);
  const now = new Date();

  const filter = { isDeleted: false, ...scopeFilter(query.scope, now) };
  if (query.status && query.status !== 'ALL') filter.status = query.status;
  if (query.search) filter.title = new RegExp(escapeRegex(query.search), 'i');

  if (!isStaff(req.user)) {
    filter.attendees = req.user._id;
    filter.isPublished = true;
  }

  const sort = query.scope === 'PAST' ? { startTime: -1 } : { startTime: 1 };

  const [meetings, total] = await Promise.all([
    LiveMeeting.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('module', 'title')
      .populate('lesson', 'title')
      .lean(),
    LiveMeeting.countDocuments(filter),
  ]);

  const ids = meetings.map((m) => m._id);
  const attendanceRows = await MeetingAttendance.aggregate([
    { $match: { meeting: { $in: ids } } },
    {
      $group: {
        _id: '$meeting',
        invited: { $sum: { $cond: ['$invited', 1, 0] } },
        attended: { $sum: { $cond: [{ $eq: ['$status', ATTENDANCE_STATUS.ATTENDED] }, 1, 0] } },
        joined: { $sum: { $cond: ['$joined', 1, 0] } },
      },
    },
  ]);
  const statsMap = new Map(attendanceRows.map((r) => [String(r._id), r]));

  let myAttendance = new Map();
  if (!isStaff(req.user)) {
    const mine = await MeetingAttendance.find({
      meeting: { $in: ids },
      student: req.user._id,
    }).lean();
    myAttendance = new Map(mine.map((a) => [String(a.meeting), a]));
  }

  const rows = meetings.map((m) => {
    const stats = statsMap.get(String(m._id)) || { invited: 0, attended: 0, joined: 0 };
    const liveNow = new Date(m.startTime) <= now && new Date(m.endTime) > now;
    const base = {
      ...m,
      // Never expose the join URL through a list endpoint.
      meetingUrl: undefined,
      meetingPassword: undefined,
      liveNow: m.status !== MEETING_STATUS.CANCELLED && liveNow,
      studentCount: m.attendees.length,
      attendance: {
        invited: stats.invited || m.attendees.length,
        attended: stats.attended,
        joined: stats.joined,
        percentage: stats.invited ? Math.round((stats.attended / stats.invited) * 1000) / 10 : 0,
      },
      attendees: undefined,
    };

    if (!isStaff(req.user)) {
      const a = myAttendance.get(String(m._id));
      base.myAttendance = a
        ? { status: a.status, joined: a.joined, durationMinutes: Math.round(a.attendanceDuration / 60) }
        : { status: ATTENDANCE_STATUS.INVITED, joined: false, durationMinutes: 0 };

      // The join rule lives here so the button never promises what the API refuses.
      const joinOpensAt = new Date(new Date(m.startTime).getTime() - JOIN_WINDOW_MS);
      base.joinOpensAt = joinOpensAt;
      base.canJoinNow =
        m.status !== MEETING_STATUS.CANCELLED &&
        now >= joinOpensAt &&
        now <= new Date(m.endTime);
    }

    return base;
  });

  return paginated(res, rows, { page, limit, total });
});

/** GET /api/meetings/:id */
const getMeeting = asyncHandler(async (req, res) => {
  const meeting = await LiveMeeting.findOne({ _id: req.params.id, isDeleted: false })
    .populate('module', 'title')
    .populate('lesson', 'title');
  if (!meeting) throw ApiError.notFound('Meeting not found');

  if (!isStaff(req.user)) {
    const invited = meeting.attendees.some((a) => String(a) === String(req.user._id));
    if (!invited) throw ApiError.forbidden('You were not invited to this meeting');
  }

  await meetingService.syncStatus(meeting);
  const stats = await meetingService.getAttendanceStats(meeting._id);

  const payload = meeting.toObject();
  // The join URL is handed out only by the join endpoint, which records attendance.
  delete payload.meetingUrl;
  delete payload.meetingPassword;

  if (isStaff(req.user)) {
    payload.meetingUrl = meeting.meetingUrl;
    payload.meetingPassword = meeting.meetingPassword;
    const attendees = await User.find({ _id: { $in: meeting.attendees } })
      .select('name email avatarUrl')
      .sort({ name: 1 })
      .lean();
    payload.attendeeList = attendees;

    const { Group } = require('../models');
    payload.groupList = await Group.find({ _id: { $in: meeting.groups || [] } })
      .select('name color')
      .lean();
  } else {
    delete payload.attendees;
  }

  return ok(res, { meeting: payload, stats });
});

/**
 * GET /api/meetings/integrations
 * Tells the form whether the platform can create the meeting itself.
 * Pass ?test=true to check the credentials against Zoom for real.
 */
const listIntegrations = asyncHandler(async (req, res) => {
  const zoom = { configured: zoomService.isConfigured };

  if (req.query.test === 'true' && zoom.configured) {
    Object.assign(zoom, await zoomService.testConnection());
  }

  return ok(res, { zoom });
});

/** POST /api/meetings */
const createMeeting = asyncHandler(async (req, res) => {
  const attendees = await meetingService.resolveAttendees({
    invitedAll: req.body.invitedAll,
    attendeeIds: req.body.attendees,
    groupIds: req.body.groups,
  });

  if (!attendees.length) {
    throw ApiError.badRequest('No approved students matched the invite list');
  }

  const { autoCreate, ...payload } = req.body;

  // Let Zoom create the room so the teacher never copies a link by hand.
  if (autoCreate) {
    if (payload.provider !== MEETING_PROVIDERS.ZOOM) {
      throw ApiError.badRequest('Only Zoom meetings can be created automatically');
    }
    const created = await zoomService.createMeeting({
      title: payload.title,
      description: payload.description,
      startTime: payload.startTime,
      endTime: payload.endTime,
    });
    Object.assign(payload, created);
  }

  const meeting = await LiveMeeting.create({
    ...payload,
    attendees,
    createdBy: req.user._id,
  });
  meeting.status = meeting.computeStatus();
  await meeting.save();

  await meetingService.seedAttendance(meeting);
  await meetingService.notifyNewMeeting(meeting, env.TEACHER_NAME);

  emitToStaff(EVENTS.MEETING_UPDATED, { meetingId: String(meeting._id), action: 'created' });

  return created(res, meeting, 'Live meeting created');
});

/** PUT /api/meetings/:id */
const updateMeeting = asyncHandler(async (req, res) => {
  const meeting = await LiveMeeting.findOne({ _id: req.params.id, isDeleted: false });
  if (!meeting) throw ApiError.notFound('Meeting not found');
  if (meeting.status === MEETING_STATUS.ENDED) {
    throw ApiError.badRequest('A meeting that has ended cannot be edited');
  }

  const previousAttendees = meeting.attendees.map(String);

  const { attendees, invitedAll, groups, autoCreate, ...rest } = req.body;
  Object.assign(meeting, rest);

  // Keep the Zoom room in step when the platform is the one that made it.
  if (meeting.provider === MEETING_PROVIDERS.ZOOM && meeting.externalMeetingId) {
    try {
      await zoomService.updateMeeting(meeting.externalMeetingId, {
        title: meeting.title,
        description: meeting.description,
        startTime: meeting.startTime,
        endTime: meeting.endTime,
      });
    } catch (err) {
      // The class still moves in the platform; the teacher is told Zoom lagged.
      logger.warn(`Zoom was not updated for meeting ${meeting._id}: ${err.message}`);
    }
  }

  if (attendees !== undefined || invitedAll !== undefined || groups !== undefined) {
    meeting.invitedAll = invitedAll ?? meeting.invitedAll;
    meeting.groups = groups ?? meeting.groups;
    meeting.attendees = await meetingService.resolveAttendees({
      invitedAll: meeting.invitedAll,
      attendeeIds: attendees ?? [],
      groupIds: meeting.groups,
    });
  }

  meeting.status = meeting.computeStatus();
  await meeting.save();
  await meetingService.seedAttendance(meeting);

  // Tell only the students who were not already invited.
  const added = meeting.attendees.map(String).filter((id) => !previousAttendees.includes(id));
  if (added.length) {
    await notificationService.notifyUsers(added, {
      type: NOTIFICATION_TYPES.NEW_MEETING,
      title: 'You were added to a live class',
      message: `${env.TEACHER_NAME} added you to "${meeting.title}".`,
      link: '/student/live-classes',
      action: { label: 'VIEW CLASS', url: '/student/live-classes' },
      meta: { meetingId: String(meeting._id) },
    });
  }

  return ok(res, meeting, 'Meeting updated');
});

/** PATCH /api/meetings/:id/cancel */
const cancelMeeting = asyncHandler(async (req, res) => {
  const meeting = await LiveMeeting.findOne({ _id: req.params.id, isDeleted: false });
  if (!meeting) throw ApiError.notFound('Meeting not found');

  meeting.status = MEETING_STATUS.CANCELLED;
  meeting.cancelledReason = req.body.reason || '';
  await meeting.save();

  // Free the slot on the Zoom account too.
  if (meeting.provider === MEETING_PROVIDERS.ZOOM && meeting.externalMeetingId) {
    await zoomService.deleteMeeting(meeting.externalMeetingId);
  }

  await notificationService.notifyUsers(meeting.attendees, {
    type: NOTIFICATION_TYPES.NEW_MEETING,
    title: 'Live class cancelled',
    message: `"${meeting.title}" was cancelled.${
      meeting.cancelledReason ? ` ${meeting.cancelledReason}` : ''
    }`,
    link: '/student/live-classes',
    meta: { meetingId: String(meeting._id) },
  });

  return ok(res, meeting, 'Meeting cancelled');
});

/** DELETE /api/meetings/:id */
const deleteMeeting = asyncHandler(async (req, res) => {
  const meeting = await LiveMeeting.findOne({ _id: req.params.id, isDeleted: false });
  if (!meeting) throw ApiError.notFound('Meeting not found');

  meeting.isDeleted = true;
  await meeting.save();

  if (meeting.provider === MEETING_PROVIDERS.ZOOM && meeting.externalMeetingId) {
    await zoomService.deleteMeeting(meeting.externalMeetingId);
  }

  return ok(res, null, 'Meeting deleted');
});

/**
 * POST /api/meetings/:id/join
 * The only place a student ever receives the join URL.
 * Authentication, approval and the invite list are all checked here.
 */
const joinMeeting = asyncHandler(async (req, res) => {
  const meeting = await LiveMeeting.findOne({ _id: req.params.id, isDeleted: false });
  if (!meeting) throw ApiError.notFound('Meeting not found');

  await meetingService.syncStatus(meeting);

  if (meeting.status === MEETING_STATUS.CANCELLED) {
    throw ApiError.badRequest('This meeting was cancelled');
  }

  if (req.user.role === ROLES.STUDENT) {
    if (req.user.status !== ACCOUNT_STATUS.APPROVED) {
      throw ApiError.forbidden('Your account is not approved');
    }

    const invited = meeting.attendees.some((a) => String(a) === String(req.user._id));
    if (!invited) throw ApiError.forbidden('You were not invited to this meeting');

    if (meeting.status === MEETING_STATUS.UPCOMING) {
      // Allow joining a few minutes early, but not hours ahead.
      const opensAt = new Date(meeting.startTime.getTime() - JOIN_WINDOW_MS);
      if (new Date() < opensAt) throw ApiError.badRequest('This meeting has not started yet');
    }
    if (meeting.status === MEETING_STATUS.ENDED) {
      throw ApiError.badRequest('This meeting has ended');
    }

    const now = new Date();
    const record = await MeetingAttendance.findOneAndUpdate(
      { meeting: meeting._id, student: req.user._id },
      {
        $set: { joined: true, status: ATTENDANCE_STATUS.JOINED, leaveTime: null },
        $setOnInsert: { invited: true, joinTime: now },
      },
      { new: true, upsert: true }
    );

    // Re-entering an ongoing meeting starts a new timed session.
    if (!record.joinTime || record.leaveTime) {
      record.joinTime = now;
      record.leaveTime = undefined;
      await record.save();
    }

    await activityService.logActivity({
      studentId: req.user._id,
      activityType: ACTIVITY_TYPES.LIVE_MEETING_JOINED,
      moduleId: meeting.module,
      lessonId: meeting.lesson,
      contentId: meeting._id,
      contentType: 'MEETING',
      metadata: { title: meeting.title },
    });

    emitToStaff(EVENTS.MEETING_STUDENT_JOINED, {
      meetingId: String(meeting._id),
      studentId: String(req.user._id),
      studentName: req.user.name,
      at: now,
    });
    emitToMeeting(meeting._id, EVENTS.MEETING_STUDENT_JOINED, {
      studentId: String(req.user._id),
      studentName: req.user.name,
    });
  }

  return ok(res, {
    meetingUrl: meeting.meetingUrl,
    meetingPassword: meeting.meetingPassword,
    provider: meeting.provider,
    title: meeting.title,
  });
});

/** POST /api/meetings/:id/leave - closes the timed session and accumulates duration. */
const leaveMeeting = asyncHandler(async (req, res) => {
  const record = await MeetingAttendance.findOne({
    meeting: req.params.id,
    student: req.user._id,
  });
  if (!record || !record.joined) return ok(res, null, 'No open session');

  const now = new Date();
  if (record.joinTime && !record.leaveTime) {
    record.attendanceDuration += Math.max(0, Math.round((now - record.joinTime) / 1000));
  }
  record.leaveTime = now;
  await record.save();

  await activityService.logActivity({
    studentId: req.user._id,
    activityType: ACTIVITY_TYPES.LIVE_MEETING_LEFT,
    contentId: record.meeting,
    contentType: 'MEETING',
    metadata: { durationSeconds: record.attendanceDuration },
  });

  return ok(res, { attendanceDuration: record.attendanceDuration }, 'Session recorded');
});

/** GET /api/meetings/:id/attendance - the roll call for one meeting. */
const meetingAttendance = asyncHandler(async (req, res) => {
  const meeting = await LiveMeeting.findOne({ _id: req.params.id, isDeleted: false }).lean();
  if (!meeting) throw ApiError.notFound('Meeting not found');

  const [records, students] = await Promise.all([
    MeetingAttendance.find({ meeting: meeting._id }).lean(),
    User.find({ _id: { $in: meeting.attendees } })
      .select('name email avatarUrl')
      .sort({ name: 1 })
      .lean(),
  ]);

  const byStudent = new Map(records.map((r) => [String(r.student), r]));

  const rows = students.map((s) => {
    const r = byStudent.get(String(s._id));
    return {
      student: s,
      status: r ? r.status : ATTENDANCE_STATUS.INVITED,
      joined: r ? r.joined : false,
      joinTime: r ? r.joinTime : null,
      leaveTime: r ? r.leaveTime : null,
      durationMinutes: r ? Math.round((r.attendanceDuration || 0) / 60) : 0,
    };
  });

  const stats = await meetingService.getAttendanceStats(meeting._id);

  return ok(res, {
    meeting: {
      _id: meeting._id,
      title: meeting.title,
      startTime: meeting.startTime,
      endTime: meeting.endTime,
      status: meeting.status,
    },
    rows,
    stats,
  });
});

/** POST /api/meetings/:id/finalize - closes attendance without waiting for the sweep. */
const finalizeMeeting = asyncHandler(async (req, res) => {
  const meeting = await LiveMeeting.findOne({ _id: req.params.id, isDeleted: false });
  if (!meeting) throw ApiError.notFound('Meeting not found');

  meeting.status = MEETING_STATUS.ENDED;
  meeting.endTime = new Date() < meeting.endTime ? new Date() : meeting.endTime;
  await meeting.save();
  await meetingService.finalizeAttendance(meeting);

  const stats = await meetingService.getAttendanceStats(meeting._id);
  return ok(res, { meeting, stats }, 'Meeting closed and attendance finalized');
});

module.exports = {
  listIntegrations,
  listMeetings,
  getMeeting,
  createMeeting,
  updateMeeting,
  cancelMeeting,
  deleteMeeting,
  joinMeeting,
  leaveMeeting,
  meetingAttendance,
  finalizeMeeting,
};
