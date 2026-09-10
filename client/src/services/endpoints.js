import { get, post, put, patch, del, upload } from './api';

/** Thin, typed-by-convention wrappers around the REST API. */

export const authApi = {
  platform: () => get('/auth/platform'),
  register: (payload) => post('/auth/register', payload),
  login: (payload) => post('/auth/login', payload),
  logout: () => post('/auth/logout'),
  forgotPassword: (payload) => post('/auth/forgot-password', payload),
  verifyResetToken: (token) => get(`/auth/reset-password/${token}`),
  resetPassword: (payload) => post('/auth/reset-password', payload),
  me: () => get('/auth/me'),
  changePassword: (payload) => patch('/auth/password', payload),
  updateProfile: (payload) => patch('/auth/profile', payload),
};

export const assistantApi = {
  list: (params) => get('/assistants', params),
  permissions: () => get('/assistants/permissions'),
  get: (id) => get(`/assistants/${id}`),
  create: (payload) => post('/assistants', payload),
  update: (id, payload) => put(`/assistants/${id}`, payload),
  setStatus: (id, status) => patch(`/assistants/${id}/status`, { status }),
  remove: (id) => del(`/assistants/${id}`),
};

export const studentApi = {
  list: (params) => get('/students', params),
  pending: (params) => get('/students/pending', params),
  stats: () => get('/students/stats/summary'),
  options: (params) => get('/students/options/approved', params),
  details: (id) => get(`/students/${id}`),
  activity: (id, params) => get(`/students/${id}/activity`, params),
  progress: (id) => get(`/students/${id}/progress`),
  review: (id, payload) => patch(`/students/${id}/review`, payload),
  setPassword: (id, password) => patch(`/students/${id}/password`, { password }),
  bulkReview: (payload) => patch('/students/bulk-review', payload),
  update: (id, payload) => put(`/students/${id}`, payload),
  remove: (id) => del(`/students/${id}`),
};

export const groupApi = {
  list: (params) => get('/groups', params),
  get: (id) => get(`/groups/${id}`),
  create: (payload) => post('/groups', payload),
  update: (id, payload) => put(`/groups/${id}`, payload),
  changeMembers: (id, payload) => patch(`/groups/${id}/students`, payload),
  remove: (id) => del(`/groups/${id}`),
};

export const moduleApi = {
  list: () => get('/modules'),
  get: (id) => get(`/modules/${id}`),
  create: (payload) => post('/modules', payload),
  update: (id, payload) => put(`/modules/${id}`, payload),
  togglePublish: (id) => patch(`/modules/${id}/publish`),
  reorder: (items) => patch('/modules/reorder', { items }),
  remove: (id) => del(`/modules/${id}`),
};

export const lessonApi = {
  list: (params) => get('/lessons', params),
  get: (id) => get(`/lessons/${id}`),
  create: (payload) => post('/lessons', payload),
  update: (id, payload) => put(`/lessons/${id}`, payload),
  togglePublish: (id) => patch(`/lessons/${id}/publish`),
  reorder: (items) => patch('/lessons/reorder', { items }),
  remove: (id) => del(`/lessons/${id}`),

  // Videos are linked, never uploaded to this platform.
  setVideo: (lessonId, payload) => post(`/lessons/${lessonId}/video`, payload),

  materials: (lessonId) => get(`/lessons/${lessonId}/materials`),
  uploadMaterials: (lessonId, formData, onProgress) =>
    upload(`/lessons/${lessonId}/materials`, formData, onProgress),
};

export const videoApi = {
  myProgress: (id) => get(`/videos/${id}/progress`),
  start: (id) => post(`/videos/${id}/start`),
  saveProgress: (id, payload) => patch(`/videos/${id}/progress`, payload),
  watchers: (id) => get(`/videos/${id}/watchers`),
  update: (id, payload) => patch(`/videos/${id}`, payload),
  remove: (id) => del(`/videos/${id}`),
};

export const materialApi = {
  open: (id, download = false) => post(`/materials/${id}/open?download=${download}`),
  access: (id) => get(`/materials/${id}/access`),
  update: (id, payload) => patch(`/materials/${id}`, payload),
  remove: (id) => del(`/materials/${id}`),
};

export const quizApi = {
  list: (params) => get('/quizzes', params),
  get: (id) => get(`/quizzes/${id}`),
  create: (payload) => post('/quizzes', payload),
  update: (id, payload) => put(`/quizzes/${id}`, payload),
  togglePublish: (id) => patch(`/quizzes/${id}/publish`),
  remove: (id) => del(`/quizzes/${id}`),
  start: (id) => post(`/quizzes/${id}/start`),
  submit: (attemptId, answers) => post(`/quiz-attempts/${attemptId}/submit`, { answers }),
  myAttempts: (id) => get(`/quizzes/${id}/my-attempts`),
  results: (id, params) => get(`/quizzes/${id}/results`, params),
};

export const examApi = {
  list: (params) => get('/exams', params),
  get: (id) => get(`/exams/${id}`),
  create: (payload) => post('/exams', payload),
  update: (id, payload) => put(`/exams/${id}`, payload),
  togglePublish: (id) => patch(`/exams/${id}/publish`),
  remove: (id) => del(`/exams/${id}`),
  start: (id) => post(`/exams/${id}/start`),
  submit: (attemptId, answers) => post(`/exam-attempts/${attemptId}/submit`, { answers }),
  results: (id, params) => get(`/exams/${id}/results`, params),
};

export const meetingApi = {
  integrations: (params) => get('/meetings/integrations', params),
  list: (params) => get('/meetings', params),
  get: (id) => get(`/meetings/${id}`),
  create: (payload) => post('/meetings', payload),
  update: (id, payload) => put(`/meetings/${id}`, payload),
  cancel: (id, reason) => patch(`/meetings/${id}/cancel`, { reason }),
  remove: (id) => del(`/meetings/${id}`),
  join: (id) => post(`/meetings/${id}/join`),
  leave: (id) => post(`/meetings/${id}/leave`),
  attendance: (id) => get(`/meetings/${id}/attendance`),
  finalize: (id) => post(`/meetings/${id}/finalize`),
};

export const notificationApi = {
  list: (params) => get('/notifications', params),
  unreadCount: () => get('/notifications/unread-count'),
  markRead: (id) => patch(`/notifications/${id}/read`),
  markAllRead: () => patch('/notifications/read-all'),
  remove: (id) => del(`/notifications/${id}`),
};

export const announcementApi = {
  list: (params) => get('/announcements', params),
  create: (payload) => post('/announcements', payload),
  update: (id, payload) => put(`/announcements/${id}`, payload),
  remove: (id) => del(`/announcements/${id}`),
};

export const analyticsApi = {
  dashboard: () => get('/analytics/dashboard'),
  studentsNeedingAttention: (params) => get('/analytics/students-needing-attention', params),
  lessons: (params) => get('/analytics/lessons', params),
  lesson: (id) => get(`/analytics/lessons/${id}`),
  meetings: (params) => get('/analytics/meetings', params),
  activityTrend: (params) => get('/analytics/activity-trend', params),
  activities: (params) => get('/activities', params),
};

export const studentSelfApi = {
  dashboard: () => get('/student/dashboard'),
  progress: () => get('/progress/me'),
  activity: () => get('/student/activity'),
};
