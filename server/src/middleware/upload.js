const multer = require('multer');
const ApiError = require('../utils/ApiError');

const MB = 1024 * 1024;

// Videos are never uploaded to this platform - the teacher links them instead -
// so only material and image uploads are handled here.
const MATERIAL_MIME = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'application/zip',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
];

const IMAGE_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

function makeFilter(allowed) {
  return (_req, file, cb) => {
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(ApiError.badRequest(`Unsupported file type: ${file.mimetype}`));
  };
}

const materialUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * MB, files: 5 },
  fileFilter: makeFilter(MATERIAL_MIME),
});

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * MB, files: 1 },
  fileFilter: makeFilter(IMAGE_MIME),
});

/** Turns multer's own errors into the platform's ApiError shape. */
function handleUploadError(err, _req, _res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return next(ApiError.tooLarge('File exceeds the size limit'));
    if (err.code === 'LIMIT_FILE_COUNT') return next(ApiError.badRequest('Too many files'));
    return next(ApiError.badRequest(err.message));
  }
  next(err);
}

module.exports = { materialUpload, imageUpload, handleUploadError, MB };
