import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MailCheck, Send } from 'lucide-react';
import AuthShell from './AuthShell';
import { Button, Field, Input } from '../../components/ui';
import { authApi } from '../../services/endpoints';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await authApi.forgotPassword({ email });
      setSent({ message: res.message, emailConfigured: res.data?.emailConfigured });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthShell
        title="Check your email"
        subtitle="If that email has an account here, the reset link is on its way."
      >
        <div className="space-y-6">
          <div className="flex gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
              <MailCheck className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-emerald-800">Reset link sent</p>
              <p className="mt-1 text-sm text-emerald-700">
                We sent it to <span className="font-medium">{email}</span>. The link works once and
                expires in an hour. Look in your spam folder if it is not in the inbox.
              </p>
            </div>
          </div>

          {sent.emailConfigured === false ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-800">
                Email sending is not switched on for this platform yet, so the link was written to
                the server console instead. Ask your teacher to send it to you.
              </p>
            </div>
          ) : null}

          <div className="space-y-2">
            <Button variant="secondary" className="w-full" onClick={() => setSent(null)}>
              Use a different email
            </Button>
            <Link to="/login" className="btn-ghost w-full">
              Back to sign in
            </Link>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="Enter the email you registered with and we will send you a link to choose a new password."
      footer={
        <Link to="/login" className="inline-flex items-center gap-1.5 font-semibold text-brand-600 hover:text-brand-700">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <Field label="Email address" required>
          <Input
            type="email"
            autoComplete="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </Field>

        <Button type="submit" icon={Send} loading={loading} className="w-full">
          Send the reset link
        </Button>

        <p className="text-center text-xs text-ink-500">
          For your safety we give the same answer whether or not the email has an account.
        </p>
      </form>
    </AuthShell>
  );
}
