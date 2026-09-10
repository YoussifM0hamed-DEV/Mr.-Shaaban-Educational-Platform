import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Flag,
  Send,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { quizApi, examApi } from '../../services/endpoints';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ErrorState,
  Modal,
  PageLoader,
  ProgressBar,
} from '../../components/ui';
import { QUESTION_TYPES } from '../../utils/constants';
import { formatDuration } from '../../utils/format';

/**
 * Shared runner for quizzes and exams.
 *
 * The answer key never reaches the browser: questions arrive stripped, and the
 * server grades the submission. The timer here is a courtesy - the server
 * independently rejects a late submission using the stored expiry.
 */
export default function AssessmentRunner({ kind = 'quiz' }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isQuiz = kind === 'quiz';
  const api = isQuiz ? quizApi : examApi;

  const [session, setSession] = useState(null);
  const [answers, setAnswers] = useState({});
  const [index, setIndex] = useState(0);
  const [flagged, setFlagged] = useState(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState(null);
  const [remaining, setRemaining] = useState(null);
  const autoSubmitted = useRef(false);

  const start = useMutation({
    mutationFn: () => api.start(id),
    onSuccess: (res) => setSession(res.data),
    onError: (e) => toast.error(e.message),
  });

  const submit = useMutation({
    mutationFn: (payload) => api.submit(session.attemptId, payload),
    onSuccess: (res) => {
      setResult(res.data);
      setConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ['student'] });
      queryClient.invalidateQueries({ queryKey: [isQuiz ? 'quizzes' : 'exams'] });
      queryClient.invalidateQueries({ queryKey: ['lessons'] });
    },
    onError: (e) => {
      toast.error(e.message);
      setConfirmOpen(false);
    },
  });

  // Preview before starting, so the student knows what they are walking into.
  const previewQuery = useQuery({
    queryKey: [isQuiz ? 'quizzes' : 'exams', id, 'preview'],
    queryFn: () => (isQuiz ? quizApi.myAttempts(id) : examApi.get(id)),
  });

  const assessment = session ? (isQuiz ? session.quiz : session.exam) : null;
  const questions = assessment?.questions ?? [];

  const answeredCount = useMemo(
    () => questions.filter((q) => answers[q._id] !== undefined && answers[q._id] !== '').length,
    [questions, answers]
  );

  const buildAnswers = () =>
    questions.map((q) => ({ questionId: q._id, answer: answers[q._id] ?? null }));

  // Countdown, and an automatic submission when the clock runs out.
  useEffect(() => {
    if (!session?.expiresAt || result) return undefined;

    const tick = () => {
      const left = Math.floor((new Date(session.expiresAt) - Date.now()) / 1000);
      setRemaining(left);
      if (left <= 0 && !autoSubmitted.current) {
        autoSubmitted.current = true;
        toast('Time is up. Submitting your answers.', { icon: '⏰' });
        submit.mutate({ answers: buildAnswers() });
      }
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, result, answers]);

  // Warn before the browser closes on an unfinished attempt.
  useEffect(() => {
    if (!session || result) return undefined;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [session, result]);

  /* ------------------------------------------------------------ Result */

  if (result) {
    return <ResultScreen result={result} isQuiz={isQuiz} onDone={() => navigate(-1)} />;
  }

  /* ------------------------------------------------------------ Intro */

  if (!session) {
    if (previewQuery.isLoading) return <PageLoader label="Loading" />;
    if (previewQuery.isError)
      return <ErrorState message={previewQuery.error?.message} onRetry={previewQuery.refetch} />;

    const preview = previewQuery.data.data;
    const canAttempt = isQuiz
      ? preview.attemptsUsed < preview.attemptsAllowed
      : preview.canAttempt;

    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm font-medium text-ink-500 hover:text-ink-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <Card className="p-6">
          <h2 className="text-xl font-bold text-ink-900">
            {isQuiz ? 'Quiz' : preview.title}
          </h2>
          {!isQuiz && preview.description ? (
            <p className="mt-2 text-sm text-ink-600">{preview.description}</p>
          ) : null}

          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            {!isQuiz ? (
              <Detail label="Questions" value={preview.questionCount} />
            ) : null}
            <Detail
              label="Attempts"
              value={`${isQuiz ? preview.attemptsUsed : preview.attemptsUsed} of ${
                isQuiz ? preview.attemptsAllowed : preview.attemptsAllowed
              } used`}
            />
            {!isQuiz ? (
              <>
                <Detail
                  label="Time limit"
                  value={preview.timeLimit ? `${preview.timeLimit} minutes` : 'No limit'}
                />
                <Detail label="Pass mark" value={`${preview.passingGrade}%`} />
              </>
            ) : null}
          </dl>

          {isQuiz && preview.attempts?.length ? (
            <div className="mt-5 rounded-xl border border-ink-200 p-4">
              <p className="text-sm font-semibold text-ink-800">Your attempts</p>
              <ul className="mt-2 space-y-1.5">
                {preview.attempts.map((a) => (
                  <li key={a._id} className="flex items-center justify-between text-sm">
                    <span className="text-ink-600">Attempt {a.attemptNumber}</span>
                    <span className="font-semibold text-ink-900">
                      {a.percentage !== null ? `${a.percentage}%` : 'Submitted'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {!isQuiz && preview.availability !== 'OPEN' ? (
            <div className="mt-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
              <p className="text-sm text-amber-800">
                {preview.availability === 'UPCOMING'
                  ? 'This exam has not opened yet.'
                  : 'This exam is closed.'}
              </p>
            </div>
          ) : null}

          <div className="mt-6">
            <Button
              className="w-full"
              loading={start.isPending}
              disabled={!canAttempt}
              onClick={() => start.mutate()}
            >
              {canAttempt ? `Start ${isQuiz ? 'quiz' : 'exam'}` : 'No attempts remaining'}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  /* ------------------------------------------------------------ Runner */

  const question = questions[index];
  const isLowTime = remaining !== null && remaining <= 60;

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-24">
      {/* Header */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-ink-900">{assessment.title}</h2>
            <p className="text-sm text-ink-500">
              Attempt {session.attemptNumber} - {questions.length} questions - {assessment.totalPoints}{' '}
              points
            </p>
          </div>

          {remaining !== null ? (
            <div
              className={clsx(
                'flex items-center gap-2 rounded-xl px-3.5 py-2 font-bold tabular-nums',
                isLowTime ? 'bg-rose-50 text-rose-700' : 'bg-ink-100 text-ink-800'
              )}
            >
              <Clock className="h-4 w-4" />
              {formatDuration(Math.max(0, remaining))}
            </div>
          ) : null}
        </div>

        {assessment.description ? (
          <p className="mt-3 text-sm text-ink-600">{assessment.description}</p>
        ) : null}

        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-xs">
            <span className="text-ink-500">
              {answeredCount} of {questions.length} answered
            </span>
            <span className="font-semibold text-ink-700">
              {Math.round((answeredCount / questions.length) * 100)}%
            </span>
          </div>
          <ProgressBar value={(answeredCount / questions.length) * 100} tone="brand" />
        </div>

        {/* Question jump grid */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {questions.map((q, i) => {
            const answered = answers[q._id] !== undefined && answers[q._id] !== '';
            return (
              <button
                key={q._id}
                type="button"
                onClick={() => setIndex(i)}
                className={clsx(
                  'h-8 w-8 rounded-lg text-xs font-bold transition-colors',
                  i === index
                    ? 'bg-brand-600 text-white'
                    : flagged.has(q._id)
                      ? 'bg-amber-100 text-amber-700'
                      : answered
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-ink-100 text-ink-500 hover:bg-ink-200'
                )}
                aria-label={`Go to question ${i + 1}`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Question */}
      <Card>
        <CardHeader
          title={`Question ${index + 1} of ${questions.length}`}
          subtitle={`${question.points} point${question.points === 1 ? '' : 's'}`}
          action={
            <Button
              size="sm"
              variant={flagged.has(question._id) ? 'primary' : 'secondary'}
              icon={Flag}
              onClick={() =>
                setFlagged((prev) => {
                  const next = new Set(prev);
                  if (next.has(question._id)) next.delete(question._id);
                  else next.add(question._id);
                  return next;
                })
              }
            >
              {flagged.has(question._id) ? 'Flagged' : 'Flag'}
            </Button>
          }
        />

        <div className="p-5">
          <p className="whitespace-pre-wrap text-base font-medium leading-relaxed text-ink-900">
            {question.text}
          </p>

          <div className="mt-5">
            {question.type === QUESTION_TYPES.MCQ ? (
              <div className="space-y-2">
                {question.options.map((o, i) => {
                  const selected = String(answers[question._id]) === String(i);
                  return (
                    <button
                      key={o._id}
                      type="button"
                      onClick={() => setAnswers({ ...answers, [question._id]: String(i) })}
                      className={clsx(
                        'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all',
                        selected
                          ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-500/20'
                          : 'border-ink-200 bg-white hover:border-ink-300 hover:bg-ink-50'
                      )}
                    >
                      <span
                        className={clsx(
                          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold',
                          selected
                            ? 'border-brand-600 bg-brand-600 text-white'
                            : 'border-ink-300 text-ink-500'
                        )}
                      >
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="text-sm text-ink-800">{o.text}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {question.type === QUESTION_TYPES.TRUE_FALSE ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {['true', 'false'].map((v) => {
                  const selected = String(answers[question._id]) === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setAnswers({ ...answers, [question._id]: v })}
                      className={clsx(
                        'rounded-xl border px-4 py-3.5 text-sm font-semibold capitalize transition-all',
                        selected
                          ? 'border-brand-600 bg-brand-50 text-brand-700 ring-2 ring-brand-500/20'
                          : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300'
                      )}
                    >
                      {v}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {question.type === QUESTION_TYPES.SHORT_ANSWER ? (
              <input
                type="text"
                className="input"
                value={answers[question._id] ?? ''}
                onChange={(e) => setAnswers({ ...answers, [question._id]: e.target.value })}
                placeholder="Type your answer"
              />
            ) : null}
          </div>
        </div>
      </Card>

      {/* Sticky nav */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-200 bg-white/95 px-4 py-3 backdrop-blur-lg lg:pl-72">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <Button
            variant="secondary"
            icon={ArrowLeft}
            disabled={index === 0}
            onClick={() => setIndex((i) => i - 1)}
          >
            Previous
          </Button>

          {index < questions.length - 1 ? (
            <Button className="ml-auto" onClick={() => setIndex((i) => i + 1)}>
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button className="ml-auto" icon={Send} onClick={() => setConfirmOpen(true)}>
              Submit {isQuiz ? 'quiz' : 'exam'}
            </Button>
          )}
        </div>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={`Submit your ${isQuiz ? 'quiz' : 'exam'}?`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              Keep working
            </Button>
            <Button loading={submit.isPending} onClick={() => submit.mutate({ answers: buildAnswers() })}>
              Submit now
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-600">
          You answered {answeredCount} of {questions.length} questions.
          {answeredCount < questions.length
            ? ' Unanswered questions are marked wrong.'
            : ' You cannot change your answers after submitting.'}
        </p>
        {flagged.size > 0 ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            You still have {flagged.size} flagged question{flagged.size === 1 ? '' : 's'}.
          </p>
        ) : null}
      </Modal>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div className="rounded-xl bg-ink-50 px-4 py-3">
      <dt className="text-xs text-ink-500">{label}</dt>
      <dd className="mt-0.5 font-semibold text-ink-900">{value}</dd>
    </div>
  );
}

function ResultScreen({ result, isQuiz, onDone }) {
  if (!result.showResults) {
    return (
      <div className="mx-auto max-w-lg">
        <Card className="p-8 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-7 w-7" />
          </span>
          <h2 className="mt-4 text-xl font-bold text-ink-900">Submitted</h2>
          <p className="mt-2 text-sm text-ink-600">
            Your teacher will publish the result. Nothing else to do for now.
          </p>
          <Button className="mt-6 w-full" onClick={onDone}>
            Back to my learning
          </Button>
        </Card>
      </div>
    );
  }

  const r = result.result;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Card className="p-8 text-center">
        <span
          className={clsx(
            'mx-auto flex h-16 w-16 items-center justify-center rounded-2xl',
            r.passed ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
          )}
        >
          {r.passed ? <CheckCircle2 className="h-8 w-8" /> : <XCircle className="h-8 w-8" />}
        </span>

        <h2 className="mt-4 text-2xl font-bold text-ink-900">
          {r.passed ? 'You passed' : 'Not passed this time'}
        </h2>

        <p className="mt-6 text-5xl font-bold tabular-nums text-ink-900">{r.percentage}%</p>
        <p className="mt-1 text-sm text-ink-500">
          {r.score} of {r.totalPoints} points - pass mark {r.passingGrade}%
        </p>

        <ProgressBar value={r.percentage} className="mt-6" size="lg" />

        {result.timedOut ? (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Time ran out, so your answers were submitted automatically.
          </p>
        ) : null}

        <Button className="mt-6 w-full" onClick={onDone}>
          Back to the {isQuiz ? 'lesson' : 'exams'}
        </Button>
      </Card>

      {r.review ? (
        <Card>
          <CardHeader title="Review your answers" />
          <ul className="divide-y divide-ink-100">
            {r.review.map((q, i) => (
              <li key={q.questionId} className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <span
                    className={clsx(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                      q.isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                    )}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink-900">{q.text}</p>

                    <div className="mt-2 space-y-1 text-sm">
                      <p className={q.isCorrect ? 'text-emerald-700' : 'text-rose-700'}>
                        Your answer: {formatAnswer(q, q.yourAnswer)}
                      </p>
                      {!q.isCorrect ? (
                        <p className="text-emerald-700">
                          Correct answer: {formatAnswer(q, q.correctAnswer)}
                        </p>
                      ) : null}
                      {q.explanation ? (
                        <p className="text-ink-500">{q.explanation}</p>
                      ) : null}
                    </div>
                  </div>
                  <Badge tone={q.isCorrect ? 'success' : 'danger'}>
                    {q.isCorrect ? 'Correct' : 'Wrong'}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

/** MCQ answers are stored as an option index, so map it back to the option text. */
function formatAnswer(question, value) {
  if (value === null || value === undefined || value === '') return 'No answer';
  if (question.type === QUESTION_TYPES.MCQ) {
    const idx = Number(value);
    const byIndex = question.options?.[idx];
    if (byIndex) return byIndex.text;
    const byId = question.options?.find((o) => String(o._id) === String(value));
    return byId ? byId.text : String(value);
  }
  return String(value);
}
