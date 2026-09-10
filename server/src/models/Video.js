const mongoose = require('mongoose');
const { VIDEO_PROVIDERS } = require('../utils/videoSource');

/**
 * One video per lesson.
 *
 * Videos are not uploaded to this platform. The teacher hosts them on YouTube or
 * any host that serves a direct video file, and only the link plus metadata is
 * stored here. That keeps storage costs off the platform while watch tracking
 * still works, because both sources expose a real playback position.
 */
const videoSchema = new mongoose.Schema(
  {
    lesson: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lesson',
      required: true,
      unique: true,
      index: true,
    },
    module: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', required: true, index: true },

    title: { type: String, required: true, trim: true, maxlength: 200 },
    videoUrl: { type: String, required: true },

    provider: {
      type: String,
      enum: Object.values(VIDEO_PROVIDERS),
      default: VIDEO_PROVIDERS.DIRECT,
    },
    // YouTube video id. Empty for a direct file link.
    externalId: { type: String, default: '' },

    thumbnailUrl: { type: String, default: '' },

    duration: { type: Number, default: 0 }, // seconds
    format: { type: String, default: '' },

    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    addedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Video', videoSchema);
