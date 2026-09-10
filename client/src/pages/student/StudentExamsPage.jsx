import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, ClipboardList, Clock, Lock } from 'lucide-react';
import { examApi } from '../../services/endpoints';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  ProgressBar,
  SkeletonCard,
} from '../../components/ui';
import { formatDate } from '../../utils/format';

const AVAILABILITY = {
  OPEN: { tone: 'success', label: 'Open now' },
  UPCOMING: { tone: 'info', label: 'Not open yet' },
  CLOSED: { tone: 'neutral', label: 'Closed' },
};

export default function StudentExamsPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['exams'],
    queryFn: () => examApi.list(),
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (isError) return <ErrorState message={error?.message} onRetry={refetch} />;

  const exams = data.data;

  if (!exams.length) {
    return (
      <Card>
        <EmptyState
          icon={ClipboardList}
          title="No exams yet"
          description="Your teacher has not published any exam."
        />
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {exams.map((ex) => {
        const availability = AVAILABILITY[ex.availability] || AVAILABILITY.OPEN;

        return (
          <Card key={ex._id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-semibold text-ink-900">{ex.title}</h3>
                <p className="truncate text-sm text-ink-500">{ex.module?.title}</p>
              </div>
              <Badge tone={availability.tone}>{availability.label}</Badge>
            </div>

            {ex.description ? (
              <p className="mt-2 line-clamp-2 text-sm text-ink-600">{ex.description}</p>
            ) : null}

            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-500">Questions</dt>
                <dd className="font-semibold tabular-nums text-ink-800">{ex.questionCount}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-500">Time limit</dt>
                <dd className="font-semibold tabular-nums text-ink-800">
                  {ex.timeLimit ? `${ex.timeLimit} min` : 'None'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-500">Pass mark</dt>
                <dd className="font-semibold tabular-nums text-ink-800">{ex.passingGrade}%</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-500">Attempts</dt>
                <dd className="font-semibold tabular-nums text-ink-800">
                  {ex.attemptsUsed}/{ex.attemptsAllowed}
                </dd>
              </div>
            </dl>

            {ex.availableTo ? (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-500">
                <Clock className="h-3.5 w-3.5" />
                Closes {formatDate(ex.availableTo)}
              </p>
            ) : null}

            {ex.taken && ex.score !== null ? (
              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-ink-600">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    Your score
                  </span>
                  <span className="font-bold tabular-nums text-ink-900">{ex.score}%</span>
                </div>
                <ProgressBar value={ex.score} />
              </div>
            ) : null}

            <div className="mt-5 border-t border-ink-100 pt-4">
              {ex.canAttempt ? (
                <Link to={`/student/exams/${ex._id}`} className="btn-primary w-full">
                  {ex.inProgressAttemptId ? 'Resume exam' : 'Start exam'}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <div className="flex items-center justify-center gap-2 rounded-xl bg-ink-50 px-4 py-2.5 text-sm text-ink-500">
                  <Lock className="h-4 w-4" />
                  {ex.taken
                    ? 'You have already taken this exam'
                    : ex.availability === 'UPCOMING'
                      ? 'Opens later'
                      : 'This exam is closed'}
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
