export const ROLES = {
  TEACHER: 'TEACHER',
  ASSISTANT: 'ASSISTANT',
  STUDENT: 'STUDENT',
};

export const ACCOUNT_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  DISABLED: 'DISABLED',
};

export const PERMISSIONS = {
  VIEW_STUDENTS: 'VIEW_STUDENTS',
  MANAGE_STUDENT_APPROVAL: 'MANAGE_STUDENT_APPROVAL',
  VIEW_STUDENT_ACTIVITY: 'VIEW_STUDENT_ACTIVITY',
  UPLOAD_MATERIALS: 'UPLOAD_MATERIALS',
  UPLOAD_VIDEOS: 'UPLOAD_VIDEOS',
  MANAGE_CONTENT: 'MANAGE_CONTENT',
  CREATE_QUIZZES: 'CREATE_QUIZZES',
  CREATE_EXAMS: 'CREATE_EXAMS',
  REVIEW_RESULTS: 'REVIEW_RESULTS',
  MANAGE_MEETINGS: 'MANAGE_MEETINGS',
  VIEW_ATTENDANCE: 'VIEW_ATTENDANCE',
  MANAGE_ANNOUNCEMENTS: 'MANAGE_ANNOUNCEMENTS',
};

export const ENGAGEMENT = {
  ACTIVE: 'ACTIVE',
  AT_RISK: 'AT_RISK',
  INACTIVE: 'INACTIVE',
};

export const ENGAGEMENT_LABELS = {
  ACTIVE: 'Active',
  AT_RISK: 'At risk',
  INACTIVE: 'Inactive',
};

export const MEETING_STATUS = {
  UPCOMING: 'UPCOMING',
  LIVE: 'LIVE',
  ENDED: 'ENDED',
  CANCELLED: 'CANCELLED',
};

export const ATTENDANCE_STATUS = {
  INVITED: 'INVITED',
  JOINED: 'JOINED',
  ATTENDED: 'ATTENDED',
  ABSENT: 'ABSENT',
};

export const QUESTION_TYPES = {
  MCQ: 'MCQ',
  TRUE_FALSE: 'TRUE_FALSE',
  SHORT_ANSWER: 'SHORT_ANSWER',
};

export const QUESTION_TYPE_LABELS = {
  MCQ: 'Multiple choice',
  TRUE_FALSE: 'True / False',
  SHORT_ANSWER: 'Short answer',
};

export const MEETING_PROVIDERS = [
  { value: 'ZOOM', label: 'Zoom' },
  { value: 'TEAMS', label: 'Microsoft Teams' },
  { value: 'SKYPE', label: 'Skype' },
  { value: 'GOOGLE_MEET', label: 'Google Meet' },
  { value: 'OTHER', label: 'Other provider' },
];

export const MODULE_COLORS = [
  { value: 'indigo', label: 'Indigo' },
  { value: 'emerald', label: 'Emerald' },
  { value: 'amber', label: 'Amber' },
  { value: 'rose', label: 'Rose' },
  { value: 'sky', label: 'Sky' },
  { value: 'violet', label: 'Violet' },
];

export const ACTIVITY_LABELS = {
  LOGGED_IN: 'Signed in',
  MODULE_OPENED: 'Opened a module',
  LESSON_OPENED: 'Opened a lesson',
  VIDEO_STARTED: 'Started a video',
  VIDEO_PROGRESS: 'Watched a video',
  VIDEO_COMPLETED: 'Finished a video',
  MATERIAL_OPENED: 'Opened material',
  QUIZ_STARTED: 'Started a quiz',
  QUIZ_COMPLETED: 'Completed a quiz',
  EXAM_STARTED: 'Started an exam',
  EXAM_COMPLETED: 'Completed an exam',
  LIVE_MEETING_JOINED: 'Joined a live class',
  LIVE_MEETING_LEFT: 'Left a live class',
};
