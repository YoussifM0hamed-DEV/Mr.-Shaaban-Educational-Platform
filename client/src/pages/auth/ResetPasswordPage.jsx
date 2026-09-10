import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Eye, EyeOff, KeyRound, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import AuthShell from './AuthShell';
import { Button, Field, Input, Spinner } from '../../components/ui';
import { authApi } from '../../services/endpoints';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';

  const [checking, setChecking] = useState(true);
  const [account, setAccount] = useState(null);
  const [tokenError, setTokenError] = useState(null);

  const [form, setForm] = useState({ password: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  // Check the link before asking the user to type anything.
  useEffect(() => {
    let active = true;

    if (!token) {
      setTokenError('This link is missing its reset code.');
      setChecking(false);
      return undefined;
    }

    (async () => {
      try {
        const res = await authApi.verifyResetToken(token);
        if (active) setAccount(res.data);
      } catch (err) {
        if (active) setTokenError(err.message);
      } finally {
        if (active) setChecking(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [token]);

  const validate = () => {
    const next = {};
    if (form.password.length < 8) next.password = 'At least 8 characters';
    else if (!/[a-zA-Z]/.test(form.password) || !/[0-9]/.test(form.password)) {
      next.password = 'Include at least one letter and one number';
    }
    if (form.password !== form.confirm) next.confirm = 'The passwords do not match';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;

    setSaving(true);
    try {
      await authApi.resetPassword({ token, password: form.password });
      setDone(true);
      toast.success('Password changed');
      setTimeout(() => navigate('/login', { replace: true }), 2500);
    } catch (err) {
      setServerError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (checking) {
    return (
      <AuthShell title="Checking your link" subtitle="One moment.">
        <div className="flex justify-center py-10">
          <Spinner className="h-7 w-7" />
        </div>
      </AuthShell>
    );
  }

  if (tokenError) {
    return (
      <AuthShell title="This link no longer works" subtitle="Reset links expire and can only be used once.">
        <div className="space-y-6">
          <div className="flex gap-4 rounded-2xl border border-rose-200 bg-rose-50 p-5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
              <XCircle className="h-5 w-5" />
            </span>
            <p className="text-sm text-rose-700">{tokenError}</p>
          </div>

          <Link to="/forgot-password" className="btn-primary w-full">
            Request a new link
          </Link>
          <Link to="/login" className="btn-ghost w-full">
            Back to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell title="Password changed" subtitle="You can sign in with your new password now.">
        <div className="space-y-6">
          <div className="flex gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <p className="text-sm text-emerald-700">
              Your password is updated. Taking you to the sign in page.
            </p>
          </div>

          <Link to="/login" className="btn-primary w-full">
            Sign in now
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle={account?.email ? `For ${account.email}` : 'Pick something you have not used here before.'}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {serverError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {serverError}
          </div>
        ) : null}

        <Field label="New password" required error={errors.password} hint="At least 8 characters with a letter and a number">
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              autoFocus
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Your new password"
              className="pr-11"
              error={Boolean(errors.password)}
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

        <Field label="Confirm new password" required error={errors.confirm}>
          <Input
            type="password"
            autoComplete="new-password"
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            placeholder="Repeat your new password"
            error={Boolean(errors.confirm)}
          />
        </Field>

        <Button type="submit" icon={KeyRound} loading={saving} className="w-full">
          Change my password
        </Button>
      </form>
    </AuthShell>
  );
}
