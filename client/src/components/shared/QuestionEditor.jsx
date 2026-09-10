import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, Field, Input, Select, Textarea } from '../ui';
import { QUESTION_TYPES, QUESTION_TYPE_LABELS } from '../../utils/constants';

const TYPE_OPTIONS = Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export function emptyQuestion(type = QUESTION_TYPES.MCQ) {
  if (type === QUESTION_TYPES.MCQ) {
    return {
      type,
      text: '',
      options: [{ text: '' }, { text: '' }],
      correctAnswer: '0',
      points: 1,
      explanation: '',
      acceptedAnswers: [],
    };
  }
  if (type === QUESTION_TYPES.TRUE_FALSE) {
    return { type, text: '', options: [], correctAnswer: 'true', points: 1, explanation: '', acceptedAnswers: [] };
  }
  return { type, text: '', options: [], correctAnswer: '', points: 1, explanation: '', acceptedAnswers: [] };
}

/**
 * Editor for one question.
 * `correctAnswer` is an option index for MCQ, "true"/"false" for true-false,
 * and the expected text for short answer - matching what the backend grades against.
 */
export default function QuestionEditor({
  question,
  index,
  total,
  onChange,
  onRemove,
  onMove,
  errors = {},
}) {
  const set = (patch) => onChange({ ...question, ...patch });

  const changeType = (type) => {
    const fresh = emptyQuestion(type);
    onChange({ ...fresh, text: question.text, points: question.points });
  };

  const setOption = (i, text) => {
    const options = question.options.map((o, idx) => (idx === i ? { ...o, text } : o));
    set({ options });
  };

  const addOption = () => set({ options: [...question.options, { text: '' }] });

  const removeOption = (i) => {
    const options = question.options.filter((_, idx) => idx !== i);
    let correct = Number(question.correctAnswer);
    if (correct === i) correct = 0;
    else if (correct > i) correct -= 1;
    set({ options, correctAnswer: String(correct) });
  };

  return (
    <div className="rounded-2xl border border-ink-200 bg-white">
      <div className="flex items-center gap-3 border-b border-ink-100 px-4 py-3">
        <GripVertical className="h-4 w-4 text-ink-300" />
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-xs font-bold text-brand-700">
          {index + 1}
        </span>
        <Badge tone="neutral">{QUESTION_TYPE_LABELS[question.type]}</Badge>
        <span className="text-xs text-ink-500">
          {question.points} point{question.points === 1 ? '' : 's'}
        </span>

        <div className="ml-auto flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            icon={ChevronUp}
            disabled={index === 0}
            onClick={() => onMove(index, -1)}
            aria-label="Move question up"
          />
          <Button
            size="sm"
            variant="ghost"
            icon={ChevronDown}
            disabled={index === total - 1}
            onClick={() => onMove(index, 1)}
            aria-label="Move question down"
          />
          <Button
            size="sm"
            variant="ghost"
            icon={Trash2}
            onClick={() => onRemove(index)}
            aria-label="Remove question"
          />
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto]">
          <Field label="Question" required error={errors.text} className="sm:col-span-1">
            <Textarea
              rows={2}
              value={question.text}
              onChange={(e) => set({ text: e.target.value })}
              placeholder="Which of these is a noun?"
            />
          </Field>

          <Field label="Type" className="sm:w-44">
            <Select value={question.type} onChange={(e) => changeType(e.target.value)} options={TYPE_OPTIONS} />
          </Field>

          <Field label="Points" className="sm:w-24">
            <Input
              type="number"
              min="0"
              max="100"
              value={question.points}
              onChange={(e) => set({ points: Number(e.target.value) })}
            />
          </Field>
        </div>

        {question.type === QUESTION_TYPES.MCQ ? (
          <div>
            <p className="label">Options - select the correct one</p>
            <div className="space-y-2">
              {question.options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${index}`}
                    className="h-4 w-4 shrink-0 border-ink-300 text-brand-600 focus:ring-brand-500"
                    checked={String(question.correctAnswer) === String(i)}
                    onChange={() => set({ correctAnswer: String(i) })}
                    aria-label={`Option ${i + 1} is correct`}
                  />
                  <Input
                    value={o.text}
                    onChange={(e) => setOption(i, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Trash2}
                    disabled={question.options.length <= 2}
                    onClick={() => removeOption(i)}
                    aria-label={`Remove option ${i + 1}`}
                  />
                </div>
              ))}
            </div>
            {errors.correctAnswer ? (
              <p className="mt-1.5 text-xs font-medium text-rose-600">{errors.correctAnswer}</p>
            ) : null}
            {question.options.length < 10 ? (
              <Button size="sm" variant="ghost" icon={Plus} className="mt-2" onClick={addOption}>
                Add option
              </Button>
            ) : null}
          </div>
        ) : null}

        {question.type === QUESTION_TYPES.TRUE_FALSE ? (
          <Field label="Correct answer" required>
            <div className="flex gap-2">
              {['true', 'false'].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => set({ correctAnswer: v })}
                  className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold capitalize transition-colors ${
                    String(question.correctAnswer) === v
                      ? 'border-brand-600 bg-brand-50 text-brand-700'
                      : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </Field>
        ) : null}

        {question.type === QUESTION_TYPES.SHORT_ANSWER ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Expected answer" required error={errors.correctAnswer}>
              <Input
                value={question.correctAnswer ?? ''}
                onChange={(e) => set({ correctAnswer: e.target.value })}
                placeholder="mubtada"
              />
            </Field>
            <Field
              label="Also accept"
              hint="Comma separated. Matching ignores case and extra spaces."
            >
              <Input
                value={(question.acceptedAnswers || []).join(', ')}
                onChange={(e) =>
                  set({
                    acceptedAnswers: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="al-mubtada, the mubtada"
              />
            </Field>
          </div>
        ) : null}

        <Field label="Explanation" hint="Shown after submission when you reveal answers.">
          <Input
            value={question.explanation || ''}
            onChange={(e) => set({ explanation: e.target.value })}
            placeholder="A noun names a person, place or thing."
          />
        </Field>
      </div>
    </div>
  );
}
