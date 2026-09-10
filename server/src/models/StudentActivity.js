const mongoose = require('mongoose');
const { ACTIVITY_TYPE_LIST } = require('../config/constants');

/**
 * Append-only educational event log.
 * Timestamps always come from the server, never from the client.
 */
const studentActivitySchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    activityType: { type: String, enum: ACTIVITY_TYPE_LIST, required: true, index: true },

    module: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', default: null },
    lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', default: null },

    contentId: { type: mongoose.Schema.Types.ObjectId, default: null },
    contentType: {
      type: String,
      enum: ['VIDEO', 'MATERIAL', 'QUIZ', 'EXAM', 'MEETING', 'LESSON', 'MODULE', null],
      default: null,
    },

    // Small, purpose-limited payload: progress %, score, duration. No personal data.
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

studentActivitySchema.index({ student: 1, createdAt: -1 });
studentActivitySchema.index({ activityType: 1, createdAt: -1 });
studentActivitySchema.index({ lesson: 1, activityType: 1 });
studentActivitySchema.index({ module: 1, activityType: 1 });
studentActivitySchema.index({ createdAt: -1 });

module.exports = mongoose.model('StudentActivity', studentActivitySchema);
