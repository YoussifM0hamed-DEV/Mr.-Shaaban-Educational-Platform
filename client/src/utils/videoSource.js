/**
 * Mirrors the server's video source rules so the form can warn the teacher
 * before a save, and the player knows which engine to load.
 * The server re-checks all of this - this copy is only for the user experience.
 */

export const VIDEO_PROVIDERS = { YOUTUBE: 'YOUTUBE', DIRECT: 'DIRECT' };

const DIRECT_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.ogv', '.mov', '.m4v', '.m3u8'];

const YOUTUBE_HOSTS = [
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
];

const isValidId = (id) => typeof id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(id);

export function parseYouTubeId(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.includes(host)) return null;

  if (host.endsWith('youtu.be')) {
    const id = parsed.pathname.split('/').filter(Boolean)[0];
    return isValidId(id) ? id : null;
  }

  const fromQuery = parsed.searchParams.get('v');
  if (isValidId(fromQuery)) return fromQuery;

  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length >= 2 && ['embed', 'shorts', 'live', 'v'].includes(segments[0])) {
    return isValidId(segments[1]) ? segments[1] : null;
  }

  return null;
}

export function isDirectVideoUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) return false;
  return DIRECT_EXTENSIONS.some((ext) => parsed.pathname.toLowerCase().endsWith(ext));
}

export function detectVideoSource(url) {
  const youtubeId = parseYouTubeId(url);
  if (youtubeId) return { provider: VIDEO_PROVIDERS.YOUTUBE, externalId: youtubeId };
  if (isDirectVideoUrl(url)) return { provider: VIDEO_PROVIDERS.DIRECT, externalId: '' };
  return null;
}

export const UNSUPPORTED_SOURCE_MESSAGE =
  'This link cannot be tracked. Use a YouTube link, or a direct link to a video file ending ' +
  'in .mp4, .webm, .mov or .m3u8. A Google Drive or Vimeo page link will not work, because ' +
  'the player cannot measure how much each student actually watched.';

export const SUPPORTED_SOURCES_HINT =
  'YouTube links work, and so does a direct link to a video file (.mp4, .webm, .mov, .m3u8).';
