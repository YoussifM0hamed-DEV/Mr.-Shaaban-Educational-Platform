const mongoose = require('mongoose');
const { questionSchema } = require('./questionSchema');

/** Larger assessment attached to a module. */
const examSchema = new mongoose.Schema(
  {
    module: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', required: true, index: true },

    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 4000, default: '' },

    questions: { type: [questionSchema], default: [] },

    passingGrade: { type: Number, default: 50, min: 0, max: 100 },
    timeLimit: { type: Number, default: 60, min: 0 }, // minutes, 0 = no limit
    attemptsAllowed: { type: Number, default: 1, min: 1, max: 5 },
    shuffleQuestions: { type: Boolean, default: true },
    showResultsImmediately: { type: Boolean, default: false },
    showCorrectAnswers: { type: Boolean, default: false },

    availableFrom: { type: Date },
    availableTo: { type: Date },

    isPublished: { type: Boolean, default: false, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

examSchema.virtual('totalPoints').get(function totalPoints() {
  return this.questions.reduce((sum, q) => sum + (q.points || 0), 0);
});

examSchema.virtual('questionCount').get(function questionCount() {
  return this.questions.length;
});

/** UPCOMING / OPEN / CLOSED based on the availability window. */
examSchema.methods.availabilityState = function availabilityState(now = new Date()) {
  if (this.availableFrom && now < this.availableFrom) return 'UPCOMING';
  if (this.availableTo && now > this.availableTo) return 'CLOSED';
  return 'OPEN';
};

module.exports = mongoose.model('Exam', examSchema);
