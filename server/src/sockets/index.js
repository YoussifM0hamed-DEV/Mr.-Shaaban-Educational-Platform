const { Server } = require('socket.io');
const cookie = require('cookie');
const env = require('../config/env');
const logger = require('../utils/logger');
const User = require('../models/User');
const { verifyToken, COOKIE_NAME } = require('../utils/token');
const { ROLES } = require('../config/constants');

let io = null;

const userRoom = (userId) => `user:${userId}`;
const ROOM_TEACHER = 'role:TEACHER';
const ROOM_STAFF = 'role:STAFF';
const ROOM_STUDENTS = 'role:STUDENTS';
const meetingRoom = (meetingId) => `meeting:${meetingId}`;

function readToken(socket) {
  const auth = socket.handshake.auth || {};
  if (auth.token) return auth.token;

  const raw = socket.handshake.headers.cookie;
  if (!raw) return null;
  const parsed = cookie.parse(raw);
  return parsed[COOKIE_NAME] || null;
}

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: env.allowedOrigins,
      credentials: true,
    },
    pingTimeout: 30000,
  });

  // Handshake auth mirrors the REST auth: identity comes from the DB, not the client.
  io.use(async (socket, next) => {
    try {
      const token = readToken(socket);
      if (!token) return next(new Error('Authentication required'));

      const payload = verifyToken(token);
      const user = await User.findById(payload.sub).select(
        'name role status isDeleted passwordChangedAt'
      );
      if (!user || user.isDeleted) return next(new Error('Account no longer exists'));

      // Same rule as the REST guard: a password change ends older sessions.
      if (user.passwordChangedAt && payload.iat) {
        if (payload.iat * 1000 < user.passwordChangedAt.getTime() - 1000) {
          return next(new Error('Session expired'));
        }
      }

      socket.user = { id: user._id.toString(), role: user.role, name: user.name };
      next();
    } catch {
      next(new Error('Invalid session'));
    }
  });

  io.on('connection', (socket) => {
    const { id, role } = socket.user;
    socket.join(userRoom(id));

    if (role === ROLES.TEACHER) {
      socket.join(ROOM_TEACHER);
      socket.join(ROOM_STAFF);
    } else if (role === ROLES.ASSISTANT) {
      socket.join(ROOM_STAFF);
    } else {
      socket.join(ROOM_STUDENTS);
    }

    logger.debug(`Socket connected: ${socket.user.name} (${role})`);

    // Live meeting presence, used only for the teacher's live attendee counter.
    socket.on('meeting:watch', (meetingId) => {
      if (typeof meetingId === 'string' && meetingId.length === 24) {
        socket.join(meetingRoom(meetingId));
      }
    });

    socket.on('meeting:unwatch', (meetingId) => {
      if (typeof meetingId === 'string') socket.leave(meetingRoom(meetingId));
    });

    socket.on('disconnect', () => {
      logger.debug(`Socket disconnected: ${socket.user.name}`);
    });
  });

  logger.info('Socket.IO initialized');
  return io;
}

function getIO() {
  return io;
}

/** All emit helpers are no-ops when sockets are unavailable, so REST keeps working. */
function emitToUser(userId, event, payload) {
  if (!io || !userId) return;
  io.to(userRoom(String(userId))).emit(event, payload);
}

function emitToUsers(userIds = [], event, payload) {
  if (!io) return;
  userIds.forEach((uid) => emitToUser(uid, event, payload));
}

function emitToTeacher(event, payload) {
  if (!io) return;
  io.to(ROOM_TEACHER).emit(event, payload);
}

function emitToStaff(event, payload) {
  if (!io) return;
  io.to(ROOM_STAFF).emit(event, payload);
}

function emitToStudents(event, payload) {
  if (!io) return;
  io.to(ROOM_STUDENTS).emit(event, payload);
}

function emitToMeeting(meetingId, event, payload) {
  if (!io) return;
  io.to(meetingRoom(String(meetingId))).emit(event, payload);
}

module.exports = {
  initSocket,
  getIO,
  emitToUser,
  emitToUsers,
  emitToTeacher,
  emitToStaff,
  emitToStudents,
  emitToMeeting,
  EVENTS: {
    NOTIFICATION: 'notification:new',
    NOTIFICATION_COUNT: 'notification:count',
    MEETING_LIVE: 'meeting:live',
    MEETING_STUDENT_JOINED: 'meeting:student-joined',
    MEETING_UPDATED: 'meeting:updated',
    STUDENT_REGISTERED: 'student:registered',
    QUIZ_COMPLETED: 'quiz:completed',
    EXAM_COMPLETED: 'exam:completed',
    ACTIVITY: 'activity:new',
    CONTENT_UPDATED: 'content:updated',
  },
};
