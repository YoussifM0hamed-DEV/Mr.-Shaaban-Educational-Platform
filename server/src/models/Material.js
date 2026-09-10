const mongoose = require('mongoose');

const materialSchema = new mongoose.Schema(
  {
    lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: true, index: true },
    module: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', required: true, index: true },

    title: { type: String, trim: true, maxlength: 200, default: '' },
    fileName: { type: String, required: true, trim: true },
    fileUrl: { type: String, required: true },
    publicId: { type: String, default: '' },
    storage: { type: String, enum: ['cloudinary', 'local', 'external'], default: 'cloudinary' },

    fileType: { type: String, default: '' }, // pdf, docx, pptx, png ...
    mimeType: { type: String, default: '' },
    fileSize: { type: Number, default: 0 },

    allowDownload: { type: Boolean, default: true },

    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

materialSchema.index({ lesson: 1, createdAt: -1 });

module.exports = mongoose.model('Material', materialSchema);
