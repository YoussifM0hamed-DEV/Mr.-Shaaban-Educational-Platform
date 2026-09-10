const mongoose = require('mongoose');

/**
 * A named set of students, the way a teacher actually thinks about their week:
 * "Grade 3 Group A", "Saturday 5pm", "Revision group".
 *
 * Groups drive two things: which modules a student can open, and who gets
 * invited to a live class. A student can belong to more than one group.
 */
const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    color: { type: String, default: 'indigo' },

    students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

groupSchema.index({ isDeleted: 1, name: 1 });

groupSchema.virtual('studentCount').get(function studentCount() {
  return this.students ? this.students.length : 0;
});

module.exports = mongoose.model('Group', groupSchema);
