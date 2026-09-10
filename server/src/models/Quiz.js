const mongoose = require('mongoose');
const { questionSchema } = require('./questionSchema');

/** One quiz per lesson. */
const quizSchema = new mongoose.Schema(
  {
    lesson: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lesson',
      required: true,
      unique: true,
      index: true,
    },
    module: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', required: true, index: true },

    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },

    questions: { type: [questionSchema], default: [] },

    passingGrade: { type: Number, default: 50, min: 0, max: 100 },
    timeLimit: { type: Number, default: 0, min: 0 }, // minutes, 0 = no limit
    attemptsAllowed: { type: Number, default: 1, min: 1, max: 20 },
    shuffleQuestions: { type: Boolean, default: false },
    showResultsImmediately: { type: Boolean, default: true },
    showCorrectAnswers: { type: Boolean, default: false },

    isPublished: { type: Boolean, default: false, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

quizSchema.virtual('totalPoints').get(function totalPoints() {
  return this.questions.reduce((sum, q) => sum + (q.points || 0), 0);
});

quizSchema.virtual('questionCount').get(function questionCount() {
  return this.questions.length;
});

module.exports = mongoose.model('Quiz', quizSchema);
