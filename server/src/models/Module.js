const mongoose = require('mongoose');

const moduleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    order: { type: Number, default: 0, index: true },
    coverImage: {
      url: String,
      publicId: String,
      storage: { type: String, default: 'cloudinary' },
    },
    color: { type: String, default: 'indigo' },

    /**
     * Which groups may open this module. An empty list means every approved
     * student, which keeps a single-group platform simple. Lessons, videos,
     * materials, quizzes and the module exam all inherit this rule.
     */
    groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group', index: true }],

    isPublished: { type: Boolean, default: false, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

moduleSchema.index({ isDeleted: 1, isPublished: 1, order: 1 });

moduleSchema.virtual('lessons', {
  ref: 'Lesson',
  localField: '_id',
  foreignField: 'module',
});

module.exports = mongoose.model('Module', moduleSchema);
