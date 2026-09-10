import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import AuthShell from './AuthShell';
import { Button, Field, Input } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';

const EMPTY = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  phone: '',
  grade: '',
  school: '',
  parentPhone: '',
};

/**
 * Students register straight onto this platform.
 * There is no teacher to choose - the whole site belongs to one teacher.
 */
export default function RegisterPage() {
  const { register, platform } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [loading, setLoading] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const validate = () => {
    const next = {};
    if (form.name.trim().length < 2) next.name = 'Enter your full name';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Enter a valid email address';
    if (form.password.length < 8) next.password = 'At least 8 characters';
    else if (!/[a-zA-Z]/.test(form.password) || !/[0-9]/.test(form.password)) {
      next.password = 'Include at least one letter and one number';
    }
    if (form.password !== form.confirmPassword) next.confirmPassword = 'Passwords do not match';
    if (form.phone.trim().length < 7) next.phone = 'Enter your phone number';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;

    setLoading(true);
    try {
      const { confirmPassword, ...payload } = form;
      await register(payload);
      toast.success('Registration received');
      navigate('/pending', { replace: true, state: { justRegistered: true } });
    } catch (err) {
      setServerError(err.message);
      if (err.details) {
        const mapped = {};
        err.details.forEach((d) => {
          mapped[d.field] = d.message;
        });
        setErrors(mapped);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create your student account"
      subtitle={`Register with ${platform?.teacherName || 'your teacher'}. Your account is reviewed before you get access.`}
      footer={
        <>
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {serverError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {serverError}
          </div>
        ) : null}

        <Field label="Full name" required error={errors.name}>
          <Input value={form.name} onChange={set('name')} placeholder="Ahmed Mohamed" autoComplete="name" />
        </Field>

        <Field label="Email address" required error={errors.email}>
          <Input
            type="email"
            value={form.email}
            onChange={set('email')}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Password" required error={errors.password}>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={set('password')}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                className="pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>

          <Field label="Confirm password" required error={errors.confirmPassword}>
            <Input
              type="password"
              value={form.confirmPassword}
              onChange={set('confirmPassword')}
              placeholder="Repeat your password"
              autoComplete="new-password"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone number" required error={errors.phone}>
            <Input value={form.phone} onChange={set('phone')} placeholder="+20 100 000 0000" autoComplete="tel" />
          </Field>
          <Field label="Parent phone" error={errors.parentPhone} hint="Optional">
            <Input value={form.parentPhone} onChange={set('parentPhone')} placeholder="+20 100 000 0000" />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Grade" hint="Optional">
            <Input value={form.grade} onChange={set('grade')} placeholder="Grade 11" />
          </Field>
          <Field label="School" hint="Optional">
            <Input value={form.school} onChange={set('school')} placeholder="Your school" />
          </Field>
        </div>

        <Button type="submit" icon={UserPlus} loading={loading} className="w-full">
          Create account
        </Button>

        <p className="text-center text-xs text-ink-500">
          Your account stays pending until the teacher approves it.
        </p>
      </form>
    </AuthShell>
  );
}
