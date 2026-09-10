/**
 * Works out where a lesson video is hosted from its URL.
 *
 * Only sources the platform can genuinely track are accepted. Watch progress is
 * the point of this system, so a link the player cannot measure is rejected at
 * the door rather than silently producing zero progress for every student.
 */

const VIDEO_PROVIDERS = Object.freeze({
  YOUTUBE: 'YOUTUBE',
  DIRECT: 'DIRECT',
});

const DIRECT_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.ogv', '.mov', '.m4v', '.m3u8'];

const YOUTUBE_HOSTS = [
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
];

/** Pulls the 11-character video id out of any common YouTube URL shape. */
function parseYouTubeId(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.includes(host)) return null;

  // youtu.be/<id>
  if (host.endsWith('youtu.be')) {
    const id = parsed.pathname.split('/').filter(Boolean)[0];
    return isValidId(id) ? id : null;
  }

  // youtube.com/watch?v=<id>
  const fromQuery = parsed.searchParams.get('v');
  if (isValidId(fromQuery)) return fromQuery;

  // youtube.com/embed/<id>, /shorts/<id>, /live/<id>, /v/<id>
  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length >= 2 && ['embed', 'shorts', 'live', 'v'].includes(segments[0])) {
    return isValidId(segments[1]) ? segments[1] : null;
  }

  return null;
}

function isValidId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(id);
}

/** True when the URL points straight at a playable video file. */
function isDirectVideoUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) return false;

  const pathname = parsed.pathname.toLowerCase();
  return DIRECT_EXTENSIONS.some((ext) => pathname.endsWith(ext));
}

/**
 * @returns {{provider: string, externalId: string}|null} null when the URL is
 *          a source whose watch progress cannot be measured.
 */
function detectVideoSource(url) {
  const youtubeId = parseYouTubeId(url);
  if (youtubeId) return { provider: VIDEO_PROVIDERS.YOUTUBE, externalId: youtubeId };

  if (isDirectVideoUrl(url)) return { provider: VIDEO_PROVIDERS.DIRECT, externalId: '' };

  return null;
}

/** The message shown when a teacher pastes a link the platform cannot track. */
const UNSUPPORTED_SOURCE_MESSAGE =
  'This link cannot be tracked. Use a YouTube link, or a direct link to a video file ' +
  'ending in .mp4, .webm, .mov or .m3u8. A Google Drive or Vimeo page link will not work, ' +
  'because the player cannot measure how much each student actually watched.';

module.exports = {
  VIDEO_PROVIDERS,
  detectVideoSource,
  parseYouTubeId,
  isDirectVideoUrl,
  UNSUPPORTED_SOURCE_MESSAGE,
  DIRECT_EXTENSIONS,
};
