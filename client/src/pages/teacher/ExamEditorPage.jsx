import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Plus, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { examApi, moduleApi } from '../../services/endpoints';
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
import { toDateTimeLocal } from '../../utils/format';

const DEFAULTS = {
  title: '',
  description: '',
  passingGrade: 60,
  timeLimit: 60,
  attemptsAllowed: 1,
  shuffleQuestions: true,
  showResultsImmediately: false,
  showCorrectAnswers: false,
  isPublished: false,
  availableFrom: '',
  availableTo: '',
  questions: [emptyQuestion()],
};

export default function ExamEditorPage({ basePath = '/teacher' }) {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  const [moduleId, setModuleId] = useState(params.get('module') || '');
  const [form, setForm] = useState(DEFAULTS);

  const modulesQuery = useQuery({ queryKey: ['modules'], queryFn: moduleApi.list });

  const examQuery = useQuery({
    queryKey: ['exams', id],
    queryFn: () => examApi.get(id),
    enabled: !isNew,
  });

  useEffect(() => {
    if (examQuery.data) {
      const e = examQuery.data.data;
      setModuleId(e.module?._id || e.module || '');
      setForm({
        title: e.title,
        description: e.description || '',
        passingGrade: e.passingGrade,
        timeLimit: e.timeLimit,
        attemptsAllowed: e.attemptsAllowed,
        shuffleQuestions: e.shuffleQuestions,
        showResultsImmediately: e.showResultsImmediately,
        showCorrectAnswers: e.showCorrectAnswers,
        isPublished: e.isPublished,
        availableFrom: toDateTimeLocal(e.availableFrom),
        availableTo: toDateTimeLocal(e.availableTo),
        questions: (e.questions || []).map((q) => ({
          ...q,
          correctAnswer: String(q.correctAnswer ?? ''),
          acceptedAnswers: q.acceptedAnswers || [],
          options: q.options || [],
        })),
      });
    }
  }, [examQuery.data]);

  const save = useMutation({
    mutationFn: (payload) => (isNew ? examApi.create(payload) : examApi.update(id, payload)),
    onSuccess: (res) => {
      toast.success(res.message);
      navigate(`${basePath}/exams/${res.data._id}/edit`, { replace: true });
    },
    onError: (e) => toast.error(e.message),
  });

  if (!isNew && examQuery.isLoading) return <PageLoader label="Loading exam" />;
  if (!isNew && examQuery.isError)
    return <ErrorState message={examQuery.error?.message} onRetry={examQuery.refetch} />;

  const setQuestion = (index, question) =>
    setForm((f) => ({ ...f, questions: f.questions.map((q, i) => (i === index ? question : q)) }));

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
    if (!moduleId) {
      toast.error('Choose which module this exam belongs to');
      return;
    }
    if (!form.questions.length) {
      toast.error('Add at least one question');
      return;
    }

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
      availableFrom: form.availableFrom ? new Date(form.availableFrom).toISOString() : null,
      availableTo: form.availableTo ? new Date(form.availableTo).toISOString() : null,
      questions,
    };
    if (isNew) payload.module = moduleId;

    save.mutate(payload);
  };

  const totalPoints = form.questions.reduce((s, q) => s + (Number(q.points) || 0), 0);
  const modules = modulesQuery.data?.data ?? [];

  return (
    <div className="space-y-5 pb-20">
      <Link
        to={`${basePath}/exams`}
        className="inline-flex items-center gap-2 text-sm font-medium text-ink-500 hover:text-ink-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to exams
      </Link>

      <Card>
        <CardHeader title={isNew ? 'Create exam' : 'Edit exam'} subtitle="Attached to a module" />
        <div className="space-y-4 p-5">
          <Field label="Module" required>
            <Select
              value={moduleId}
              onChange={(e) => setModuleId(e.target.value)}
              placeholder="Choose a module"
              disabled={!isNew}
              options={modules.map((m) => ({ value: m._id, label: m.title }))}
            />
          </Field>

          <Field label="Title" required>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Mid-term Exam - Arabic Grammar"
            />
          </Field>

          <Field label="Instructions">
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
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
                max="5"
                value={form.attemptsAllowed}
                onChange={(e) => setForm({ ...form, attemptsAllowed: e.target.value })}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Opens" hint="Leave blank to open as soon as it is published.">
              <Input
                type="datetime-local"
                value={form.availableFrom}
                onChange={(e) => setForm({ ...form, availableFrom: e.target.value })}
              />
            </Field>
            <Field label="Closes" hint="Leave blank to stay open.">
              <Input
                type="datetime-local"
                value={form.availableTo}
                onChange={(e) => setForm({ ...form, availableTo: e.target.value })}
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
              description="Turn this off to release results yourself."
            />
            <Toggle
              checked={form.showCorrectAnswers}
              onChange={(v) => setForm({ ...form, showCorrectAnswers: v })}
              label="Reveal correct answers"
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

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-200 bg-white/90 px-4 py-3 backdrop-blur-lg lg:pl-72">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-ink-500">
            {form.questions.length} questions - {totalPoints} points
          </p>
          <div className="flex gap-2">
            <Link to={`${basePath}/exams`} className="btn-secondary">
              Cancel
            </Link>
            <Button icon={Save} loading={save.isPending} onClick={handleSave}>
              {isNew ? 'Create exam' : 'Save exam'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
