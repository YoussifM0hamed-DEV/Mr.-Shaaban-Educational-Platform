import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Plus, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { quizApi, lessonApi } from '../../services/endpoints';
import QuestionEditor, { emptyQuestion } from '../../components/shared/QuestionEditor';
import {
  Button,
  Card,
  CardHeader,
  ErrorState,
  Field,
  Input,
  PageLoader,
  Select,
  Textarea,
  Toggle,
} from '../../components/ui';

const DEFAULTS = {
  title: '',
  description: '',
  passingGrade: 60,
  timeLimit: 10,
  attemptsAllowed: 1,
  shuffleQuestions: false,
  showResultsImmediately: true,
  showCorrectAnswers: false,
  isPublished: false,
  questions: [emptyQuestion()],
};

export default function QuizEditorPage({ basePath = '/teacher' }) {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  const [lessonId, setLessonId] = useState(params.get('lesson') || '');
  const [form, setForm] = useState(DEFAULTS);
  const [fieldErrors, setFieldErrors] = useState({});

  const lessonsQuery = useQuery({
    queryKey: ['lessons', 'all'],
    queryFn: () => lessonApi.list(),
    enabled: isNew,
  });

  const quizQuery = useQuery({
    queryKey: ['quizzes', id],
    queryFn: () => quizApi.get(id),
    enabled: !isNew,
  });

  useEffect(() => {
    if (quizQuery.data) {
      const q = quizQuery.data.data;
      setForm({
        title: q.title,
        description: q.description || '',
        passingGrade: q.passingGrade,
        timeLimit: q.timeLimit,
        attemptsAllowed: q.attemptsAllowed,
        shuffleQuestions: q.shuffleQuestions,
        showResultsImmediately: q.showResultsImmediately,
        showCorrectAnswers: q.showCorrectAnswers,
        isPublished: q.isPublished,
        questions: q.questions.map((question) => ({
          ...question,
          correctAnswer: String(question.correctAnswer ?? ''),
          acceptedAnswers: question.acceptedAnswers || [],
          options: question.options || [],
        })),
      });
    }
  }, [quizQuery.data]);

  const save = useMutation({
    mutationFn: (payload) => (isNew ? quizApi.create(payload) : quizApi.update(id, payload)),
    onSuccess: (res) => {
      toast.success(res.message);
      navigate(`${basePath}/quizzes/${res.data._id}/edit`, { replace: true });
    },
    onError: (err) => {
      toast.error(err.message);
      if (err.details) {
        const mapped = {};
        err.details.forEach((d) => {
          mapped[d.field] = d.message;
        });
        setFieldErrors(mapped);
      }
    },
  });

  if (!isNew && quizQuery.isLoading) return <PageLoader label="Loading quiz" />;
  if (!isNew && quizQuery.isError)
    return <ErrorState message={quizQuery.error?.message} onRetry={quizQuery.refetch} />;

  const setQuestion = (index, question) =>
    setForm((f) => ({
      ...f,
      questions: f.questions.map((q, i) => (i === index ? question : q)),
    }));

  const removeQuestion = (index) =>
    setForm((f) => ({ ...f, questions: f.questions.filter((_, i) => i !== index) }));

  const moveQuestion = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= form.questions.length) return;
    const next = [...form.questions];
    [next[index], next[target]] = [next[target], next[index]];
    setForm((f) => ({ ...f, questions: next }));
  };

  const handleSave = () => {
    setFieldErrors({});

    if (isNew && !lessonId) {
      toast.error('Choose which lesson this quiz belongs to');
      return;
    }
    if (!form.questions.length) {
      toast.error('Add at least one question');
      return;
    }

    // Strip the ids mongoose generated so a new question is created cleanly.
    const questions = form.questions.map(({ _id, ...q }) => ({
      ...q,
      options: (q.options || []).map(({ _id: optId, ...o }) => o),
      points: Number(q.points) || 0,
      correctAnswer: String(q.correctAnswer ?? ''),
    }));

    const payload = {
      title: form.title,
      description: form.description,
      passingGrade: Number(form.passingGrade),
      timeLimit: Number(form.timeLimit),
      attemptsAllowed: Number(form.attemptsAllowed),
      shuffleQuestions: form.shuffleQuestions,
      showResultsImmediately: form.showResultsImmediately,
      showCorrectAnswers: form.showCorrectAnswers,
      isPublished: form.isPublished,
      questions,
    };
    if (isNew) payload.lesson = lessonId;

    save.mutate(payload);
  };

  const totalPoints = form.questions.reduce((s, q) => s + (Number(q.points) || 0), 0);
  const lessons = lessonsQuery.data?.data ?? [];

  return (
    <div className="space-y-5 pb-20">
      <Link
        to={`${basePath}/quizzes`}
        className="inline-flex items-center gap-2 text-sm font-medium text-ink-500 hover:text-ink-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to quizzes
      </Link>

      <Card>
        <CardHeader title={isNew ? 'Create quiz' : 'Edit quiz'} subtitle="Attached to a single lesson" />
        <div className="space-y-4 p-5">
          {isNew ? (
            <Field label="Lesson" required hint="A lesson can only have one quiz.">
              <Select
                value={lessonId}
                onChange={(e) => setLessonId(e.target.value)}
                placeholder="Choose a lesson"
                options={lessons.map((l) => ({
                  value: l._id,
                  label: `${l.module?.title || 'Module'} - ${l.title}`,
                }))}
              />
            </Field>
          ) : null}

          <Field label="Title" required error={fieldErrors.title}>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Lesson 1 - quiz"
            />
          </Field>

          <Field label="Instructions">
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What the student should know before starting."
              rows={3}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Pass mark (%)">
              <Input
                type="number"
                min="0"
                max="100"
                value={form.passingGrade}
                onChange={(e) => setForm({ ...form, passingGrade: e.target.value })}
              />
            </Field>
            <Field label="Time limit (minutes)" hint="0 means no limit">
              <Input
                type="number"
                min="0"
                max="600"
                value={form.timeLimit}
                onChange={(e) => setForm({ ...form, timeLimit: e.target.value })}
              />
            </Field>
            <Field label="Attempts allowed">
              <Input
                type="number"
                min="1"
                max="20"
                value={form.attemptsAllowed}
                onChange={(e) => setForm({ ...form, attemptsAllowed: e.target.value })}
              />
            </Field>
          </div>

          <div className="grid gap-4 rounded-xl border border-ink-200 p-4 sm:grid-cols-2">
            <Toggle
              checked={form.shuffleQuestions}
              onChange={(v) => setForm({ ...form, shuffleQuestions: v })}
              label="Shuffle questions"
              description="Each student sees a different order."
            />
            <Toggle
              checked={form.showResultsImmediately}
              onChange={(v) => setForm({ ...form, showResultsImmediately: v })}
              label="Show the score on submit"
              description="Otherwise the student only sees that it was submitted."
            />
            <Toggle
              checked={form.showCorrectAnswers}
              onChange={(v) => setForm({ ...form, showCorrectAnswers: v })}
              label="Reveal correct answers"
              description="Students can review what they got wrong."
            />
            <Toggle
              checked={form.isPublished}
              onChange={(v) => setForm({ ...form, isPublished: v })}
              label="Published"
              description="Publishing notifies every approved student."
            />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Questions"
          subtitle={`${form.questions.length} questions - ${totalPoints} points total`}
          action={
            <Button
              size="sm"
              variant="secondary"
              icon={Plus}
              onClick={() => setForm((f) => ({ ...f, questions: [...f.questions, emptyQuestion()] }))}
            >
              Add question
            </Button>
          }
        />
        <div className="space-y-4 p-5">
          {form.questions.map((q, i) => (
            <QuestionEditor
              key={i}
              question={q}
              index={i}
              total={form.questions.length}
              onChange={(next) => setQuestion(i, next)}
              onRemove={removeQuestion}
              onMove={moveQuestion}
            />
          ))}
        </div>
      </Card>

      {/* Sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-200 bg-white/90 px-4 py-3 backdrop-blur-lg lg:pl-72">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-ink-500">
            {form.questions.length} questions - {totalPoints} points
          </p>
          <div className="flex gap-2">
            <Link to={`${basePath}/quizzes`} className="btn-secondary">
              Cancel
            </Link>
            <Button icon={Save} loading={save.isPending} onClick={handleSave}>
              {isNew ? 'Create quiz' : 'Save quiz'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
