const {
  Module,
  Lesson,
  Video,
  Material,
  Quiz,
  Exam,
  VideoProgress,
  MaterialAccess,
  QuizAttempt,
  ExamAttempt,
  MeetingAttendance,
  LiveMeeting,
  StudentActivity,
} = require('../models');
const env = require('../config/env');
const { ENGAGEMENT, ATTENDANCE_STATUS } = require('../config/constants');
const accessService = require('./accessService');

/** Relative weight of each component inside a lesson. Missing pieces are ignored. */
const WEIGHTS = { video: 0.5, material: 0.2, quiz: 0.3 };

const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const idStr = (v) => (v ? String(v._id || v) : null);

/**
 * Loads the published curriculum and shapes it as
 * modules -> lessons -> { video, materials, quiz }.
 *
 * Passing a studentId narrows it to the modules that student's groups may open,
 * which is what makes a percentage honest: a Grade 2 student is measured
 * against Grade 2 content only.
 */
async function loadCurriculum({ publishedOnly = true, studentId = null } = {}) {
  const moduleFilter = { isDeleted: false };
  if (studentId) {
    Object.assign(moduleFilter, await accessService.moduleAccessFilter(studentId));
  }
  const lessonFilter = { isDeleted: false };
  if (publishedOnly) {
    moduleFilter.isPublished = true;
    lessonFilter.isPublished = true;
  }

  const modules = await Module.find(moduleFilter).sort({ order: 1, createdAt: 1 }).lean();
  const moduleIds = modules.map((m) => m._id);

  const lessons = await Lesson.find({ ...lessonFilter, module: { $in: moduleIds } })
    .sort({ order: 1, createdAt: 1 })
    .lean();
  const lessonIds = lessons.map((l) => l._id);

  const [videos, materials, quizzes] = await Promise.all([
    Video.find({ lesson: { $in: lessonIds } }).lean(),
    Material.find({ lesson: { $in: lessonIds } }).lean(),
    Quiz.find({
      lesson: { $in: lessonIds },
      isDeleted: false,
      ...(publishedOnly ? { isPublished: true } : {}),
    })
      .select('-questions.correctAnswer -questions.acceptedAnswers')
      .lean(),
  ]);

  const videoByLesson = new Map(videos.map((v) => [idStr(v.lesson), v]));
  const quizByLesson = new Map(quizzes.map((q) => [idStr(q.lesson), q]));
  const materialsByLesson = new Map();
  for (const m of materials) {
    const key = idStr(m.lesson);
    if (!materialsByLesson.has(key)) materialsByLesson.set(key, []);
    materialsByLesson.get(key).push(m);
  }

  const lessonsByModule = new Map();
  for (const l of lessons) {
    const key = idStr(l.module);
    if (!lessonsByModule.has(key)) lessonsByModule.set(key, []);
    lessonsByModule.get(key).push({
      ...l,
      video: videoByLesson.get(idStr(l._id)) || null,
      materials: materialsByLesson.get(idStr(l._id)) || [],
      quiz: quizByLesson.get(idStr(l._id)) || null,
    });
  }

  return {
    modules: modules.map((m) => ({ ...m, lessons: lessonsByModule.get(idStr(m._id)) || [] })),
    lessonIds,
    moduleIds,
    counts: {
      modules: modules.length,
      lessons: lessons.length,
      videos: videos.length,
      materials: materials.length,
      quizzes: quizzes.length,
    },
  };
}

/** Best submitted attempt per quiz/exam, keyed by the assessment id. */
function bestAttemptMap(attempts, key) {
  const map = new Map();
  for (const a of attempts) {
    const k = idStr(a[key]);
    const current = map.get(k);
    if (!current || a.percentage > current.percentage) map.set(k, a);
  }
  return map;
}

/**
 * Full progress tree for one student.
 * Returns overall %, per-module %, and per-lesson video/material/quiz state.
 */
async function getStudentProgress(studentId) {
  // Always loaded per student: two students can have different curricula.
  const data = await loadCurriculum({ studentId });

  const [videoProgress, materialAccess, quizAttempts] = await Promise.all([
    VideoProgress.find({ student: studentId }).lean(),
    MaterialAccess.find({ student: studentId }).lean(),
    QuizAttempt.find({ student: studentId, status: 'SUBMITTED' }).lean(),
  ]);

  const vpByVideo = new Map(videoProgress.map((v) => [idStr(v.video), v]));
  const openedMaterials = new Set(materialAccess.map((m) => idStr(m.material)));
  const bestQuiz = bestAttemptMap(quizAttempts, 'quiz');

  const modules = data.modules.map((mod) => {
    const lessons = mod.lessons.map((lesson) => {
      const parts = [];

      // --- Video ---
      let videoState = null;
      if (lesson.video) {
        const vp = vpByVideo.get(idStr(lesson.video._id));
        videoState = {
          exists: true,
          videoId: idStr(lesson.video._id),
          title: lesson.video.title,
          duration: lesson.video.duration || 0,
          percentage: vp ? vp.percentage : 0,
          completed: vp ? vp.completed : false,
          lastPosition: vp ? vp.lastPosition : 0,
          started: Boolean(vp),
          lastWatchedAt: vp ? vp.lastWatchedAt : null,
        };
        parts.push({ weight: WEIGHTS.video, value: videoState.percentage });
      }

      // --- Materials ---
      let materialState = null;
      if (lesson.materials.length) {
        const opened = lesson.materials.filter((m) => openedMaterials.has(idStr(m._id))).length;
        materialState = {
          exists: true,
          total: lesson.materials.length,
          opened,
          allOpened: opened === lesson.materials.length,
          anyOpened: opened > 0,
        };
        parts.push({ weight: WEIGHTS.material, value: pct(opened, lesson.materials.length) });
      }

      // --- Quiz ---
      let quizState = null;
      if (lesson.quiz) {
        const attempt = bestQuiz.get(idStr(lesson.quiz._id));
        quizState = {
          exists: true,
          quizId: idStr(lesson.quiz._id),
          title: lesson.quiz.title,
          completed: Boolean(attempt),
          score: attempt ? attempt.percentage : null,
          passed: attempt ? attempt.passed : false,
          completedAt: attempt ? attempt.submittedAt : null,
          attempts: quizAttempts.filter((a) => idStr(a.quiz) === idStr(lesson.quiz._id)).length,
        };
        parts.push({ weight: WEIGHTS.quiz, value: attempt ? 100 : 0 });
      }

      const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
      const percentage = totalWeight
        ? Math.round(parts.reduce((s, p) => s + p.weight * p.value, 0) / totalWeight)
        : 0;

      return {
        lessonId: idStr(lesson._id),
        title: lesson.title,
        order: lesson.order,
        percentage,
        completed: percentage >= 100,
        video: videoState,
        material: materialState,
        quiz: quizState,
      };
    });

    const modulePercentage = lessons.length
      ? Math.round(lessons.reduce((s, l) => s + l.percentage, 0) / lessons.length)
      : 0;

    return {
      moduleId: idStr(mod._id),
      title: mod.title,
      order: mod.order,
      color: mod.color,
      lessonCount: lessons.length,
      percentage: modulePercentage,
      completed: modulePercentage >= 100,
      lessons,
    };
  });

  const allLessons = modules.flatMap((m) => m.lessons);
  const overall = allLessons.length
    ? Math.round(allLessons.reduce((s, l) => s + l.percentage, 0) / allLessons.length)
    : 0;

  return {
    overall,
    modules,
    summary: {
      lessonsTotal: allLessons.length,
      lessonsCompleted: allLessons.filter((l) => l.completed).length,
      videosCompleted: allLessons.filter((l) => l.video && l.video.completed).length,
      videosTotal: allLessons.filter((l) => l.video).length,
      materialsOpened: allLessons.filter((l) => l.material && l.material.anyOpened).length,
      materialsTotal: allLessons.filter((l) => l.material).length,
      quizzesCompleted: allLessons.filter((l) => l.quiz && l.quiz.completed).length,
      quizzesTotal: allLessons.filter((l) => l.quiz).length,
    },
  };
}

/**
 * Lightweight per-student roll-up for list views.
 * One pass of aggregations for the whole cohort instead of a query per student.
 */
async function getBulkProgressSummary(studentIds) {
  if (!studentIds.length) return new Map();

  const curriculum = await loadCurriculum();
  // Each student is measured against their own curriculum, so build the content
  // counts per module once and then total them up per student.
  const perModuleCounts = new Map();
  for (const mod of curriculum.modules) {
    perModuleCounts.set(idStr(mod._id), {
      videos: mod.lessons.filter((l) => l.video).length,
      materials: mod.lessons.reduce((s, l) => s + l.materials.length, 0),
      quizzes: mod.lessons.filter((l) => l.quiz).length,
    });
  }

  const accessByModule = await accessService.studentsWithAccess(curriculum.moduleIds);

  const totalsFor = (studentKey) => {
    let videos = 0;
    let materials = 0;
    let quizzes = 0;
    for (const [moduleKey, counts] of perModuleCounts) {
      const allowed = accessByModule.get(moduleKey);
      if (!allowed || !allowed.has(studentKey)) continue;
      videos += counts.videos;
      materials += counts.materials;
      quizzes += counts.quizzes;
    }
    return { videos, materials, quizzes };
  };

  const [videoAgg, materialAgg, quizAgg, examAgg, attendanceAgg] = await Promise.all([
    VideoProgress.aggregate([
      { $match: { student: { $in: studentIds } } },
      {
        $group: {
          _id: '$student',
          avgPercentage: { $avg: '$percentage' },
          completed: { $sum: { $cond: ['$completed', 1, 0] } },
          started: { $sum: 1 },
          sumPercentage: { $sum: '$percentage' },
        },
      },
    ]),
    MaterialAccess.aggregate([
      { $match: { student: { $in: studentIds } } },
      { $group: { _id: '$student', opened: { $sum: 1 } } },
    ]),
    QuizAttempt.aggregate([
      { $match: { student: { $in: studentIds }, status: 'SUBMITTED' } },
      { $group: { _id: { student: '$student', quiz: '$quiz' }, best: { $max: '$percentage' } } },
      {
        $group: {
          _id: '$_id.student',
          quizzesCompleted: { $sum: 1 },
          avgScore: { $avg: '$best' },
        },
      },
    ]),
    ExamAttempt.aggregate([
      { $match: { student: { $in: studentIds }, status: 'SUBMITTED' } },
      { $group: { _id: { student: '$student', exam: '$exam' }, best: { $max: '$percentage' } } },
      {
        $group: { _id: '$_id.student', examsTaken: { $sum: 1 }, avgScore: { $avg: '$best' } },
      },
    ]),
    MeetingAttendance.aggregate([
      { $match: { student: { $in: studentIds }, invited: true } },
      {
        $group: {
          _id: '$student',
          invited: { $sum: 1 },
          attended: {
            $sum: { $cond: [{ $eq: ['$status', ATTENDANCE_STATUS.ATTENDED] }, 1, 0] },
          },
        },
      },
    ]),
  ]);

  const toMap = (rows) => new Map(rows.map((r) => [String(r._id), r]));
  const videoMap = toMap(videoAgg);
  const materialMap = toMap(materialAgg);
  const quizMap = toMap(quizAgg);
  const examMap = toMap(examAgg);
  const attendanceMap = toMap(attendanceAgg);

  const result = new Map();
  for (const sid of studentIds) {
    const key = String(sid);
    const v = videoMap.get(key);
    const m = materialMap.get(key);
    const q = quizMap.get(key);
    const e = examMap.get(key);
    const a = attendanceMap.get(key);

    // This student's own curriculum size, not the whole platform's.
    const {
      videos: totalVideos,
      materials: totalMaterials,
      quizzes: totalQuizzes,
    } = totalsFor(key);

    // Average video progress across the whole curriculum, not only started videos.
    const videoProgress = totalVideos > 0 ? Math.round((v ? v.sumPercentage : 0) / totalVideos) : 0;
    const materialProgress = pct(m ? Math.min(m.opened, totalMaterials) : 0, totalMaterials);
    const quizProgress = pct(q ? q.quizzesCompleted : 0, totalQuizzes);

    const components = [];
    if (totalVideos) components.push({ w: WEIGHTS.video, v: videoProgress });
    if (totalMaterials) components.push({ w: WEIGHTS.material, v: materialProgress });
    if (totalQuizzes) components.push({ w: WEIGHTS.quiz, v: quizProgress });
    const totalW = components.reduce((s, c) => s + c.w, 0);
    const overall = totalW
      ? Math.round(components.reduce((s, c) => s + c.w * c.v, 0) / totalW)
      : 0;

    result.set(key, {
      overall,
      videoProgress,
      videosCompleted: v ? v.completed : 0,
      videosStarted: v ? v.started : 0,
      videosTotal: totalVideos,
      materialsOpened: m ? m.opened : 0,
      materialsTotal: totalMaterials,
      quizzesCompleted: q ? q.quizzesCompleted : 0,
      quizzesTotal: totalQuizzes,
      avgQuizScore: q && q.avgScore != null ? Math.round(q.avgScore) : null,
      examsTaken: e ? e.examsTaken : 0,
      avgExamScore: e && e.avgScore != null ? Math.round(e.avgScore) : null,
      meetingsInvited: a ? a.invited : 0,
      meetingsAttended: a ? a.attended : 0,
    });
  }

  return result;
}

/**
 * ACTIVE / AT_RISK / INACTIVE.
 * INACTIVE  - no tracked activity for INACTIVE_DAYS_THRESHOLD days.
 * AT_RISK   - quiet for a while, or engaging but leaving most work unfinished.
 * ACTIVE    - recent activity and reasonable completion.
 */
function computeEngagement(student, summary) {
  const now = Date.now();
  const last = student.lastActivityAt ? new Date(student.lastActivityAt).getTime() : null;
  const daysSince = last === null ? Infinity : (now - last) / 86400000;

  if (daysSince >= env.INACTIVE_DAYS_THRESHOLD) return ENGAGEMENT.INACTIVE;

  const overall = summary ? summary.overall : 0;
  if (daysSince >= env.AT_RISK_DAYS_THRESHOLD) return ENGAGEMENT.AT_RISK;
  if (overall < 30) return ENGAGEMENT.AT_RISK;

  return ENGAGEMENT.ACTIVE;
}

/** Recent activity feed for a student, newest first. */
async function getActivityTimeline(studentId, { limit = 30, skip = 0 } = {}) {
  const [items, total] = await Promise.all([
    StudentActivity.find({ student: studentId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('module', 'title')
      .populate('lesson', 'title')
      .lean(),
    StudentActivity.countDocuments({ student: studentId }),
  ]);
  return { items, total };
}

/** Exam standing plus live-class attendance for the student detail page. */
async function getStudentAssessmentSummary(studentId) {
  const [exams, attempts, attendance, meetings] = await Promise.all([
    Exam.find({ isDeleted: false, isPublished: true }).select('title module passingGrade').lean(),
    ExamAttempt.find({ student: studentId, status: 'SUBMITTED' }).lean(),
    MeetingAttendance.find({ student: studentId, invited: true }).lean(),
    LiveMeeting.find({ isDeleted: false }).select('title startTime').lean(),
  ]);

  const best = bestAttemptMap(attempts, 'exam');
  const meetingTitles = new Map(meetings.map((m) => [String(m._id), m]));

  return {
    exams: exams.map((ex) => {
      const a = best.get(String(ex._id));
      return {
        examId: String(ex._id),
        title: ex.title,
        taken: Boolean(a),
        score: a ? a.percentage : null,
        passed: a ? a.passed : false,
        submittedAt: a ? a.submittedAt : null,
      };
    }),
    attendance: {
      invited: attendance.length,
      attended: attendance.filter((a) => a.status === ATTENDANCE_STATUS.ATTENDED).length,
      absent: attendance.filter((a) => a.status === ATTENDANCE_STATUS.ABSENT).length,
      records: attendance.map((a) => ({
        meetingId: String(a.meeting),
        title: meetingTitles.get(String(a.meeting))?.title || 'Meeting',
        startTime: meetingTitles.get(String(a.meeting))?.startTime || null,
        status: a.status,
        durationMinutes: Math.round((a.attendanceDuration || 0) / 60),
      })),
    },
  };
}

module.exports = {
  loadCurriculum,
  getStudentProgress,
  getBulkProgressSummary,
  computeEngagement,
  getActivityTimeline,
  getStudentAssessmentSummary,
  WEIGHTS,
};
