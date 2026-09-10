const mongoose = require('mongoose');
const { ATTENDANCE_STATUS } = require('../config/constants');

const meetingAttendanceSchema = new mongoose.Schema(
  {
    meeting: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LiveMeeting',
      required: true,
      index: true,
    },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    invited: { type: Boolean, default: true },
    joined: { type: Boolean, default: false },

    joinTime: { type: Date },
    leaveTime: { type: Date },
    attendanceDuration: { type: Number, default: 0 }, // seconds, accumulated across sessions

    status: {
      type: String,
      enum: Object.values(ATTENDANCE_STATUS),
      default: ATTENDANCE_STATUS.INVITED,
      index: true,
    },
  },
  { timestamps: true }
);

meetingAttendanceSchema.index({ meeting: 1, student: 1 }, { unique: true });
meetingAttendanceSchema.index({ student: 1, status: 1 });

module.exports = mongoose.model('MeetingAttendance', meetingAttendanceSchema);
