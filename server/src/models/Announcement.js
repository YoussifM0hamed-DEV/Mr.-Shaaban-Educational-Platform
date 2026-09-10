const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, required: true, trim: true, maxlength: 5000 },
    /** Empty means every approved student. Otherwise only these groups. */
    groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group', index: true }],

    pinned: { type: Boolean, default: false },
    isPublished: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

announcementSchema.index({ isDeleted: 1, isPublished: 1, pinned: -1, createdAt: -1 });

module.exports = mongoose.model('Announcement', announcementSchema);
