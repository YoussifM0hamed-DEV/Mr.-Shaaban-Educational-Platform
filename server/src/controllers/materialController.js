const path = require('path');
const { Lesson, Material, MaterialAccess, User } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ok, created } = require('../utils/response');
const { uploadBuffer, destroy } = require('../config/cloudinary');
const {
  ROLES,
  ACCOUNT_STATUS,
  ACTIVITY_TYPES,
  NOTIFICATION_TYPES,
} = require('../config/constants');
const activityService = require('../services/activityService');
const accessService = require('../services/accessService');
const notificationService = require('../services/notificationService');

const extOf = (name) => path.extname(name || '').replace('.', '').toLowerCase();

/** POST /api/lessons/:lessonId/materials - accepts several files in one request. */
const uploadMaterials = asyncHandler(async (req, res) => {
  if (!req.files || !req.files.length) throw ApiError.badRequest('Select at least one file');

  const lesson = await Lesson.findOne({ _id: req.params.lessonId, isDeleted: false });
  if (!lesson) throw ApiError.notFound('Lesson not found');

  const allowDownload = req.body.allowDownload !== false && req.body.allowDownload !== 'false';

  const docs = [];
  for (const file of req.files) {
    const uploaded = await uploadBuffer(file.buffer, {
      folder: `platform/materials/${lesson.module}`,
      resourceType: 'auto',
      filename: file.originalname,
    });

    docs.push({
      lesson: lesson._id,
      module: lesson.module,
      title: req.files.length === 1 && req.body.title ? req.body.title : file.originalname,
      fileName: file.originalname,
      fileUrl: uploaded.url,
      publicId: uploaded.publicId,
      storage: uploaded.storage,
      fileType: extOf(file.originalname) || uploaded.format || '',
      mimeType: file.mimetype,
      fileSize: uploaded.bytes || file.size,
      allowDownload,
      uploadedBy: req.user._id,
    });
  }

  const materials = await Material.insertMany(docs);

  if (lesson.isPublished) {
    await notificationService.notifyModuleStudents(lesson.module, {
      type: NOTIFICATION_TYPES.NEW_MATERIAL,
      title: 'New material available',
      message: `${materials.length} file${materials.length === 1 ? '' : 's'} added to "${lesson.title}".`,
      link: `/student/lessons/${lesson._id}`,
      action: { label: 'OPEN LESSON', url: `/student/lessons/${lesson._id}` },
      meta: { lessonId: String(lesson._id) },
    });
  }

  return created(res, materials, 'Material uploaded');
});

/** GET /api/lessons/:lessonId/materials */
const listMaterials = asyncHandler(async (req, res) => {
  const materials = await Material.find({ lesson: req.params.lessonId })
    .sort({ createdAt: 1 })
    .lean();

  if (req.user.role === ROLES.STUDENT) {
    const accessed = await MaterialAccess.find({
      student: req.user._id,
      lesson: req.params.lessonId,
    }).lean();
    const map = new Map(accessed.map((a) => [String(a.material), a]));

    return ok(
      res,
      materials.map((m) => ({
        ...m,
        opened: map.has(String(m._id)),
        lastOpenedAt: map.get(String(m._id))?.lastOpenedAt || null,
      }))
    );
  }

  return ok(res, materials);
});

/** PATCH /api/materials/:id */
const updateMaterial = asyncHandler(async (req, res) => {
  const material = await Material.findById(req.params.id);
  if (!material) throw ApiError.notFound('Material not found');

  if (req.body.title !== undefined) material.title = req.body.title;
  if (req.body.allowDownload !== undefined) material.allowDownload = req.body.allowDownload;
  await material.save();

  return ok(res, material, 'Material updated');
});

/** DELETE /api/materials/:id */
const deleteMaterial = asyncHandler(async (req, res) => {
  const material = await Material.findById(req.params.id);
  if (!material) throw ApiError.notFound('Material not found');

  await destroy(material.publicId, { storage: material.storage, resourceType: 'raw' });
  await MaterialAccess.deleteMany({ material: material._id });
  await material.deleteOne();

  return ok(res, null, 'Material deleted');
});

/**
 * POST /api/materials/:id/open
 * Records that the student actually opened the file and returns the URL.
 * The student never gets the URL without this being recorded.
 */
const openMaterial = asyncHandler(async (req, res) => {
  const material = await Material.findById(req.params.id);
  if (!material) throw ApiError.notFound('Material not found');

  if (req.user.role === ROLES.STUDENT) {
    if (req.user.status !== ACCOUNT_STATUS.APPROVED) {
      throw ApiError.forbidden('Your account is not approved');
    }

    const lesson = await Lesson.findOne({
      _id: material.lesson,
      isDeleted: false,
      isPublished: true,
    })
      .populate('module', 'isPublished isDeleted')
      .lean();

    if (!lesson || !lesson.module || !lesson.module.isPublished || lesson.module.isDeleted) {
      throw ApiError.notFound('Material not available');
    }

    await accessService.assertModuleAccess(req.user, lesson.module._id);

    const isDownload = req.query.download === 'true';
    if (isDownload && !material.allowDownload) {
      throw ApiError.forbidden('Downloading is disabled for this file');
    }

    const now = new Date();
    const existing = await MaterialAccess.findOne({
      student: req.user._id,
      material: material._id,
    });

    if (existing) {
      existing.lastOpenedAt = now;
      existing.accessCount += 1;
      if (isDownload) existing.downloadCount += 1;
      await existing.save();
    } else {
      await MaterialAccess.create({
        student: req.user._id,
        material: material._id,
        lesson: material.lesson,
        module: material.module,
        firstOpenedAt: now,
        lastOpenedAt: now,
        accessCount: 1,
        downloadCount: isDownload ? 1 : 0,
      });
    }

    await activityService.logActivity({
      studentId: req.user._id,
      activityType: ACTIVITY_TYPES.MATERIAL_OPENED,
      moduleId: material.module,
      lessonId: material.lesson,
      contentId: material._id,
      contentType: 'MATERIAL',
      metadata: { fileName: material.fileName, download: isDownload },
    });
  }

  return ok(res, {
    _id: material._id,
    fileName: material.fileName,
    fileUrl: material.fileUrl,
    fileType: material.fileType,
    allowDownload: material.allowDownload,
  });
});

/** GET /api/materials/:id/access - who opened this file. */
const listMaterialAccess = asyncHandler(async (req, res) => {
  const material = await Material.findById(req.params.id);
  if (!material) throw ApiError.notFound('Material not found');

  const [students, accesses] = await Promise.all([
    User.find({ role: ROLES.STUDENT, status: ACCOUNT_STATUS.APPROVED, isDeleted: false })
      .select('name email avatarUrl')
      .sort({ name: 1 })
      .lean(),
    MaterialAccess.find({ material: material._id }).lean(),
  ]);

  const map = new Map(accesses.map((a) => [String(a.student), a]));

  const rows = students.map((s) => {
    const a = map.get(String(s._id));
    return {
      student: { _id: s._id, name: s.name, email: s.email, avatarUrl: s.avatarUrl },
      opened: Boolean(a),
      accessCount: a ? a.accessCount : 0,
      firstOpenedAt: a ? a.firstOpenedAt : null,
      lastOpenedAt: a ? a.lastOpenedAt : null,
    };
  });

  return ok(res, {
    material: { _id: material._id, fileName: material.fileName },
    rows,
    summary: { total: rows.length, opened: rows.filter((r) => r.opened).length },
  });
});

module.exports = {
  uploadMaterials,
  listMaterials,
  updateMaterial,
  deleteMaterial,
  openMaterial,
  listMaterialAccess,
};
