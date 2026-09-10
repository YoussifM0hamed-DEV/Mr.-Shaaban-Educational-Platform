const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, created } = require('../utils/response');
const { getPagination, escapeRegex } = require('../utils/pagination');
const { paginated } = require('../utils/response');
const {
  ROLES,
  ACCOUNT_STATUS,
  PERMISSION_LIST,
  PERMISSION_LABELS,
} = require('../config/constants');

function publicAssistant(a) {
  return {
    _id: a._id,
    name: a.name,
    email: a.email,
    phone: a.phone,
    status: a.status,
    permissions: a.permissions,
    lastLoginAt: a.lastLoginAt,
    createdAt: a.createdAt,
  };
}

/** GET /api/assistants */
const listAssistants = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.validatedQuery || req.query);
  const search = (req.validatedQuery || req.query).search;

  const filter = { role: ROLES.ASSISTANT, isDeleted: false };
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }

  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  return paginated(res, items.map(publicAssistant), { page, limit, total });
});

/** GET /api/assistants/permissions - the catalogue the teacher picks from. */
const listPermissions = asyncHandler(async (_req, res) => {
  return ok(
    res,
    PERMISSION_LIST.map((key) => ({ key, label: PERMISSION_LABELS[key] }))
  );
});

/** GET /api/assistants/:id */
const getAssistant = asyncHandler(async (req, res) => {
  const assistant = await User.findOne({
    _id: req.params.id,
    role: ROLES.ASSISTANT,
    isDeleted: false,
  });
  if (!assistant) throw ApiError.notFound('Assistant not found');
  return ok(res, publicAssistant(assistant));
});

/**
 * POST /api/assistants
 * Only the teacher can create assistants, and only for this platform.
 */
const createAssistant = asyncHandler(async (req, res) => {
  const { name, email, password, phone, permissions } = req.body;

  const existing = await User.findOne({ email });
  if (existing) throw ApiError.conflict('An account with this email already exists');

  const assistant = await User.create({
    name,
    email,
    password,
    phone,
    role: ROLES.ASSISTANT,
    status: ACCOUNT_STATUS.APPROVED,
    permissions: permissions || [],
    reviewedBy: req.user._id,
    reviewedAt: new Date(),
  });

  return created(res, publicAssistant(assistant), 'Assistant account created');
});

/** PUT /api/assistants/:id */
const updateAssistant = asyncHandler(async (req, res) => {
  const assistant = await User.findOne({
    _id: req.params.id,
    role: ROLES.ASSISTANT,
    isDeleted: false,
  }).select('+password');
  if (!assistant) throw ApiError.notFound('Assistant not found');

  const { name, phone, permissions, password } = req.body;
  if (name !== undefined) assistant.name = name;
  if (phone !== undefined) assistant.phone = phone;
  if (permissions !== undefined) assistant.permissions = permissions;
  if (password) assistant.password = password;

  await assistant.save();
  return ok(res, publicAssistant(assistant), 'Assistant updated');
});

/** PATCH /api/assistants/:id/status - enable or disable sign-in. */
const setAssistantStatus = asyncHandler(async (req, res) => {
  const assistant = await User.findOne({
    _id: req.params.id,
    role: ROLES.ASSISTANT,
    isDeleted: false,
  });
  if (!assistant) throw ApiError.notFound('Assistant not found');

  assistant.status = req.body.status;
  await assistant.save();

  return ok(
    res,
    publicAssistant(assistant),
    assistant.status === ACCOUNT_STATUS.DISABLED ? 'Assistant disabled' : 'Assistant enabled'
  );
});

/** DELETE /api/assistants/:id - soft delete, so historic records keep their author. */
const deleteAssistant = asyncHandler(async (req, res) => {
  const assistant = await User.findOne({
    _id: req.params.id,
    role: ROLES.ASSISTANT,
    isDeleted: false,
  });
  if (!assistant) throw ApiError.notFound('Assistant not found');

  assistant.isDeleted = true;
  assistant.status = ACCOUNT_STATUS.DISABLED;
  // Free the email so it can be reused.
  assistant.email = `deleted_${assistant._id}_${assistant.email}`;
  await assistant.save();

  return ok(res, null, 'Assistant deleted');
});

module.exports = {
  listAssistants,
  listPermissions,
  getAssistant,
  createAssistant,
  updateAssistant,
  setAssistantStatus,
  deleteAssistant,
};
