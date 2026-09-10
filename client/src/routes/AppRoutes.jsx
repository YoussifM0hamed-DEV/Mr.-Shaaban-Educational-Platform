import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute, PublicOnlyRoute, PermissionRoute } from './ProtectedRoute';
import { PageLoader } from '../components/ui';
import { PERMISSIONS, ROLES } from '../utils/constants';

// Layouts
import TeacherLayout from '../layouts/TeacherLayout';
import AssistantLayout from '../layouts/AssistantLayout';
import StudentLayout from '../layouts/StudentLayout';

// Public
import LandingPage from '../pages/LandingPage';
import LoginPage from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';
import AccountStatusPage from '../pages/auth/AccountStatusPage';
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '../pages/auth/ResetPasswordPage';
import SettingsPage from '../pages/SettingsPage';

// Teacher / assistant screens are shared and reused with a different basePath.
const TeacherDashboard = lazy(() => import('../pages/teacher/TeacherDashboard'));
const StudentsPage = lazy(() => import('../pages/teacher/StudentsPage'));
const StudentDetailsPage = lazy(() => import('../pages/teacher/StudentDetailsPage'));
const AssistantsPage = lazy(() => import('../pages/teacher/AssistantsPage'));
const GroupsPage = lazy(() => import('../pages/teacher/GroupsPage'));
const GroupDetailPage = lazy(() => import('../pages/teacher/GroupDetailPage'));
const ModulesPage = lazy(() => import('../pages/teacher/ModulesPage'));
const ModuleDetailPage = lazy(() => import('../pages/teacher/ModuleDetailPage'));
const LessonEditorPage = lazy(() => import('../pages/teacher/LessonEditorPage'));
const QuizzesPage = lazy(() => import('../pages/teacher/QuizzesPage'));
const QuizEditorPage = lazy(() => import('../pages/teacher/QuizEditorPage'));
const ExamsPage = lazy(() => import('../pages/teacher/ExamsPage'));
const ExamEditorPage = lazy(() => import('../pages/teacher/ExamEditorPage'));
const AssessmentResultsPage = lazy(() => import('../pages/teacher/AssessmentResultsPage'));
const LiveClassesPage = lazy(() => import('../pages/teacher/LiveClassesPage'));
const MeetingAttendancePage = lazy(() => import('../pages/teacher/MeetingAttendancePage'));
const AnalyticsPage = lazy(() => import('../pages/teacher/AnalyticsPage'));
const AnnouncementsPage = lazy(() => import('../pages/teacher/AnnouncementsPage'));
const ActivityPage = lazy(() => import('../pages/teacher/ActivityPage'));

const AssistantDashboard = lazy(() => import('../pages/assistant/AssistantDashboard'));

const StudentDashboard = lazy(() => import('../pages/student/StudentDashboard'));
const StudentModulesPage = lazy(() => import('../pages/student/StudentModulesPage'));
const StudentModuleDetailPage = lazy(() => import('../pages/student/StudentModuleDetailPage'));
const StudentLessonPage = lazy(() => import('../pages/student/StudentLessonPage'));
const AssessmentRunner = lazy(() => import('../pages/student/AssessmentRunner'));
const StudentExamsPage = lazy(() => import('../pages/student/StudentExamsPage'));
const StudentLiveClassesPage = lazy(() => import('../pages/student/StudentLiveClassesPage'));
const StudentProgressPage = lazy(() => import('../pages/student/StudentProgressPage'));
const StudentAnnouncementsPage = lazy(() => import('../pages/student/StudentAnnouncementsPage'));

const NotFound = () => (
  <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
    <p className="text-6xl font-bold text-brand-600">404</p>
    <h1 className="mt-4 text-2xl font-bold text-ink-900">Page not found</h1>
    <p className="mt-2 max-w-md text-ink-600">
      The page you are looking for does not exist or you no longer have access to it.
    </p>
    <a href="/" className="btn-primary mt-6">
      Go to the home page
    </a>
  </div>
);

export default function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>

        {/* Student account status screens */}
        <Route element={<ProtectedRoute roles={[ROLES.STUDENT]} />}>
          <Route path="/pending" element={<AccountStatusPage variant="pending" />} />
          <Route path="/rejected" element={<AccountStatusPage variant="rejected" />} />
        </Route>

        {/* ---------------------------------------------------------- Teacher */}
        <Route element={<ProtectedRoute roles={[ROLES.TEACHER]} />}>
          <Route path="/teacher" element={<TeacherLayout />}>
            <Route index element={<TeacherDashboard />} />
            <Route path="students" element={<StudentsPage basePath="/teacher" />} />
            <Route path="students/:id" element={<StudentDetailsPage basePath="/teacher" />} />
            <Route path="assistants" element={<AssistantsPage />} />
            <Route path="groups" element={<GroupsPage basePath="/teacher" />} />
            <Route path="groups/:id" element={<GroupDetailPage basePath="/teacher" />} />
            <Route path="modules" element={<ModulesPage basePath="/teacher" />} />
            <Route path="modules/:id" element={<ModuleDetailPage basePath="/teacher" />} />
            <Route path="lessons/:id" element={<LessonEditorPage basePath="/teacher" />} />
            <Route path="quizzes" element={<QuizzesPage basePath="/teacher" />} />
            <Route path="quizzes/new" element={<QuizEditorPage basePath="/teacher" />} />
            <Route path="quizzes/:id/edit" element={<QuizEditorPage basePath="/teacher" />} />
            <Route
              path="quizzes/:id/results"
              element={<AssessmentResultsPage kind="quiz" basePath="/teacher" />}
            />
            <Route path="exams" element={<ExamsPage basePath="/teacher" />} />
            <Route path="exams/new" element={<ExamEditorPage basePath="/teacher" />} />
            <Route path="exams/:id/edit" element={<ExamEditorPage basePath="/teacher" />} />
            <Route
              path="exams/:id/results"
              element={<AssessmentResultsPage kind="exam" basePath="/teacher" />}
            />
            <Route path="live-classes" element={<LiveClassesPage basePath="/teacher" />} />
            <Route
              path="live-classes/:id/attendance"
              element={<MeetingAttendancePage basePath="/teacher" />}
            />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="announcements" element={<AnnouncementsPage />} />
            <Route path="activity" element={<ActivityPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>

        {/* -------------------------------------------------------- Assistant */}
        <Route element={<ProtectedRoute roles={[ROLES.ASSISTANT]} />}>
          <Route path="/assistant" element={<AssistantLayout />}>
            <Route index element={<AssistantDashboard />} />

            <Route
              path="students"
              element={
                <PermissionRoute permission={PERMISSIONS.VIEW_STUDENTS}>
                  <StudentsPage basePath="/assistant" />
                </PermissionRoute>
              }
            />
            <Route
              path="students/:id"
              element={
                <PermissionRoute permission={PERMISSIONS.VIEW_STUDENTS}>
                  <StudentDetailsPage basePath="/assistant" />
                </PermissionRoute>
              }
            />

            <Route
              path="groups"
              element={
                <PermissionRoute permission={PERMISSIONS.VIEW_STUDENTS}>
                  <GroupsPage basePath="/assistant" />
                </PermissionRoute>
              }
            />
            <Route
              path="groups/:id"
              element={
                <PermissionRoute permission={PERMISSIONS.VIEW_STUDENTS}>
                  <GroupDetailPage basePath="/assistant" />
                </PermissionRoute>
              }
            />

            <Route path="modules" element={<ModulesPage basePath="/assistant" />} />
            <Route path="modules/:id" element={<ModuleDetailPage basePath="/assistant" />} />
            <Route path="lessons/:id" element={<LessonEditorPage basePath="/assistant" />} />

            <Route path="quizzes" element={<QuizzesPage basePath="/assistant" />} />
            <Route
              path="quizzes/new"
              element={
                <PermissionRoute permission={PERMISSIONS.CREATE_QUIZZES}>
                  <QuizEditorPage basePath="/assistant" />
                </PermissionRoute>
              }
            />
            <Route
              path="quizzes/:id/edit"
              element={
                <PermissionRoute permission={PERMISSIONS.CREATE_QUIZZES}>
                  <QuizEditorPage basePath="/assistant" />
                </PermissionRoute>
              }
            />
            <Route
              path="quizzes/:id/results"
              element={<AssessmentResultsPage kind="quiz" basePath="/assistant" />}
            />

            <Route path="exams" element={<ExamsPage basePath="/assistant" />} />
            <Route
              path="exams/new"
              element={
                <PermissionRoute permission={PERMISSIONS.CREATE_EXAMS}>
                  <ExamEditorPage basePath="/assistant" />
                </PermissionRoute>
              }
            />
            <Route
              path="exams/:id/edit"
              element={
                <PermissionRoute permission={PERMISSIONS.CREATE_EXAMS}>
                  <ExamEditorPage basePath="/assistant" />
                </PermissionRoute>
              }
            />
            <Route
              path="exams/:id/results"
              element={<AssessmentResultsPage kind="exam" basePath="/assistant" />}
            />

            <Route path="live-classes" element={<LiveClassesPage basePath="/assistant" />} />
            <Route
              path="live-classes/:id/attendance"
              element={<MeetingAttendancePage basePath="/assistant" />}
            />

            <Route
              path="announcements"
              element={
                <PermissionRoute permission={PERMISSIONS.MANAGE_ANNOUNCEMENTS}>
                  <AnnouncementsPage />
                </PermissionRoute>
              }
            />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>

        {/* ---------------------------------------------------------- Student */}
        <Route element={<ProtectedRoute roles={[ROLES.STUDENT]} requireApproved />}>
          <Route path="/student" element={<StudentLayout />}>
            <Route index element={<StudentDashboard />} />
            <Route path="modules" element={<StudentModulesPage />} />
            <Route path="modules/:id" element={<StudentModuleDetailPage />} />
            <Route path="lessons/:id" element={<StudentLessonPage />} />
            <Route path="quizzes/:id" element={<AssessmentRunner kind="quiz" />} />
            <Route path="exams" element={<StudentExamsPage />} />
            <Route path="exams/:id" element={<AssessmentRunner kind="exam" />} />
            <Route path="live-classes" element={<StudentLiveClassesPage />} />
            <Route path="progress" element={<StudentProgressPage />} />
            <Route path="announcements" element={<StudentAnnouncementsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
