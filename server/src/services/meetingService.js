const { LiveMeeting, MeetingAttendance, User } = require('../models');
const {
  MEETING_STATUS,
  ATTENDANCE_STATUS,
  NOTIFICATION_TYPES,
  ROLES,
  ACCOUNT_STATUS,
  ATTENDANCE_MIN_RATIO,
  ATTENDANCE_MIN_MINUTES,
} = require('../config/constants');
const notificationService = require('./notificationService');
const logger = require('../utils/logger');
const { emitToUsers, emitToStaff, EVENTS } = require('../sockets');

/** Writes the clock-derived status back to the document when it drifted. */
async function syncStatus(meeting, now = new Date()) {
  const computed = meeting.computeStatus(now);
  if (computed !== meeting.status) {
    meeting.status = computed;
    await meeting.save();
  }
  return meeting;
}

/** Creates one INVITED attendance row per invited student. */
async function seedAttendance(meeting) {
  const rows = meeting.attendees.map((studentId) => ({
    updateOne: {
      filter: { meeting: meeting._id, student: studentId },
      update: {
        $setOnInsert: {
          meeting: meeting._id,
          student: studentId,
          invited: true,
          status: ATTENDANCE_STATUS.INVITED,
        },
      },
      upsert: true,
    },
  }));

  if (rows.length) await MeetingAttendance.bulkWrite(rows);

  // Drop rows for students removed from the invite list who never joined.
  await MeetingAttendance.deleteMany({
    meeting: meeting._id,
    student: { $nin: meeting.attendees },
    joined: false,
  });
}

/**
 * Resolves the invite list into concrete students.
 * Three ways to invite: everyone, whole groups, or hand-picked students. Groups
 * and individuals combine, so a teacher can invite a group plus two extras.
 */
async function resolveAttendees({ invitedAll, attendeeIds = [], groupIds = [] }) {
  if (invitedAll) {
    const students = await User.find({
      role: ROLES.STUDENT,
      status: ACCOUNT_STATUS.APPROVED,
      isDeleted: false,
    }).select('_id');
    return students.map((s) => s._id);
  }

  const accessService = require('./accessService');
  const fromGroups = await accessService.studentsInGroups(groupIds);

  // Only approved students can ever be invited.
  const picked = await User.find({
    _id: { $in: attendeeIds },
    role: ROLES.STUDENT,
    status: ACCOUNT_STATUS.APPROVED,
    isDeleted: false,
  }).select('_id');

  const merged = new Map();
  [...fromGroups, ...picked.map((s) => s._id)].forEach((id) => merged.set(String(id), id));
  return [...merged.values()];
}

function formatTime(date) {
  return new Date(date).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function notifyNewMeeting(meeting, teacherName) {
  return notificationService.notifyUsers(meeting.attendees, {
    type: NOTIFICATION_TYPES.NEW_MEETING,
    title: 'New live class scheduled',
    message: `${teacherName} scheduled "${meeting.title}" for ${formatTime(meeting.startTime)}.`,
    link: `/student/live-classes`,
    action: { label: 'VIEW CLASS', url: `/student/live-classes` },
    meta: { meetingId: String(meeting._id) },
  });
}

async function notifyStartingSoon(meeting, teacherName, minutes) {
  await notificationService.notifyUsers(meeting.attendees, {
    type: NOTIFICATION_TYPES.MEETING_SOON,
    title: 'Your live class starts soon',
    message: `Your ${meeting.title} live class with ${teacherName} starts in ${minutes} minutes.`,
    link: `/student/live-classes`,
    action: { label: 'JOIN MEETING', url: `/student/live-classes` },
    meta: { meetingId: String(meeting._id) },
  });
  meeting.notifiedSoon = true;
  await meeting.save();
}

async function notifyLiveNow(meeting, teacherName) {
  await notificationService.notifyUsers(meeting.attendees, {
    type: NOTIFICATION_TYPES.MEETING_LIVE,
    title: `${teacherName} is LIVE NOW`,
    message: `"${meeting.title}" has started. Join now.`,
    link: `/student/live-classes`,
    action: { label: 'JOIN MEETING', url: `/student/live-classes` },
    meta: { meetingId: String(meeting._id) },
  });

  emitToUsers(meeting.attendees.map(String), EVENTS.MEETING_LIVE, {
    meetingId: String(meeting._id),
    title: meeting.title,
    startTime: meeting.startTime,
  });

  meeting.notifiedLive = true;
  await meeting.save();
}

/**
 * Background sweep: flips statuses, sends the reminder and live pushes,
 * and closes out attendance when a meeting ends.
 */
async function runMeetingScheduler(teacherName) {
  const now = new Date();
  const soonWindow = new Date(now.getTime() + 15 * 60 * 1000);

  try {
    // Reminder 15 minutes ahead.
    const soon = await LiveMeeting.find({
      isDeleted: false,
      status: MEETING_STATUS.UPCOMING,
      notifiedSoon: false,
      startTime: { $gt: now, $lte: soonWindow },
    });
    for (const meeting of soon) {
      const minutes = Math.max(1, Math.round((meeting.startTime - now) / 60000));
      await notifyStartingSoon(meeting, teacherName, minutes);
    }

    // Meetings that just went live.
    const goingLive = await LiveMeeting.find({
      isDeleted: false,
      status: { $in: [MEETING_STATUS.UPCOMING, MEETING_STATUS.LIVE] },
      startTime: { $lte: now },
      endTime: { $gt: now },
    });
    for (const meeting of goingLive) {
      meeting.status = MEETING_STATUS.LIVE;
      await meeting.save();
      if (!meeting.notifiedLive) await notifyLiveNow(meeting, teacherName);
    }

    // Meetings that have finished.
    const ending = await LiveMeeting.find({
      isDeleted: false,
      status: { $in: [MEETING_STATUS.UPCOMING, MEETING_STATUS.LIVE] },
      endTime: { $lte: now },
    });
    for (const meeting of ending) {
      meeting.status = MEETING_STATUS.ENDED;
      await meeting.save();
      await finalizeAttendance(meeting);
      emitToStaff(EVENTS.MEETING_UPDATED, { meetingId: String(meeting._id), status: 'ENDED' });
    }
  } catch (err) {
    logger.error('Meeting scheduler failed:', err.message);
  }
}

/** After a meeting ends: close open sessions and mark ATTENDED vs ABSENT. */
async function finalizeAttendance(meeting) {
  const records = await MeetingAttendance.find({ meeting: meeting._id });
  const meetingSeconds = Math.max(0, (meeting.endTime - meeting.startTime) / 1000);
  const requiredSeconds = Math.min(
    meetingSeconds * ATTENDANCE_MIN_RATIO,
    ATTENDANCE_MIN_MINUTES * 60
  );

  const ops = records.map((record) => {
    let duration = record.attendanceDuration || 0;

    // Student never pressed "leave" - count up to the meeting end.
    if (record.joined && record.joinTime && !record.leaveTime) {
      duration += Math.max(0, (meeting.endTime - record.joinTime) / 1000);
    }

    const attended = record.joined && duration >= requiredSeconds;

    return {
      updateOne: {
        filter: { _id: record._id },
        update: {
          $set: {
            attendanceDuration: Math.round(duration),
            leaveTime: record.leaveTime || (record.joined ? meeting.endTime : undefined),
            status: attended ? ATTENDANCE_STATUS.ATTENDED : ATTENDANCE_STATUS.ABSENT,
          },
        },
      },
    };
  });

  if (ops.length) await MeetingAttendance.bulkWrite(ops);
}

/** Attendance roll-up shown on meeting cards and the attendance page. */
async function getAttendanceStats(meetingId) {
  const rows = await MeetingAttendance.aggregate([
    { $match: { meeting: meetingId } },
    {
      $group: {
        _id: null,
        invited: { $sum: { $cond: ['$invited', 1, 0] } },
        joined: { $sum: { $cond: ['$joined', 1, 0] } },
        attended: { $sum: { $cond: [{ $eq: ['$status', ATTENDANCE_STATUS.ATTENDED] }, 1, 0] } },
        absent: { $sum: { $cond: [{ $eq: ['$status', ATTENDANCE_STATUS.ABSENT] }, 1, 0] } },
      },
    },
  ]);

  const r = rows[0] || { invited: 0, joined: 0, attended: 0, absent: 0 };
  const settled = r.attended + r.absent;
  return {
    invited: r.invited,
    joined: r.joined,
    attended: r.attended,
    absent: settled > 0 ? r.absent : Math.max(0, r.invited - r.joined),
    attendancePercentage: r.invited > 0 ? Math.round((r.attended / r.invited) * 1000) / 10 : 0,
  };
}

module.exports = {
  syncStatus,
  seedAttendance,
  resolveAttendees,
  notifyNewMeeting,
  notifyStartingSoon,
  notifyLiveNow,
  runMeetingScheduler,
  finalizeAttendance,
  getAttendanceStats,
};
