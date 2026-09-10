/**
 * Seeds the platform with its single teacher and, optionally, a realistic demo cohort.
 *
 *   npm run seed            -> teacher account only (safe for production first-run)
 *   npm run seed -- --demo  -> teacher + assistant + students + curriculum + activity
 *   npm run seed -- --demo --reset  -> wipes the collections first
 */
const mongoose = require('mongoose');
const env = require('../config/env');
const logger = require('./logger');
const { connectDB } = require('../config/db');
const {
  User,
  Module,
  Lesson,
  Video,
  Material,
  Quiz,
  QuizAttempt,
  Exam,
  ExamAttempt,
  VideoProgress,
  MaterialAccess,
  StudentActivity,
  LiveMeeting,
  MeetingAttendance,
  Notification,
  Announcement,
} = require('../models');
const {
  ROLES,
  ACCOUNT_STATUS,
  PERMISSIONS,
  ACTIVITY_TYPES,
  QUESTION_TYPES,
  MEETING_STATUS,
  MEETING_PROVIDERS,
  ATTENDANCE_STATUS,
} = require('../config/constants');

const args = process.argv.slice(2);
const WITH_DEMO = args.includes('--demo');
const RESET = args.includes('--reset');

const daysAgo = (n) => new Date(Date.now() - n * 86400000);
const hoursFromNow = (n) => new Date(Date.now() + n * 3600000);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function ensureTeacher() {
  let teacher = await User.findOne({ role: ROLES.TEACHER });
  if (teacher) {
    logger.info(`Teacher already exists: ${teacher.email}`);
    return teacher;
  }

  if (!env.TEACHER_EMAIL || !env.TEACHER_PASSWORD) {
    logger.error(
      'Cannot create the teacher account: set TEACHER_EMAIL and TEACHER_PASSWORD in the environment first.'
    );
    logger.error('Pick a password you have not used anywhere else. It is the owner of the platform.');
    process.exit(1);
  }

  teacher = await User.create({
    name: env.TEACHER_NAME,
    email: env.TEACHER_EMAIL,
    password: env.TEACHER_PASSWORD,
    phone: '+20 100 000 0000',
    role: ROLES.TEACHER,
    status: ACCOUNT_STATUS.APPROVED,
  });

  logger.info(`Teacher created: ${teacher.email}`);
  return teacher;
}

async function reset() {
  logger.warn('Resetting all collections');
  await Promise.all([
    User.deleteMany({}),
    Module.deleteMany({}),
    Lesson.deleteMany({}),
    Video.deleteMany({}),
    Material.deleteMany({}),
    Quiz.deleteMany({}),
    QuizAttempt.deleteMany({}),
    Exam.deleteMany({}),
    ExamAttempt.deleteMany({}),
    VideoProgress.deleteMany({}),
    MaterialAccess.deleteMany({}),
    StudentActivity.deleteMany({}),
    LiveMeeting.deleteMany({}),
    MeetingAttendance.deleteMany({}),
    Notification.deleteMany({}),
    Announcement.deleteMany({}),
  ]);
}

const STUDENT_NAMES = [
  'Ahmed Mohamed',
  'Omar Ali',
  'Youssef Mohamed',
  'Ali Hassan',
  'Mariam Khaled',
  'Nour Ibrahim',
  'Hana Samir',
  'Mostafa Adel',
  'Salma Tarek',
  'Kareem Fouad',
  'Laila Hesham',
  'Ziad Mahmoud',
];

// Both supported sources appear in the demo so the two players can be seen working.
const SAMPLE_DIRECT_VIDEO =
  'https://res.cloudinary.com/demo/video/upload/v1690000000/samples/sea-turtle.mp4';
const SAMPLE_YOUTUBE_VIDEO = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';

async function seedDemo(teacher) {
  // ---------- Assistant ----------
  const assistant = await User.create({
    name: 'Fatma Assistant',
    email: 'assistant@shaaban.edu',
    password: 'Assistant123',
    phone: '+20 100 111 2222',
    role: ROLES.ASSISTANT,
    status: ACCOUNT_STATUS.APPROVED,
    permissions: [
      PERMISSIONS.VIEW_STUDENTS,
      PERMISSIONS.VIEW_STUDENT_ACTIVITY,
      PERMISSIONS.UPLOAD_MATERIALS,
      PERMISSIONS.REVIEW_RESULTS,
      PERMISSIONS.VIEW_ATTENDANCE,
    ],
    reviewedBy: teacher._id,
    reviewedAt: new Date(),
  });

  // ---------- Students ----------
  const students = [];
  for (let i = 0; i < STUDENT_NAMES.length; i += 1) {
    const name = STUDENT_NAMES[i];
    const slug = name.toLowerCase().replace(/\s+/g, '.');
    // The last three stay pending so the approval queue is not empty.
    const pending = i >= STUDENT_NAMES.length - 3;

    students.push(
      await User.create({
        name,
        email: `${slug}@student.com`,
        password: 'Student123',
        phone: `+20 11${String(i).padStart(2, '0')} 555 ${String(1000 + i)}`,
        role: ROLES.STUDENT,
        status: pending ? ACCOUNT_STATUS.PENDING : ACCOUNT_STATUS.APPROVED,
        studentInfo: {
          grade: pick(['Grade 10', 'Grade 11', 'Grade 12']),
          school: pick(['Al Nahda School', 'Future Language School', 'Cairo International']),
          parentPhone: `+20 12${String(i).padStart(2, '0')} 777 ${String(2000 + i)}`,
        },
        reviewedBy: pending ? undefined : teacher._id,
        reviewedAt: pending ? undefined : daysAgo(20 - i),
        lastLoginAt: pending ? undefined : daysAgo(i % 9),
        lastActivityAt: pending ? undefined : daysAgo(i % 9),
      })
    );
  }

  const approved = students.filter((s) => s.status === ACCOUNT_STATUS.APPROVED);

  // ---------- Curriculum ----------
  const moduleSpecs = [
    {
      title: 'Module 1 - Arabic Grammar Foundations',
      description: 'Sentence structure, word types and the building blocks of correct Arabic.',
      color: 'indigo',
      lessons: [
        'Lesson 1 - Types of Words',
        'Lesson 2 - The Nominal Sentence',
        'Lesson 3 - The Verbal Sentence',
      ],
    },
    {
      title: 'Module 2 - Grammar in Practice',
      description: 'Applying the rules to real texts, with plenty of worked examples.',
      color: 'emerald',
      lessons: ['Lesson 1 - Cases of the Noun', 'Lesson 2 - Verb Tenses'],
    },
    {
      title: 'Module 3 - Rhetoric and Style',
      description: 'Metaphor, simile and the figures of speech that make writing persuasive.',
      color: 'amber',
      lessons: ['Lesson 1 - Simile', 'Lesson 2 - Metaphor'],
    },
  ];

  const createdModules = [];
  for (let mi = 0; mi < moduleSpecs.length; mi += 1) {
    const spec = moduleSpecs[mi];
    const module = await Module.create({
      title: spec.title,
      description: spec.description,
      color: spec.color,
      order: mi,
      isPublished: true,
      createdBy: teacher._id,
    });

    const lessons = [];
    for (let li = 0; li < spec.lessons.length; li += 1) {
      const lesson = await Lesson.create({
        module: module._id,
        title: spec.lessons[li],
        description:
          'Watch the video, read the material, then complete the quiz to finish this lesson.',
        order: li,
        isPublished: true,
        createdBy: teacher._id,
      });

      // The first lesson of each module uses YouTube, the rest a direct file,
      // so both players can be seen working in the demo.
      const useYouTube = li === 0;
      const video = await Video.create({
        lesson: lesson._id,
        module: module._id,
        title: `${spec.lessons[li]} - video`,
        videoUrl: useYouTube ? SAMPLE_YOUTUBE_VIDEO : SAMPLE_DIRECT_VIDEO,
        provider: useYouTube ? 'YOUTUBE' : 'DIRECT',
        externalId: useYouTube ? 'jNQXAC9IVRw' : '',
        duration: useYouTube ? 19 : 600 + li * 120,
        addedBy: teacher._id,
      });

      const material = await Material.create({
        lesson: lesson._id,
        module: module._id,
        title: `${spec.lessons[li]} - notes`,
        fileName: `lesson-${mi + 1}-${li + 1}-notes.pdf`,
        fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        storage: 'external',
        fileType: 'pdf',
        mimeType: 'application/pdf',
        fileSize: 245000 + li * 10000,
        uploadedBy: teacher._id,
      });

      const quiz = await Quiz.create({
        lesson: lesson._id,
        module: module._id,
        title: `${spec.lessons[li]} - quiz`,
        description: 'A short check that you understood this lesson.',
        passingGrade: 60,
        timeLimit: 10,
        attemptsAllowed: 2,
        showResultsImmediately: true,
        showCorrectAnswers: true,
        isPublished: true,
        createdBy: teacher._id,
        questions: [
          {
            type: QUESTION_TYPES.MCQ,
            text: 'Which of these is a noun?',
            options: [{ text: 'Wrote' }, { text: 'Book' }, { text: 'Quickly' }, { text: 'And' }],
            correctAnswer: '1',
            points: 2,
            explanation: 'A noun names a person, place or thing.',
          },
          {
            type: QUESTION_TYPES.TRUE_FALSE,
            text: 'A nominal sentence begins with a noun.',
            correctAnswer: 'true',
            points: 1,
          },
          {
            type: QUESTION_TYPES.SHORT_ANSWER,
            text: 'What is the subject of a nominal sentence called?',
            correctAnswer: 'mubtada',
            acceptedAnswers: ['al-mubtada', 'the mubtada'],
            points: 2,
          },
        ],
      });

      lessons.push({ lesson, video, material, quiz });
    }

    createdModules.push({ module, lessons });
  }

  // ---------- Exam ----------
  const exam = await Exam.create({
    module: createdModules[0].module._id,
    title: 'Mid-term Exam - Arabic Grammar',
    description: 'Covers everything in Module 1 and Module 2.',
    passingGrade: 60,
    timeLimit: 45,
    attemptsAllowed: 1,
    showResultsImmediately: true,
    isPublished: true,
    createdBy: teacher._id,
    availableFrom: daysAgo(3),
    availableTo: hoursFromNow(24 * 10),
    questions: [
      {
        type: QUESTION_TYPES.MCQ,
        text: 'Which case ending marks the subject of a nominal sentence?',
        options: [{ text: 'Damma' }, { text: 'Fatha' }, { text: 'Kasra' }, { text: 'Sukun' }],
        correctAnswer: '0',
        points: 5,
      },
      {
        type: QUESTION_TYPES.TRUE_FALSE,
        text: 'A verbal sentence always begins with a verb.',
        correctAnswer: 'true',
        points: 5,
      },
      {
        type: QUESTION_TYPES.MCQ,
        text: 'A simile compares two things using which word?',
        options: [{ text: 'Because' }, { text: 'Like' }, { text: 'Although' }, { text: 'After' }],
        correctAnswer: '1',
        points: 5,
      },
    ],
  });

  // ---------- Student engagement ----------
  const allLessons = createdModules.flatMap((m) => m.lessons);

  for (let si = 0; si < approved.length; si += 1) {
    const student = approved[si];
    // Engagement decreases down the list so the dashboard shows a real spread.
    const effort = 1 - si / approved.length;
    const lessonsTouched = Math.max(0, Math.round(allLessons.length * effort));

    for (let li = 0; li < lessonsTouched; li += 1) {
      const { lesson, video, material, quiz } = allLessons[li];
      const isFullyDone = li < lessonsTouched - 1;
      const percentage = isFullyDone ? 100 : Math.round(20 + Math.random() * 60);
      const watched = Math.round((video.duration * percentage) / 100);

      await VideoProgress.create({
        student: student._id,
        video: video._id,
        lesson: lesson._id,
        module: lesson.module,
        duration: video.duration,
        watchedSeconds: watched,
        lastPosition: watched,
        percentage,
        completed: percentage >= env.VIDEO_COMPLETION_THRESHOLD,
        completedAt: percentage >= env.VIDEO_COMPLETION_THRESHOLD ? daysAgo(li) : undefined,
        startedAt: daysAgo(li + 2),
        lastWatchedAt: daysAgo(li),
      });

      await StudentActivity.create({
        student: student._id,
        activityType: ACTIVITY_TYPES.VIDEO_STARTED,
        module: lesson.module,
        lesson: lesson._id,
        contentId: video._id,
        contentType: 'VIDEO',
        createdAt: daysAgo(li + 2),
      });

      if (isFullyDone) {
        await MaterialAccess.create({
          student: student._id,
          material: material._id,
          lesson: lesson._id,
          module: lesson.module,
          firstOpenedAt: daysAgo(li + 1),
          lastOpenedAt: daysAgo(li),
          accessCount: 1 + Math.floor(Math.random() * 3),
        });

        await StudentActivity.create({
          student: student._id,
          activityType: ACTIVITY_TYPES.MATERIAL_OPENED,
          module: lesson.module,
          lesson: lesson._id,
          contentId: material._id,
          contentType: 'MATERIAL',
          createdAt: daysAgo(li + 1),
        });

        const score = Math.round(50 + Math.random() * 50);
        await QuizAttempt.create({
          quiz: quiz._id,
          lesson: lesson._id,
          module: lesson.module,
          student: student._id,
          attemptNumber: 1,
          status: 'SUBMITTED',
          score: Math.round((score / 100) * 5),
          totalPoints: 5,
          percentage: score,
          passed: score >= quiz.passingGrade,
          startedAt: daysAgo(li),
          submittedAt: daysAgo(li),
          answers: quiz.questions.map((q) => ({
            questionId: q._id,
            answer: String(q.correctAnswer),
            isCorrect: true,
            pointsAwarded: q.points,
          })),
        });

        await StudentActivity.create({
          student: student._id,
          activityType: ACTIVITY_TYPES.QUIZ_COMPLETED,
          module: lesson.module,
          lesson: lesson._id,
          contentId: quiz._id,
          contentType: 'QUIZ',
          metadata: { score },
          createdAt: daysAgo(li),
        });
      }
    }

    // Roughly half of the cohort has sat the exam.
    if (si % 2 === 0) {
      const score = Math.round(45 + Math.random() * 55);
      await ExamAttempt.create({
        exam: exam._id,
        module: exam.module,
        student: student._id,
        attemptNumber: 1,
        status: 'SUBMITTED',
        score: Math.round((score / 100) * 15),
        totalPoints: 15,
        percentage: score,
        passed: score >= exam.passingGrade,
        startedAt: daysAgo(2),
        submittedAt: daysAgo(2),
        answers: [],
      });

      await StudentActivity.create({
        student: student._id,
        activityType: ACTIVITY_TYPES.EXAM_COMPLETED,
        module: exam.module,
        contentId: exam._id,
        contentType: 'EXAM',
        metadata: { score },
        createdAt: daysAgo(2),
      });
    }
  }

  // ---------- Live meetings ----------
  const meetingSpecs = [
    {
      title: 'Arabic Grammar - Live Revision',
      start: hoursFromNow(26),
      end: hoursFromNow(27.5),
      status: MEETING_STATUS.UPCOMING,
      module: createdModules[0].module._id,
    },
    {
      title: 'Rhetoric Workshop - LIVE',
      start: new Date(Date.now() - 15 * 60000),
      end: hoursFromNow(1),
      status: MEETING_STATUS.LIVE,
      module: createdModules[2].module._id,
    },
    {
      title: 'Module 1 Recap',
      start: daysAgo(5),
      end: new Date(daysAgo(5).getTime() + 5400000),
      status: MEETING_STATUS.ENDED,
      module: createdModules[0].module._id,
    },
    {
      title: 'Exam Preparation Session',
      start: daysAgo(12),
      end: new Date(daysAgo(12).getTime() + 5400000),
      status: MEETING_STATUS.ENDED,
      module: createdModules[1].module._id,
    },
  ];

  for (const spec of meetingSpecs) {
    const meeting = await LiveMeeting.create({
      title: spec.title,
      description: 'Bring your notes and your questions.',
      provider: MEETING_PROVIDERS.ZOOM,
      meetingUrl: 'https://zoom.us/j/1234567890',
      externalMeetingId: '123 4567 890',
      meetingPassword: 'arabic',
      module: spec.module,
      startTime: spec.start,
      endTime: spec.end,
      status: spec.status,
      attendees: approved.map((s) => s._id),
      invitedAll: true,
      notifiedSoon: spec.status !== MEETING_STATUS.UPCOMING,
      notifiedLive: spec.status !== MEETING_STATUS.UPCOMING,
      createdBy: teacher._id,
    });

    const durationSeconds = (spec.end - spec.start) / 1000;

    for (let i = 0; i < approved.length; i += 1) {
      const ended = spec.status === MEETING_STATUS.ENDED;
      const attended = ended && i % 5 !== 0;

      await MeetingAttendance.create({
        meeting: meeting._id,
        student: approved[i]._id,
        invited: true,
        joined: attended,
        joinTime: attended ? spec.start : undefined,
        leaveTime: attended ? spec.end : undefined,
        attendanceDuration: attended ? Math.round(durationSeconds * (0.6 + Math.random() * 0.4)) : 0,
        status: ended
          ? attended
            ? ATTENDANCE_STATUS.ATTENDED
            : ATTENDANCE_STATUS.ABSENT
          : ATTENDANCE_STATUS.INVITED,
      });

      if (attended) {
        await StudentActivity.create({
          student: approved[i]._id,
          activityType: ACTIVITY_TYPES.LIVE_MEETING_JOINED,
          module: spec.module,
          contentId: meeting._id,
          contentType: 'MEETING',
          createdAt: spec.start,
        });
      }
    }
  }

  // ---------- Announcements ----------
  await Announcement.create([
    {
      title: 'Live class tomorrow at 7 PM',
      body: 'We will revise the whole of Module 1 before the mid-term exam. Please come prepared with your questions.',
      pinned: true,
      isPublished: true,
      createdBy: teacher._id,
    },
    {
      title: 'Mid-term exam is now open',
      body: 'The mid-term exam is available for the next ten days. You have one attempt, so choose a quiet time.',
      isPublished: true,
      createdBy: teacher._id,
    },
  ]);

  logger.info('Demo data created');
  logger.info('---------------------------------------------');
  logger.info(`Teacher:   ${teacher.email} / ${env.TEACHER_PASSWORD}`);
  logger.info(`Assistant: ${assistant.email} / Assistant123`);
  logger.info(`Student:   ${approved[0].email} / Student123`);
  logger.info('---------------------------------------------');
}

async function run() {
  await connectDB();
  if (RESET) await reset();

  const teacher = await ensureTeacher();

  if (WITH_DEMO) {
    const studentCount = await User.countDocuments({ role: ROLES.STUDENT });
    if (studentCount > 0 && !RESET) {
      logger.warn('Students already exist - skipping demo seed. Use --reset to rebuild.');
    } else {
      await seedDemo(teacher);
    }
  }

  await mongoose.connection.close();
  logger.info('Seed complete');
  process.exit(0);
}

run().catch((err) => {
  logger.error('Seed failed:', err);
  process.exit(1);
});
