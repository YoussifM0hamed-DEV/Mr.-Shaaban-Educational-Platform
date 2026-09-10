const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/** Normalizes ?page & ?limit into safe numbers. Never lets a client request the whole table. */
function getPagination(query = {}) {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);

  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  return { page, limit, skip: (page - 1) * limit };
}

/** Turns "field" / "-field" into a mongoose sort object, restricted to an allow-list. */
function getSort(sortParam, allowed = [], fallback = { createdAt: -1 }) {
  if (!sortParam || typeof sortParam !== 'string') return fallback;
  const desc = sortParam.startsWith('-');
  const field = desc ? sortParam.slice(1) : sortParam;
  if (!allowed.includes(field)) return fallback;
  return { [field]: desc ? -1 : 1 };
}

/** Escapes user input before it is used inside a RegExp for search. */
function escapeRegex(str = '') {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { getPagination, getSort, escapeRegex, DEFAULT_LIMIT, MAX_LIMIT };
