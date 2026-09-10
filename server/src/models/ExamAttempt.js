const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema(
  {
    questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
    answer: { type: mongoose.Schema.Types.Mixed, default: null },
    isCorrect: { type: Boolean, default: false },
    pointsAwarded: { type: Number, default: 0 },
  },
  { _id: false }
);

const examAttemptSchema = new mongoose.Schema(
  {
    exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
    module: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', required: true, index: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    attemptNumber: { type: Number, default: 1 },
    status: {
      type: String,
      enum: ['IN_PROGRESS', 'SUBMITTED', 'EXPIRED'],
      default: 'IN_PROGRESS',
      index: true,
    },

    answers: { type: [answerSchema], default: [] },

    score: { type: Number, default: 0 },
    totalPoints: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    passed: { type: Boolean, default: false },

    startedAt: { type: Date, default: Date.now },
    submittedAt: { type: Date },
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

examAttemptSchema.index({ student: 1, exam: 1, attemptNumber: -1 });
examAttemptSchema.index({ exam: 1, status: 1 });

module.exports = mongoose.model('ExamAttempt', examAttemptSchema);
