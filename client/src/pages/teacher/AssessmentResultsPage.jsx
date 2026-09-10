import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';
import { quizApi, examApi } from '../../services/endpoints';
import StatCard from '../../components/shared/StatCard';
import {
  Avatar,
  Badge,
  Card,
  ErrorState,
  Pagination,
  PageLoader,
  ProgressBar,
} from '../../components/ui';
import { formatDateTime } from '../../utils/format';

/**
 * Shared results screen for quizzes and exams.
 * Lists every approved student so the teacher can see who has NOT taken it.
 */
export default function AssessmentResultsPage({ kind = 'quiz', basePath = '/teacher' }) {
  const { id } = useParams();
  const [page, setPage] = useState(1);
  const isQuiz = kind === 'quiz';

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: [isQuiz ? 'quizzes' : 'exams', id, 'results', page],
    queryFn: () =>
      isQuiz ? quizApi.results(id, { page, limit: 25 }) : examApi.results(id, { page, limit: 25 }),
    keepPreviousData: true,
  });

  if (isLoading) return <PageLoader label="Loading results" />;
  if (isError) return <ErrorState message={error?.message} onRetry={refetch} />;

  const rows = data.data;
  const stats = data.stats;
  const assessment = isQuiz ? data.quiz : data.exam;

  return (
    <div className="space-y-5">
      <Link
        to={`${basePath}/${isQuiz ? 'quizzes' : 'exams'}`}
        className="inline-flex items-center gap-2 text-sm font-medium text-ink-500 hover:text-ink-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {isQuiz ? 'quizzes' : 'exams'}
      </Link>

      <Card className="p-6">
        <h2 className="text-xl font-bold text-ink-900">{assessment.title}</h2>
        <p className="mt-1 text-sm text-ink-500">
          {isQuiz
            ? assessment.lesson?.title || 'Lesson quiz'
            : assessment.module?.title || 'Module exam'}{' '}
          - pass mark {assessment.passingGrade}%
        </p>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={isQuiz ? 'Completed' : 'Took the exam'}
          value={stats.taken}
          hint={`of ${stats.totalStudents} approved students`}
          progress={stats.completionRate}
          tone="brand"
        />
        <StatCard
          label="Not taken"
          value={stats.notTaken}
          tone={stats.notTaken > 0 ? 'warning' : 'success'}
        />
        <StatCard label="Average score" value={`${stats.averageScore}%`} tone="info" />
        <StatCard
          label="Passed"
          value={stats.passed}
          hint={`${stats.failed} did not pass`}
          tone="success"
        />
      </div>

      <div className="table-wrap">
        <table className="w-full">
          <thead className="border-b border-ink-200 bg-ink-50/60">
            <tr>
              <th className="th">Student</th>
              <th className="th">Status</th>
              <th className="th">Score</th>
              <th className="th">Result</th>
              {isQuiz ? <th className="th">Attempts</th> : null}
              <th className="th">Submitted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.map((r) => {
              const done = isQuiz ? r.completed : r.taken;
              return (
                <tr key={r.student._id} className="transition-colors hover:bg-ink-50/60">
                  <td className="td">
                    <Link
                      to={`${basePath}/students/${r.student._id}`}
                      className="flex items-center gap-3"
                    >
                      <Avatar name={r.student.name} src={r.student.avatarUrl} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-ink-900">
                          {r.student.name}
                        </span>
                        <span className="block truncate text-xs text-ink-500">{r.student.email}</span>
                      </span>
                    </Link>
                  </td>

                  <td className="td">
                    {done ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-600">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-sm font-medium">Completed</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-ink-400">
                        <XCircle className="h-4 w-4" />
                        <span className="text-sm">Not taken</span>
                      </span>
                    )}
                  </td>

                  <td className="td w-40">
                    {done ? <ProgressBar value={r.percentage} showLabel size="sm" /> : <span className="text-ink-400">-</span>}
                  </td>

                  <td className="td">
                    {done ? (
                      <Badge tone={r.passed ? 'success' : 'danger'}>
                        {r.passed ? 'Passed' : 'Failed'}
                      </Badge>
                    ) : (
                      <span className="text-ink-400">-</span>
                    )}
                  </td>

                  {isQuiz ? <td className="td tabular-nums">{r.attempts || 0}</td> : null}

                  <td className="td text-ink-500">
                    {r.submittedAt ? formatDateTime(r.submittedAt) : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <Pagination pagination={data.pagination} onPageChange={setPage} />
      </div>
    </div>
  );
}
