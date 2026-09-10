const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { v2: cloudinary } = require('cloudinary');
const streamifier = require('streamifier');
const env = require('./env');
const logger = require('../utils/logger');
const ApiError = require('../utils/ApiError');

const LOCAL_DIR = path.resolve(__dirname, '../../uploads');

if (env.cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  logger.info('Cloudinary storage enabled');
} else {
  logger.warn(
    'Cloudinary is not configured - uploads fall back to local disk under server/uploads. ' +
      'Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to enable cloud storage.'
  );
}

/**
 * Turns a Cloudinary failure into the platform's error shape.
 * A rejected or corrupt file is the uploader's mistake, so it must surface as a
 * 400 with a usable message rather than a generic 500.
 */
function toUploadError(error) {
  const message = error?.message || 'Upload failed';
  const status = error?.http_code;

  if (status && status >= 400 && status < 500) {
    return new ApiError(status === 413 ? 413 : 400, message);
  }
  if (/invalid|unsupported|corrupt|empty file|format/i.test(message)) {
    return new ApiError(400, `${message}. Please check the file and try again.`);
  }

  logger.error('Cloudinary upload failed:', message);
  return new ApiError(502, 'The storage service rejected this upload. Please try again.');
}

function uploadToCloudinary(buffer, { folder, resourceType, filename }) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        use_filename: true,
        unique_filename: true,
        filename_override: filename,
      },
      (error, result) => {
        if (error) return reject(toUploadError(error));
        resolve({
          storage: 'cloudinary',
          url: result.secure_url,
          publicId: result.public_id,
          bytes: result.bytes,
          duration: result.duration ? Math.round(result.duration) : undefined,
          format: result.format,
          resourceType: result.resource_type,
        });
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

async function uploadToLocalDisk(buffer, { folder, filename }) {
  const dir = path.join(LOCAL_DIR, folder.replace(/[^a-zA-Z0-9/_-]/g, ''));
  await fs.promises.mkdir(dir, { recursive: true });

  const ext = path.extname(filename || '') || '';
  const base = crypto.randomBytes(12).toString('hex');
  const stored = `${base}${ext}`;
  await fs.promises.writeFile(path.join(dir, stored), buffer);

  const relative = path
    .relative(LOCAL_DIR, path.join(dir, stored))
    .split(path.sep)
    .join('/');

  return {
    storage: 'local',
    url: `/uploads/${relative}`,
    publicId: relative,
    bytes: buffer.length,
    format: ext.replace('.', ''),
    resourceType: 'raw',
  };
}

/**
 * Uploads a buffer to Cloudinary when configured, otherwise to local disk.
 * Returns normalized metadata that is safe to persist in MongoDB.
 */
async function uploadBuffer(buffer, { folder = 'platform', resourceType = 'auto', filename } = {}) {
  if (env.cloudinaryConfigured) {
    return uploadToCloudinary(buffer, { folder, resourceType, filename });
  }
  return uploadToLocalDisk(buffer, { folder, filename });
}

async function destroy(publicId, { storage = 'cloudinary', resourceType = 'image' } = {}) {
  if (!publicId) return null;

  if (storage === 'local') {
    try {
      await fs.promises.unlink(path.join(LOCAL_DIR, publicId));
    } catch (err) {
      if (err.code !== 'ENOENT') logger.error('Local file delete failed:', err.message);
    }
    return null;
  }

  if (!env.cloudinaryConfigured) return null;
  try {
    return await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    logger.error('Cloudinary destroy failed:', err.message);
    return null;
  }
}

module.exports = {
  cloudinary,
  uploadBuffer,
  destroy,
  LOCAL_DIR,
  isConfigured: env.cloudinaryConfigured,
};
