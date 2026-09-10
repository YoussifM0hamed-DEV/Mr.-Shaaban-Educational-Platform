const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema(
  {
    module: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Module',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 4000, default: '' },
    order: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: false, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

lessonSchema.index({ module: 1, order: 1 });
lessonSchema.index({ isDeleted: 1, isPublished: 1 });

lessonSchema.virtual('video', {
  ref: 'Video',
  localField: '_id',
  foreignField: 'lesson',
  justOne: true,
});

lessonSchema.virtual('materials', {
  ref: 'Material',
  localField: '_id',
  foreignField: 'lesson',
});

lessonSchema.virtual('quiz', {
  ref: 'Quiz',
  localField: '_id',
  foreignField: 'lesson',
  justOne: true,
});

module.exports = mongoose.model('Lesson', lessonSchema);
