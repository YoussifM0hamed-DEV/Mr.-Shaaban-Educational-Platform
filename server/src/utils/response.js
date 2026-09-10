/** Consistent success envelope used by every controller. */
function ok(res, data = null, message = null, extra = {}) {
  return res.status(200).json({ success: true, message, data, ...extra });
}

function created(res, data = null, message = null) {
  return res.status(201).json({ success: true, message, data });
}

function noContent(res) {
  return res.status(204).send();
}

/** Paginated envelope: { success, data: [...], pagination: {...}, ...extra } */
function paginated(res, items, { page, limit, total }, extra = {}) {
  return res.status(200).json({
    success: true,
    data: items,
    ...extra,
    pagination: {
      page,
      limit,
      total,
      totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  });
}

module.exports = { ok, created, noContent, paginated };
