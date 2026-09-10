const env = require('../config/env');
const logger = require('../utils/logger');
const ApiError = require('../utils/ApiError');

const TOKEN_URL = 'https://zoom.us/oauth/token';
const API_BASE = 'https://api.zoom.us/v2';

// Zoom access tokens last an hour. Cached so a burst of requests reuses one.
let cachedToken = null;
let cachedUntil = 0;

/**
 * Server-to-Server OAuth.
 * The account credentials never leave the server, and no teacher ever has to
 * sign in to Zoom from the browser.
 */
async function getAccessToken() {
  if (!env.zoomConfigured) {
    throw ApiError.badRequest(
      'Zoom is not connected. Add ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET to the server settings.'
    );
  }

  if (cachedToken && Date.now() < cachedUntil) return cachedToken;

  const basic = Buffer.from(`${env.ZOOM_CLIENT_ID}:${env.ZOOM_CLIENT_SECRET}`).toString('base64');
  const params = new URLSearchParams({
    grant_type: 'account_credentials',
    account_id: env.ZOOM_ACCOUNT_ID,
  });

  const res = await fetch(`${TOKEN_URL}?${params}`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}` },
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    logger.error('Zoom token request failed:', res.status, JSON.stringify(body));
    const reason = body.reason || body.error || 'check the Zoom credentials';
    throw new ApiError(502, `Zoom refused the connection: ${reason}`);
  }

  cachedToken = body.access_token;
  // Refresh a minute early so a request never races the expiry.
  cachedUntil = Date.now() + Math.max(0, (body.expires_in || 3600) - 60) * 1000;
  return cachedToken;
}

/** Wraps a Zoom API call and turns its errors into the platform's shape. */
async function zoomRequest(path, { method = 'GET', body } = {}) {
  const token = await getAccessToken();

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    logger.error(`Zoom ${method} ${path} failed:`, res.status, JSON.stringify(data));

    if (res.status === 401) {
      // Force a fresh token next time in case ours was revoked.
      cachedToken = null;
      throw new ApiError(502, 'Zoom rejected the credentials. Check the Zoom app settings.');
    }
    if (res.status === 404) throw ApiError.notFound('That meeting no longer exists in Zoom');

    const detail = data.message || `HTTP ${res.status}`;
    throw new ApiError(502, `Zoom could not complete the request: ${detail}`);
  }

  return data;
}

const toZoomTime = (date) => new Date(date).toISOString().replace(/\.\d{3}Z$/, 'Z');

const durationMinutes = (startTime, endTime) =>
  Math.max(1, Math.round((new Date(endTime) - new Date(startTime)) / 60000));

/**
 * Creates a scheduled meeting on the teacher's Zoom account.
 * Only the participant join URL is kept. The host link is deliberately
 * discarded: it grants host control and would be unsafe to store or share.
 */
async function createMeeting({ title, description, startTime, endTime }) {
  const data = await zoomRequest('/users/me/meetings', {
    method: 'POST',
    body: {
      topic: title.slice(0, 200),
      type: 2, // a meeting at a fixed time
      start_time: toZoomTime(startTime),
      duration: durationMinutes(startTime, endTime),
      timezone: 'UTC',
      agenda: (description || '').slice(0, 2000),
      settings: {
        // Students can be in the room before the teacher arrives.
        join_before_host: true,
        waiting_room: false,
        mute_upon_entry: true,
        approval_type: 2, // no Zoom registration required
        auto_recording: 'none',
      },
    },
  });

  return {
    externalMeetingId: String(data.id),
    meetingUrl: data.join_url,
    meetingPassword: data.password || '',
  };
}

/** Pushes a changed title, time or length back to Zoom. */
async function updateMeeting(externalMeetingId, { title, description, startTime, endTime }) {
  const body = {};
  if (title) body.topic = title.slice(0, 200);
  if (description !== undefined) body.agenda = (description || '').slice(0, 2000);
  if (startTime) {
    body.start_time = toZoomTime(startTime);
    body.timezone = 'UTC';
  }
  if (startTime && endTime) body.duration = durationMinutes(startTime, endTime);

  if (!Object.keys(body).length) return null;
  return zoomRequest(`/meetings/${externalMeetingId}`, { method: 'PATCH', body });
}

/**
 * Removes the meeting from Zoom.
 * Failures are logged and swallowed: the platform must still be able to cancel
 * a class even if Zoom is unreachable or the meeting is already gone.
 */
async function deleteMeeting(externalMeetingId) {
  if (!externalMeetingId || !env.zoomConfigured) return false;
  try {
    await zoomRequest(`/meetings/${externalMeetingId}`, { method: 'DELETE' });
    return true;
  } catch (err) {
    logger.warn(`Could not delete Zoom meeting ${externalMeetingId}: ${err.message}`);
    return false;
  }
}

/** Confirms the credentials work and reports which Zoom account they belong to. */
async function testConnection() {
  if (!env.zoomConfigured) return { ok: false, reason: 'not configured' };
  try {
    const me = await zoomRequest('/users/me');
    return {
      ok: true,
      account: me.email,
      name: [me.first_name, me.last_name].filter(Boolean).join(' '),
      planType: me.type === 1 ? 'Basic (40 minute group limit)' : 'Licensed',
    };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

module.exports = {
  createMeeting,
  updateMeeting,
  deleteMeeting,
  testConnection,
  isConfigured: env.zoomConfigured,
};
