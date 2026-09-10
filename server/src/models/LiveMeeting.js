const mongoose = require('mongoose');
const { MEETING_STATUS, MEETING_PROVIDERS } = require('../config/constants');

/** Provider-agnostic live class. Any provider that yields a join URL works. */
const liveMeetingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },

    provider: {
      type: String,
      enum: Object.values(MEETING_PROVIDERS),
      default: MEETING_PROVIDERS.ZOOM,
    },
    meetingUrl: { type: String, required: true, trim: true },
    externalMeetingId: { type: String, trim: true, default: '' },
    meetingPassword: { type: String, trim: true, default: '' },

    module: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', default: null, index: true },
    lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', default: null },

    startTime: { type: Date, required: true, index: true },
    endTime: { type: Date, required: true },

    status: {
      type: String,
      enum: Object.values(MEETING_STATUS),
      default: MEETING_STATUS.UPCOMING,
      index: true,
    },
    cancelledReason: { type: String, trim: true, maxlength: 300, default: '' },

    /**
     * Explicit invite list. A student not in here can never reach the join URL.
     * When groups are chosen, this is the flattened membership at save time, so
     * the guest list of a past class stays exactly as it was on the day.
     */
    attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],
    /** The groups the teacher picked, kept so the form can show them again. */
    groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
    invitedAll: { type: Boolean, default: false },

    isPublished: { type: Boolean, default: true },
    notifiedSoon: { type: Boolean, default: false },
    notifiedLive: { type: Boolean, default: false },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

liveMeetingSchema.index({ startTime: -1, status: 1 });
liveMeetingSchema.index({ attendees: 1, startTime: -1 });

/** Derives the live/upcoming/ended state from the clock, unless cancelled. */
liveMeetingSchema.methods.computeStatus = function computeStatus(now = new Date()) {
  if (this.status === MEETING_STATUS.CANCELLED) return MEETING_STATUS.CANCELLED;
  if (now < this.startTime) return MEETING_STATUS.UPCOMING;
  if (now > this.endTime) return MEETING_STATUS.ENDED;
  return MEETING_STATUS.LIVE;
};

liveMeetingSchema.virtual('durationMinutes').get(function durationMinutes() {
  if (!this.startTime || !this.endTime) return 0;
  return Math.max(0, Math.round((this.endTime - this.startTime) / 60000));
});

module.exports = mongoose.model('LiveMeeting', liveMeetingSchema);
