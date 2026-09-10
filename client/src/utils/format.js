import { format, formatDistanceToNow, isToday, isYesterday, isValid } from 'date-fns';

export function formatDate(value, pattern = 'd MMM yyyy') {
  if (!value) return '-';
  const d = new Date(value);
  return isValid(d) ? format(d, pattern) : '-';
}

export function formatDateTime(value) {
  if (!value) return '-';
  const d = new Date(value);
  return isValid(d) ? format(d, 'd MMM yyyy, h:mm a') : '-';
}

export function formatTime(value) {
  if (!value) return '-';
  const d = new Date(value);
  return isValid(d) ? format(d, 'h:mm a') : '-';
}

/** "Today", "Yesterday", "3 days ago" - what the teacher actually wants to read. */
export function relativeDay(value) {
  if (!value) return 'Never';
  const d = new Date(value);
  if (!isValid(d)) return 'Never';
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return `${formatDistanceToNow(d)} ago`;
}

export function relativeTime(value) {
  if (!value) return 'Never';
  const d = new Date(value);
  if (!isValid(d)) return 'Never';
  return `${formatDistanceToNow(d, { addSuffix: false })} ago`;
}

/** Seconds to h:mm:ss or m:ss. */
export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

export function formatMinutes(minutes) {
  const m = Math.round(minutes || 0);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h}h ${rest}m` : `${h}h`;
}

export function formatFileSize(bytes) {
  if (!bytes) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function initials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function percent(value) {
  return `${Math.round(value || 0)}%`;
}

/** Datetime-local input needs a local-timezone ISO string without the Z. */
export function toDateTimeLocal(value) {
  if (!value) return '';
  const d = new Date(value);
  if (!isValid(d)) return '';
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}

export function pluralize(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural || `${singular}s`}`;
}
