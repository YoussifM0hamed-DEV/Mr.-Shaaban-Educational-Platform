import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { KeyRound, Save, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi } from '../services/endpoints';
import { useAuth } from '../context/AuthContext';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
} from '../components/ui';
import { formatDate } from '../utils/format';
import { ROLES } from '../utils/constants';

/** Shared account screen for all three roles. */
export default function SettingsPage() {
  const { user, refreshUser } = useAuth();

  const [profile, setProfile] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    grade: user?.studentInfo?.grade || '',
    school: user?.studentInfo?.school || '',
    parentPhone: user?.studentInfo?.parentPhone || '',
  });

  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [passwordError, setPasswordError] = useState(null);

  const saveProfile = useMutation({
    mutationFn: (payload) => authApi.updateProfile(payload),
    onSuccess: async () => {
      toast.success('Profile updated');
      await refreshUser();
    },
    onError: (e) => toast.error(e.message),
  });

  const changePassword = useMutation({
    mutationFn: (payload) => authApi.changePassword(payload),
    onSuccess: () => {
      toast.success('Password updated');
      setPasswords({ currentPassword: '', newPassword: '', confirm: '' });
      setPasswordError(null);
    },
    onError: (e) => {
      setPasswordError(e.message);
      toast.error(e.message);
    },
  });

  const isStudent = user?.role === ROLES.STUDENT;

  const handleProfileSave = () => {
    const payload = { name: profile.name, phone: profile.phone };
    if (isStudent) {
      payload.grade = profile.grade;
      payload.school = profile.school;
      payload.parentPhone = profile.parentPhone;
    }
    saveProfile.mutate(payload);
  };

  const handlePasswordSave = () => {
    setPasswordError(null);
    if (passwords.newPassword !== passwords.confirm) {
      setPasswordError('The new passwords do not match');
      return;
    }
    changePassword.mutate({
      currentPassword: passwords.currentPassword,
      newPassword: passwords.newPassword,
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Card className="p-6">
        <div className="flex flex-wrap items-center gap-5">
          <Avatar name={user?.name} src={user?.avatarUrl} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-ink-900">{user?.name}</h2>
              <Badge tone="brand">{user?.role}</Badge>
            </div>
            <p className="truncate text-sm text-ink-500">{user?.email}</p>
            <p className="mt-1 text-xs text-ink-400">Member since {formatDate(user?.createdAt)}</p>
          </div>
        </div>

        {user?.role === ROLES.ASSISTANT ? (
          <div className="mt-5 rounded-xl border border-ink-200 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink-800">
              <ShieldCheck className="h-4 w-4 text-brand-600" />
              Your permissions
            </div>
            {user.permissions?.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {user.permissions.map((p) => (
                  <Badge key={p} tone="brand">
                    {p.replace(/_/g, ' ').toLowerCase()}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-ink-500">
                The teacher has not granted you any permissions yet.
              </p>
            )}
          </div>
        ) : null}
      </Card>

      <Card>
        <CardHeader title="Profile" subtitle="Keep your contact details up to date" />
        <div className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required>
              <Input
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              />
            </Field>
            <Field label="Phone">
              <Input
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              />
            </Field>
          </div>

          {isStudent ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Grade">
                <Input
                  value={profile.grade}
                  onChange={(e) => setProfile({ ...profile, grade: e.target.value })}
                />
              </Field>
              <Field label="School">
                <Input
                  value={profile.school}
                  onChange={(e) => setProfile({ ...profile, school: e.target.value })}
                />
              </Field>
              <Field label="Parent phone">
                <Input
                  value={profile.parentPhone}
                  onChange={(e) => setProfile({ ...profile, parentPhone: e.target.value })}
                />
              </Field>
            </div>
          ) : null}

          <Field label="Email address" hint="Your email cannot be changed here.">
            <Input value={user?.email || ''} disabled />
          </Field>

          <div className="flex justify-end">
            <Button icon={Save} loading={saveProfile.isPending} onClick={handleProfileSave}>
              Save profile
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Password" subtitle="Use at least 8 characters with a letter and a number" />
        <div className="space-y-4 p-5">
          {passwordError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {passwordError}
            </div>
          ) : null}

          <Field label="Current password" required>
            <Input
              type="password"
              autoComplete="current-password"
              value={passwords.currentPassword}
              onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="New password" required>
              <Input
                type="password"
                autoComplete="new-password"
                value={passwords.newPassword}
                onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
              />
            </Field>
            <Field label="Confirm new password" required>
              <Input
                type="password"
                autoComplete="new-password"
                value={passwords.confirm}
                onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
              />
            </Field>
          </div>

          <div className="flex justify-end">
            <Button
              icon={KeyRound}
              loading={changePassword.isPending}
              onClick={handlePasswordSave}
              disabled={!passwords.currentPassword || !passwords.newPassword}
            >
              Change password
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
