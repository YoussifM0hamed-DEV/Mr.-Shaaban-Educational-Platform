/* Minimal leveled logger. Keeps output structured without pulling in a dependency. */
const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const current = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

function log(level, ...args) {
  if (LEVELS[level] > LEVELS[current]) return;
  const stamp = new Date().toISOString();
  const line = `[${stamp}] ${level.toUpperCase()}`;
  if (level === 'error') console.error(line, ...args);
  else if (level === 'warn') console.warn(line, ...args);
  else console.log(line, ...args);
}

module.exports = {
  error: (...a) => log('error', ...a),
  warn: (...a) => log('warn', ...a),
  info: (...a) => log('info', ...a),
  debug: (...a) => log('debug', ...a),
};
