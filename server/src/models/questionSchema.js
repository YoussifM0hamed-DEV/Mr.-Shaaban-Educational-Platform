const mongoose = require('mongoose');
const { QUESTION_TYPES } = require('../config/constants');

/**
 * Shared question shape for quizzes and exams.
 * `correctAnswer` is never sent to students - controllers strip it before responding.
 */
const optionSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 500 },
  },
  { _id: true }
);

const questionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: Object.values(QUESTION_TYPES),
      required: true,
      default: QUESTION_TYPES.MCQ,
    },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    options: { type: [optionSchema], default: [] },

    // MCQ -> index of the correct option, TRUE_FALSE -> "true"/"false", SHORT_ANSWER -> accepted text
    correctAnswer: { type: mongoose.Schema.Types.Mixed, default: null },
    acceptedAnswers: { type: [String], default: [] }, // extra accepted spellings for SHORT_ANSWER

    points: { type: Number, default: 1, min: 0, max: 100 },
    explanation: { type: String, trim: true, maxlength: 1000, default: '' },
  },
  { _id: true }
);

module.exports = { questionSchema, optionSchema };
