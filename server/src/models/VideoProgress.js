const mongoose = require('mongoose');

/**
 * Per-student watch state for a video.
 * `watchedSeconds` counts unique seconds actually watched, so seeking to the end
 * does not mark a video complete.
 */
const videoProgressSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    video: { type: mongoose.Schema.Types.ObjectId, ref: 'Video', required: true, index: true },
    lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: true, index: true },
    module: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', required: true, index: true },

    lastPosition: { type: Number, default: 0 }, // seconds - used to resume
    watchedSeconds: { type: Number, default: 0 },
    duration: { type: Number, default: 0 },
    percentage: { type: Number, default: 0, min: 0, max: 100 },

    completed: { type: Boolean, default: false, index: true },
    completedAt: { type: Date },

    startedAt: { type: Date, default: Date.now },
    lastWatchedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

videoProgressSchema.index({ student: 1, video: 1 }, { unique: true });
videoProgressSchema.index({ lesson: 1, completed: 1 });
videoProgressSchema.index({ student: 1, module: 1 });

module.exports = mongoose.model('VideoProgress', videoProgressSchema);
