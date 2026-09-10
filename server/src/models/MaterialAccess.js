const mongoose = require('mongoose');

/** Records that a student actually opened a material, and how often. */
const materialAccessSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    material: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true, index: true },
    lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: true, index: true },
    module: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', required: true, index: true },

    firstOpenedAt: { type: Date, default: Date.now },
    lastOpenedAt: { type: Date, default: Date.now },
    accessCount: { type: Number, default: 1 },
    downloadCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

materialAccessSchema.index({ student: 1, material: 1 }, { unique: true });
materialAccessSchema.index({ lesson: 1, student: 1 });

module.exports = mongoose.model('MaterialAccess', materialAccessSchema);
