import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  FileText,
  Check,
  Copy,
  KeyRound,
  Mail,
  Phone,
  PlayCircle,
  Radio,
  School,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { studentApi } from '../../services/endpoints';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  Modal,
  EmptyState,
  EngagementBadge,
  ErrorState,
  PageLoader,
  ProgressBar,
  ProgressRing,
  StatusBadge,
  Tabs,
} from '../../components/ui';
import ActivityTimeline from '../../components/shared/ActivityTimeline';
import { formatDate, formatDateTime, relativeDay } from '../../utils/format';

/** Renders the video / material / quiz state for one lesson row. */
function LessonRow({ lesson }) {
  return (
    <div className="flex flex-wrap items-center gap-4 border-b border-ink-100 px-5 py-3.5 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink-900">{lesson.title}</p>
        <ProgressBar value={lesson.percentage} size="sm" className="mt-1.5 max-w-xs" showLabel />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {lesson.video ? (
          <Badge tone={lesson.video.completed ? 'success' : lesson.video.percentage > 0 ? 'warning' : 'neutral'}>
            <PlayCircle className="h-3 w-3" />
            Video {lesson.video.percentage}%
          </Badge>
        ) : null}

        {lesson.material ? (
          <Badge tone={lesson.material.allOpened ? 'success' : lesson.material.anyOpened ? 'warning' : 'neutral'}>
            <FileText className="h-3 w-3" />
            {lesson.material.anyOpened
              ? `Material ${lesson.material.opened}/${lesson.material.total}`
              : 'Not opened'}
          </Badge>
        ) : null}

        {lesson.quiz ? (
          <Badge tone={lesson.quiz.completed ? (lesson.quiz.passed ? 'success' : 'warning') : 'neutral'}>
            <ClipboardList className="h-3 w-3" />
            {lesson.quiz.completed ? `Quiz ${lesson.quiz.score}%` : 'Quiz not completed'}
          </Badge>
        ) : null}
      </div>
    </div>
  );
}

/** A readable password the teacher can dictate over the phone. */
function suggestPassword() {
  const words = ['Nile', 'Cairo', 'Sun', 'Book', 'Star', 'Lion', 'Palm', 'Gold'];
  const word = words[Math.floor(Math.random() * words.length)];
  return `${word}${Math.floor(1000 + Math.random() * 9000)}`;
}

export default function StudentDetailsPage({ basePath = '/teacher' }) {
  const { id } = useParams();
  const [tab, setTab] = useState('progress');
  const [pwOpen, setPwOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [pwDone, setPwDone] = useState(false);
  const [copied, setCopied] = useState(false);

  const setPassword = useMutation({
    mutationFn: (password) => studentApi.setPassword(id, password),
    onSuccess: (res) => {
      toast.success(res.message);
      setPwDone(true);
    },
    onError: (e) => toast.error(e.message),
  });

  const openPasswordDialog = () => {
    setNewPassword(suggestPassword());
    setPwDone(false);
    setCopied(false);
    setPwOpen(true);
  };

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['students', 'details', id],
    queryFn: () => studentApi.details(id),
  });

  if (isLoading) return <PageLoader label="Loading student" />;
  if (isError) return <ErrorState message={error?.message} onRetry={refetch} />;

  const { student, progress, rollup, exams, attendance, timeline } = data.data;

  const tabs = [
    { value: 'progress', label: 'Progress', count: progress.modules.length },
    { value: 'exams', label: 'Exams', count: exams.length },
    { value: 'attendance', label: 'Live attendance', count: attendance.invited },
    { value: 'activity', label: 'Activity', count: timeline.length },
  ];

  return (
    <div className="space-y-5">
      <Link
        to={`${basePath}/students`}
        className="inline-flex items-center gap-2 text-sm font-medium text-ink-500 hover:text-ink-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to students
      </Link>

      {/* Header */}
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
          <Avatar name={student.name} src={student.avatarUrl} size="xl" />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-ink-900">{student.name}</h2>
              <StatusBadge status={student.status} />
              <EngagementBadge engagement={student.engagement} />
            </div>

            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-ink-600">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-ink-400" />
                {student.email}
              </span>
              {student.phone ? (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-ink-400" />
                  {student.phone}
                </span>
              ) : null}
              {student.studentInfo?.school ? (
                <span className="inline-flex items-center gap-1.5">
                  <School className="h-3.5 w-3.5 text-ink-400" />
                  {student.studentInfo.school}
                  {student.studentInfo.grade ? ` - ${student.studentInfo.grade}` : ''}
                </span>
              ) : null}
            </div>

            <p className="mt-3 text-xs text-ink-500">
              Registered {formatDate(student.createdAt)} - last activity{' '}
              <span className="font-medium text-ink-700">{relativeDay(student.lastActivityAt)}</span>
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-center gap-3">
            <ProgressRing value={progress.overall} sublabel="Overall" />
            <Button size="sm" variant="secondary" icon={KeyRound} onClick={openPasswordDialog}>
              Set a new password
            </Button>
          </div>
        </div>

        {/* Roll-up strip */}
        <div className="grid grid-cols-2 divide-x divide-ink-100 border-t border-ink-100 sm:grid-cols-4">
          {[
            {
              label: 'Videos completed',
              value: `${progress.summary.videosCompleted}/${progress.summary.videosTotal}`,
              icon: PlayCircle,
            },
            {
              label: 'Materials opened',
              value: `${progress.summary.materialsOpened}/${progress.summary.materialsTotal}`,
              icon: FileText,
            },
            {
              label: 'Quizzes completed',
              value: `${progress.summary.quizzesCompleted}/${progress.summary.quizzesTotal}`,
              icon: ClipboardList,
            },
            {
              label: 'Live attendance',
              value: `${attendance.attended}/${attendance.invited}`,
              icon: Radio,
            },
          ].map((item) => (
            <div key={item.label} className="px-5 py-4">
              <div className="flex items-center gap-2 text-xs text-ink-500">
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </div>
              <p className="mt-1 text-lg font-bold tabular-nums text-ink-900">{item.value}</p>
            </div>
          ))}
        </div>
      </Card>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'progress' ? (
        <div className="space-y-4">
          {progress.modules.length === 0 ? (
            <Card>
              <EmptyState title="No published modules yet" description="Create a module to start tracking progress." />
            </Card>
          ) : (
            progress.modules.map((module) => (
              <Card key={module.moduleId}>
                <CardHeader
                  title={module.title}
                  subtitle={`${module.lessonCount} lesson${module.lessonCount === 1 ? '' : 's'}`}
                  action={
                    <div className="w-40">
                      <ProgressBar value={module.percentage} showLabel />
                    </div>
                  }
                />
                {module.lessons.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-ink-500">No published lessons in this module.</p>
                ) : (
                  module.lessons.map((lesson) => <LessonRow key={lesson.lessonId} lesson={lesson} />)
                )}
              </Card>
            ))
          )}
        </div>
      ) : null}

      {tab === 'exams' ? (
        <Card>
          <CardHeader title="Exams" subtitle="Which exams this student has sat" />
          {exams.length === 0 ? (
            <EmptyState title="No published exams" description="Publish an exam to see results here." className="py-10" />
          ) : (
            <ul className="divide-y divide-ink-100">
              {exams.map((ex) => (
                <li key={ex.examId} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      ex.taken ? (ex.passed ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600') : 'bg-ink-100 text-ink-400'
                    }`}
                  >
                    {ex.taken ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-900">{ex.title}</p>
                    <p className="text-xs text-ink-500">
                      {ex.taken ? `Submitted ${formatDateTime(ex.submittedAt)}` : 'Not taken'}
                    </p>
                  </div>
                  {ex.taken ? (
                    <Badge tone={ex.passed ? 'success' : 'danger'}>
                      {ex.score}% - {ex.passed ? 'Passed' : 'Failed'}
                    </Badge>
                  ) : (
                    <Badge tone="neutral">Not taken</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {tab === 'attendance' ? (
        <Card>
          <CardHeader
            title="Live class attendance"
            subtitle={`${attendance.attended} attended out of ${attendance.invited} invitations`}
            action={
              <div className="w-40">
                <ProgressBar
                  value={attendance.invited ? (attendance.attended / attendance.invited) * 100 : 0}
                  showLabel
                />
              </div>
            }
          />
          {attendance.records.length === 0 ? (
            <EmptyState
              icon={Radio}
              title="No invitations yet"
              description="This student has not been invited to a live class."
              className="py-10"
            />
          ) : (
            <ul className="divide-y divide-ink-100">
              {attendance.records.map((r) => (
                <li key={r.meetingId} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-900">{r.title}</p>
                    <p className="text-xs text-ink-500">{formatDateTime(r.startTime)}</p>
                  </div>
                  {r.durationMinutes > 0 ? (
                    <span className="text-xs text-ink-500">{r.durationMinutes} min</span>
                  ) : null}
                  <Badge
                    tone={
                      r.status === 'ATTENDED'
                        ? 'success'
                        : r.status === 'ABSENT'
                          ? 'danger'
                          : r.status === 'JOINED'
                            ? 'info'
                            : 'neutral'
                    }
                  >
                    {r.status === 'ATTENDED'
                      ? 'Attended'
                      : r.status === 'ABSENT'
                        ? 'Absent'
                        : r.status === 'JOINED'
                          ? 'In the class'
                          : 'Invited'}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      <Modal
        open={pwOpen}
        onClose={() => setPwOpen(false)}
        title={`Set a new password for ${student.name}`}
        description="Use this when the student cannot receive the reset email."
        size="sm"
        footer={
          pwDone ? (
            <Button onClick={() => setPwOpen(false)}>Done</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setPwOpen(false)}>
                Cancel
              </Button>
              <Button
                loading={setPassword.isPending}
                disabled={newPassword.length < 8}
                onClick={() => setPassword.mutate(newPassword)}
              >
                Set password
              </Button>
            </>
          )
        }
      >
        {pwDone ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-800">Password changed</p>
              <p className="mt-1 text-sm text-emerald-700">
                Send it to {student.name} now. It is not shown again, and every device they were
                signed in on has been signed out.
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-ink-200 bg-ink-50 px-4 py-3">
              <code className="flex-1 select-all font-mono text-base font-semibold text-ink-900">
                {newPassword}
              </code>
              <Button
                size="sm"
                variant="secondary"
                icon={copied ? Check : Copy}
                onClick={() => {
                  navigator.clipboard.writeText(newPassword).then(() => {
                    setCopied(true);
                    toast.success('Copied');
                  });
                }}
              >
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Field
              label="New password"
              required
              hint="At least 8 characters with a letter and a number. A suggestion is filled in."
            >
              <Input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoFocus
              />
            </Field>
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              This signs the student out everywhere. Tell them the new password yourself.
            </p>
          </div>
        )}
      </Modal>

      {tab === 'activity' ? (
        <Card>
          <CardHeader title="Activity timeline" subtitle="Newest first" />
          <div className="p-5">
            <ActivityTimeline items={timeline} />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
