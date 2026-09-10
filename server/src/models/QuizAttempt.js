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

const quizAttemptSchema = new mongoose.Schema(
  {
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true, index: true },
    lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: true, index: true },
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
    expiresAt: { type: Date }, // set when the quiz has a time limit
  },
  { timestamps: true }
);

quizAttemptSchema.index({ student: 1, quiz: 1, attemptNumber: -1 });
quizAttemptSchema.index({ quiz: 1, status: 1 });
quizAttemptSchema.index({ student: 1, status: 1, submittedAt: -1 });

module.exports = mongoose.model('QuizAttempt', quizAttemptSchema);
