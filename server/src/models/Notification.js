const mongoose = require('mongoose');
const { NOTIFICATION_TYPES } = require('../config/constants');

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: Object.values(NOTIFICATION_TYPES), required: true },

    title: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, trim: true, maxlength: 1000, default: '' },
    link: { type: String, trim: true, default: '' },

    // Optional CTA, e.g. { label: 'JOIN MEETING', url: '...' }
    action: {
      label: { type: String, default: '' },
      url: { type: String, default: '' },
    },

    meta: { type: mongoose.Schema.Types.Mixed, default: {} },

    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });
notificationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
