import { io } from 'socket.io-client';
import { get } from './api';

let socket = null;

/**
 * The websocket may live on another domain than the page, where the browser
 * will not send the auth cookie. So ask the API for a short-lived token first
 * and hand that to the handshake instead.
 */
async function fetchSocketToken() {
  try {
    const res = await get('/auth/socket-token');
    return res.data?.token || null;
  } catch {
    return null;
  }
}

/**
 * Connects lazily after sign-in. The cookie is sent automatically,
 * and every consumer must keep working if this never connects.
 */
export function connectSocket() {
  if (socket) {
    if (!socket.connected) socket.connect();
    return socket;
  }

  const url = import.meta.env.VITE_SOCKET_URL || undefined;

  socket = io(url, {
    withCredentials: true,
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 10,
    reconnectionDelay: 1500,
    autoConnect: false,
  });

  // Refresh the handshake token on every attempt, including reconnections,
  // because it deliberately expires after a few minutes.
  const connectWithToken = async () => {
    socket.auth = { token: await fetchSocketToken() };
    socket.connect();
  };

  socket.io.on('reconnect_attempt', () => {
    fetchSocketToken().then((token) => {
      socket.auth = { token };
    });
  });

  connectWithToken();
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

export function getSocket() {
  return socket;
}

/** Subscribes to an event and returns the unsubscribe function. */
export function onSocketEvent(event, handler) {
  const s = connectSocket();
  s.on(event, handler);
  return () => s.off(event, handler);
}

export const SOCKET_EVENTS = {
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
};
