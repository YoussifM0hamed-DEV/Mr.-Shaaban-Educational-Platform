const { QUESTION_TYPES } = require('../config/constants');

const normalize = (v) =>
  String(v ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,!?;:]+$/g, '');

/** Compares one submitted answer against the stored key. */
function isAnswerCorrect(question, submitted) {
  if (submitted === null || submitted === undefined || submitted === '') return false;

  switch (question.type) {
    case QUESTION_TYPES.MCQ: {
      // Accept either an option _id or the option index.
      const key = question.correctAnswer;
      const given = String(submitted);

      if (question.options.length) {
        const byId = question.options.find((o) => String(o._id) === given);
        if (byId) {
          const idx = question.options.findIndex((o) => String(o._id) === given);
          return String(key) === String(idx) || String(key) === String(byId._id);
        }
      }
      return String(key) === given;
    }

    case QUESTION_TYPES.TRUE_FALSE:
      return normalize(question.correctAnswer) === normalize(submitted);

    case QUESTION_TYPES.SHORT_ANSWER: {
      const accepted = [question.correctAnswer, ...(question.acceptedAnswers || [])]
        .filter((a) => a !== null && a !== undefined && a !== '')
        .map(normalize);
      return accepted.includes(normalize(submitted));
    }

    default:
      return false;
  }
}

/**
 * Grades a full submission against an assessment document.
 * Runs entirely on the server - the client never sees or supplies the answer key.
 */
function gradeSubmission(assessment, submittedAnswers = []) {
  const byId = new Map(submittedAnswers.map((a) => [String(a.questionId), a.answer]));

  let score = 0;
  let totalPoints = 0;

  const answers = assessment.questions.map((question) => {
    const points = question.points || 0;
    totalPoints += points;

    const submitted = byId.has(String(question._id)) ? byId.get(String(question._id)) : null;
    const correct = isAnswerCorrect(question, submitted);
    const awarded = correct ? points : 0;
    score += awarded;

    return {
      questionId: question._id,
      answer: submitted,
      isCorrect: correct,
      pointsAwarded: awarded,
    };
  });

  const percentage = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;

  return {
    answers,
    score,
    totalPoints,
    percentage,
    passed: percentage >= (assessment.passingGrade || 0),
  };
}

/** Strips the answer key before an assessment is sent to a student. */
function sanitizeForStudent(assessment) {
  const plain = assessment.toObject ? assessment.toObject() : { ...assessment };
  plain.questions = (plain.questions || []).map((q) => ({
    _id: q._id,
    type: q.type,
    text: q.text,
    points: q.points,
    options: (q.options || []).map((o) => ({ _id: o._id, text: o.text })),
  }));
  return plain;
}

/** Adds the key back after submission when the teacher enabled answer review. */
function buildReview(assessment, attempt) {
  const answerByQuestion = new Map(attempt.answers.map((a) => [String(a.questionId), a]));
  return assessment.questions.map((q) => {
    const a = answerByQuestion.get(String(q._id));
    return {
      questionId: q._id,
      text: q.text,
      type: q.type,
      options: (q.options || []).map((o) => ({ _id: o._id, text: o.text })),
      points: q.points,
      yourAnswer: a ? a.answer : null,
      isCorrect: a ? a.isCorrect : false,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation || '',
    };
  });
}

module.exports = { gradeSubmission, isAnswerCorrect, sanitizeForStudent, buildReview };
