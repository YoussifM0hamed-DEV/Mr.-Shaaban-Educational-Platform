const { z } = require('zod');
const { objectId, safeText, url } = require('./common');
const { QUESTION_TYPES } = require('../config/constants');

// ---------- Modules ----------
const createModuleSchema = z.object({
  title: safeText(160).pipe(z.string().min(2, 'Title is too short')),
  description: safeText(2000).optional().default(''),
  order: z.coerce.number().int().min(0).max(9999).optional(),
  color: z.enum(['indigo', 'emerald', 'amber', 'rose', 'sky', 'violet']).optional(),
  /** Empty means every approved student. Otherwise only these groups. */
  groups: z.array(objectId).max(200).optional().default([]),
  isPublished: z.boolean().optional(),
});

const updateModuleSchema = createModuleSchema.partial();

const reorderSchema = z.object({
  items: z.array(z.object({ id: objectId, order: z.coerce.number().int().min(0) })).min(1).max(200),
});

// ---------- Lessons ----------
const createLessonSchema = z.object({
  module: objectId,
  title: safeText(160).pipe(z.string().min(2, 'Title is too short')),
  description: safeText(4000).optional().default(''),
  order: z.coerce.number().int().min(0).max(9999).optional(),
  isPublished: z.boolean().optional(),
});

const updateLessonSchema = createLessonSchema.omit({ module: true }).partial();

// ---------- Videos ----------
// Videos are linked, never uploaded. The controller additionally checks the URL
// is a source whose watch progress can actually be measured.
const attachVideoSchema = z.object({
  title: safeText(200).pipe(z.string().min(2, 'Give the video a title')),
  videoUrl: url,
  duration: z.coerce.number().min(0).max(86400).optional(),
  thumbnailUrl: url.optional().or(z.literal('')),
});

const videoMetaSchema = z.object({
  title: safeText(200).optional(),
  videoUrl: url.optional(),
  duration: z.coerce.number().min(0).max(86400).optional(),
});

// ---------- Video progress ----------
const videoProgressSchema = z.object({
  position: z.coerce.number().min(0).max(86400),
  watchedDelta: z.coerce.number().min(0).max(600).optional().default(0),
  duration: z.coerce.number().min(0).max(86400).optional(),
});

// ---------- Materials ----------
const materialMetaSchema = z.object({
  title: safeText(200).optional(),
  allowDownload: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) => (typeof v === 'string' ? v === 'true' : v)),
});

// ---------- Questions ----------
const questionSchema = z
  .object({
    _id: objectId.optional(),
    type: z.enum([QUESTION_TYPES.MCQ, QUESTION_TYPES.TRUE_FALSE, QUESTION_TYPES.SHORT_ANSWER]),
    text: safeText(2000).pipe(z.string().min(1, 'Question text is required')),
    options: z
      .array(z.object({ _id: objectId.optional(), text: safeText(500).pipe(z.string().min(1)) }))
      .max(10)
      .optional()
      .default([]),
    correctAnswer: z.union([z.string(), z.number(), z.boolean(), z.null()]),
    acceptedAnswers: z.array(safeText(200)).max(10).optional().default([]),
    points: z.coerce.number().min(0).max(100).optional().default(1),
    explanation: safeText(1000).optional().default(''),
  })
  .superRefine((q, ctx) => {
    if (q.type === QUESTION_TYPES.MCQ) {
      if (!q.options || q.options.length < 2) {
        ctx.addIssue({
          code: 'custom',
          path: ['options'],
          message: 'A multiple choice question needs at least 2 options',
        });
      }
      const idx = Number(q.correctAnswer);
      if (!Number.isInteger(idx) || idx < 0 || idx >= (q.options?.length || 0)) {
        ctx.addIssue({
          code: 'custom',
          path: ['correctAnswer'],
          message: 'Select which option is correct',
        });
      }
    }
    if (q.type === QUESTION_TYPES.TRUE_FALSE) {
      const v = String(q.correctAnswer).toLowerCase();
      if (v !== 'true' && v !== 'false') {
        ctx.addIssue({
          code: 'custom',
          path: ['correctAnswer'],
          message: 'Choose True or False',
        });
      }
    }
    if (q.type === QUESTION_TYPES.SHORT_ANSWER) {
      if (!String(q.correctAnswer || '').trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['correctAnswer'],
          message: 'Provide the expected answer',
        });
      }
    }
  });

// ---------- Quizzes ----------
const createQuizSchema = z.object({
  lesson: objectId,
  title: safeText(200).pipe(z.string().min(2)),
  description: safeText(2000).optional().default(''),
  questions: z.array(questionSchema).min(1, 'Add at least one question').max(100),
  passingGrade: z.coerce.number().min(0).max(100).optional().default(50),
  timeLimit: z.coerce.number().min(0).max(600).optional().default(0),
  attemptsAllowed: z.coerce.number().int().min(1).max(20).optional().default(1),
  shuffleQuestions: z.boolean().optional(),
  showResultsImmediately: z.boolean().optional(),
  showCorrectAnswers: z.boolean().optional(),
  isPublished: z.boolean().optional(),
});

const updateQuizSchema = createQuizSchema.omit({ lesson: true }).partial();

// ---------- Exams ----------
const createExamSchema = z.object({
  module: objectId,
  title: safeText(200).pipe(z.string().min(2)),
  description: safeText(4000).optional().default(''),
  questions: z.array(questionSchema).min(1, 'Add at least one question').max(200),
  passingGrade: z.coerce.number().min(0).max(100).optional().default(50),
  timeLimit: z.coerce.number().min(0).max(600).optional().default(60),
  attemptsAllowed: z.coerce.number().int().min(1).max(5).optional().default(1),
  shuffleQuestions: z.boolean().optional(),
  showResultsImmediately: z.boolean().optional(),
  showCorrectAnswers: z.boolean().optional(),
  availableFrom: z.coerce.date().optional().nullable(),
  availableTo: z.coerce.date().optional().nullable(),
  isPublished: z.boolean().optional(),
});

const updateExamSchema = createExamSchema.omit({ module: true }).partial();

// ---------- Attempt submission ----------
const submitAttemptSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: objectId,
        answer: z.union([z.string().max(2000), z.number(), z.boolean(), z.null()]),
      })
    )
    .max(200),
});

// ---------- Announcements ----------
const announcementSchema = z.object({
  title: safeText(200).pipe(z.string().min(2)),
  body: safeText(5000).pipe(z.string().min(2)),
  /** Empty means every approved student. */
  groups: z.array(objectId).max(200).optional().default([]),
  pinned: z.boolean().optional(),
  isPublished: z.boolean().optional(),
});

module.exports = {
  createModuleSchema,
  updateModuleSchema,
  reorderSchema,
  createLessonSchema,
  updateLessonSchema,
  attachVideoSchema,
  videoMetaSchema,
  videoProgressSchema,
  materialMetaSchema,
  questionSchema,
  createQuizSchema,
  updateQuizSchema,
  createExamSchema,
  updateExamSchema,
  submitAttemptSchema,
  announcementSchema,
};
