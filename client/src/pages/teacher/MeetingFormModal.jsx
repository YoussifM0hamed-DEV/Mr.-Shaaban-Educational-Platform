import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { meetingApi, moduleApi, studentApi, groupApi } from '../../services/endpoints';
import {
  Button,
  Checkbox,
  Field,
  Input,
  Modal,
  MultiSelect,
  Select,
  Textarea,
  Toggle,
} from '../../components/ui';
import { MEETING_PROVIDERS } from '../../utils/constants';
import { toDateTimeLocal } from '../../utils/format';

/** Defaults to a one-hour slot starting on the next full hour. */
function defaultTimes() {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start.getTime() + 60 * 60000);
  return { startTime: toDateTimeLocal(start), endTime: toDateTimeLocal(end) };
}

const EMPTY = {
  title: '',
  description: '',
  provider: 'ZOOM',
  meetingUrl: '',
  externalMeetingId: '',
  meetingPassword: '',
  module: '',
  ...defaultTimes(),
};

export default function MeetingFormModal({ open, meeting, onClose, onSaved }) {
  const isEdit = Boolean(meeting);
  const [form, setForm] = useState(EMPTY);
  const [invitedAll, setInvitedAll] = useState(true);
  const [attendees, setAttendees] = useState([]);
  const [pickedGroups, setPickedGroups] = useState([]);
  const [autoCreate, setAutoCreate] = useState(false);
  const [errors, setErrors] = useState({});

  // Whether this platform is connected to a Zoom account at all.
  const integrationsQuery = useQuery({
    queryKey: ['meetings', 'integrations'],
    queryFn: meetingApi.integrations,
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const studentsQuery = useQuery({
    queryKey: ['students', 'options'],
    queryFn: () => studentApi.options(),
    enabled: open,
  });

  const modulesQuery = useQuery({ queryKey: ['modules'], queryFn: moduleApi.list, enabled: open });

  const groupsQuery = useQuery({
    queryKey: ['groups'],
    queryFn: () => groupApi.list(),
    enabled: open,
  });

  const detailQuery = useQuery({
    queryKey: ['meetings', meeting?._id],
    queryFn: () => meetingApi.get(meeting._id),
    enabled: open && isEdit,
  });

  useEffect(() => {
    if (!open) return;

    if (!isEdit) {
      setForm({ ...EMPTY, ...defaultTimes() });
      setInvitedAll(true);
      setAttendees([]);
      setPickedGroups([]);
      setAutoCreate(true);
      setErrors({});
      return;
    }

    const m = detailQuery.data?.data?.meeting;
    if (m) {
      setForm({
        title: m.title,
        description: m.description || '',
        provider: m.provider,
        meetingUrl: m.meetingUrl || '',
        externalMeetingId: m.externalMeetingId || '',
        meetingPassword: m.meetingPassword || '',
        module: m.module?._id || m.module || '',
        startTime: toDateTimeLocal(m.startTime),
        endTime: toDateTimeLocal(m.endTime),
      });
      setInvitedAll(m.invitedAll);
      setAttendees((m.attendeeList || []).map((s) => s._id));
      setPickedGroups((m.groupList || []).map((g) => g._id));
      setAutoCreate(false);
    }
  }, [open, isEdit, detailQuery.data]);

  const save = useMutation({
    mutationFn: (payload) =>
      isEdit ? meetingApi.update(meeting._id, payload) : meetingApi.create(payload),
    onSuccess: (res) => {
      toast.success(res.message);
      onSaved();
    },
    onError: (err) => {
      toast.error(err.message);
      if (err.details) {
        const mapped = {};
        err.details.forEach((d) => {
          mapped[d.field] = d.message;
        });
        setErrors(mapped);
      }
    },
  });

  const students = studentsQuery.data?.data ?? [];
  const modules = modulesQuery.data?.data ?? [];
  const groups = groupsQuery.data?.data ?? [];

  // A rough count for the form. The server does the real de-duplication.
  const invitedCount = invitedAll
    ? students.length
    : new Set([
        ...attendees,
        ...groups.filter((g) => pickedGroups.includes(g._id)).flatMap(() => []),
      ]).size +
      groups
        .filter((g) => pickedGroups.includes(g._id))
        .reduce((sum, g) => sum + g.studentCount, 0);

  const zoomConfigured = integrationsQuery.data?.data?.zoom?.configured === true;
  const isZoom = form.provider === 'ZOOM';
  // Only offered on a new Zoom meeting: an existing one already has its room.
  const canAutoCreate = !isEdit && isZoom && zoomConfigured;

  const handleSave = () => {
    setErrors({});

    const payload = {
      title: form.title,
      description: form.description,
      provider: form.provider,
      module: form.module || null,
      startTime: form.startTime ? new Date(form.startTime).toISOString() : undefined,
      endTime: form.endTime ? new Date(form.endTime).toISOString() : undefined,
      invitedAll,
      attendees: invitedAll ? [] : attendees,
      groups: invitedAll ? [] : pickedGroups,
    };

    if (canAutoCreate && autoCreate) {
      payload.autoCreate = true;
    } else {
      payload.meetingUrl = form.meetingUrl;
      payload.externalMeetingId = form.externalMeetingId;
      payload.meetingPassword = form.meetingPassword;
    }

    save.mutate(payload);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit live class' : 'Create live class'}
      description="Any provider works - paste the join URL your provider gives you."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={save.isPending}>
            {isEdit ? 'Save changes' : 'Create and notify students'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Title" required error={errors.title}>
          <Input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Arabic Grammar - Live Revision"
          />
        </Field>

        <Field label="Description">
          <Textarea
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="What you will cover in this session."
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts" required error={errors.startTime}>
            <Input
              type="datetime-local"
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
            />
          </Field>
          <Field label="Ends" required error={errors.endTime}>
            <Input
              type="datetime-local"
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Provider">
            <Select
              value={form.provider}
              onChange={(e) => setForm({ ...form, provider: e.target.value })}
              options={MEETING_PROVIDERS}
            />
          </Field>
          <Field label="Module" hint="Optional - links the class to a module.">
            <Select
              value={form.module}
              onChange={(e) => setForm({ ...form, module: e.target.value })}
              placeholder="No module"
              options={modules.map((m) => ({ value: m._id, label: m.title }))}
            />
          </Field>
        </div>

        {/* Zoom can make the room itself, so nothing has to be copied by hand. */}
        {canAutoCreate ? (
          <div
            className={clsx(
              'rounded-xl border p-4 transition-colors',
              autoCreate ? 'border-brand-300 bg-brand-50' : 'border-ink-200'
            )}
          >
            <Toggle
              checked={autoCreate}
              onChange={setAutoCreate}
              label="Create the Zoom meeting for me"
              description="The platform asks Zoom for the room and fills in the link and passcode."
            />
            {autoCreate ? (
              <p className="mt-3 flex items-start gap-2 text-xs text-brand-800">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Zoom will be called when you save. Editing the time later moves the Zoom
                meeting too, and cancelling removes it from your Zoom account.
              </p>
            ) : null}
          </div>
        ) : null}

        {!autoCreate ? (
          <>
            <Field
              label="Meeting URL"
              required
              error={errors.meetingUrl}
              hint={
                isZoom && !zoomConfigured
                  ? 'Zoom is not connected to this platform yet, so paste the link from Zoom.'
                  : 'Students only receive this after the server checks they were invited.'
              }
            >
              <Input
                value={form.meetingUrl}
                onChange={(e) => setForm({ ...form, meetingUrl: e.target.value })}
                placeholder="https://zoom.us/j/1234567890"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Meeting ID" hint="Optional">
                <Input
                  value={form.externalMeetingId}
                  onChange={(e) => setForm({ ...form, externalMeetingId: e.target.value })}
                  placeholder="123 4567 890"
                />
              </Field>
              <Field label="Passcode" hint="Optional">
                <Input
                  value={form.meetingPassword}
                  onChange={(e) => setForm({ ...form, meetingPassword: e.target.value })}
                  placeholder="arabic"
                />
              </Field>
            </div>
          </>
        ) : null}

        <div>
          <p className="label">Who is invited</p>
          <div className="rounded-xl border border-ink-200 p-4">
            <Checkbox
              label="Invite every approved student"
              description="New students approved later are not added automatically."
              checked={invitedAll}
              onChange={(e) => setInvitedAll(e.target.checked)}
            />
          </div>

          {invitedAll ? (
            <p className="mt-2 text-xs text-ink-500">
              {students.length} approved student{students.length === 1 ? '' : 's'} will be invited.
            </p>
          ) : (
            <div className="mt-3 space-y-4">
              {groups.length ? (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
                    Invite whole groups
                  </p>
                  <div className="space-y-2 rounded-xl border border-ink-200 p-4">
                    {groups.map((g) => (
                      <Checkbox
                        key={g._id}
                        label={g.name}
                        description={`${g.studentCount} student${g.studentCount === 1 ? '' : 's'}`}
                        checked={pickedGroups.includes(g._id)}
                        onChange={() =>
                          setPickedGroups((prev) =>
                            prev.includes(g._id)
                              ? prev.filter((x) => x !== g._id)
                              : [...prev, g._id]
                          )
                        }
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
                  {groups.length ? 'And any extra students' : 'Pick students'}
                </p>
                <MultiSelect
                  options={students.map((s) => ({
                    value: s._id,
                    label: s.name,
                    sublabel: s.email,
                  }))}
                  selected={attendees}
                  onChange={setAttendees}
                  placeholder="Search students"
                  emptyLabel="No approved students yet"
                />
              </div>

              <p className="text-xs text-ink-500">
                {invitedCount === 0
                  ? 'Nobody is invited yet.'
                  : `About ${invitedCount} student${invitedCount === 1 ? '' : 's'} will be invited. Groups and individual picks are combined.`}
              </p>

              {errors.attendees ? (
                <p className="text-xs font-medium text-rose-600">{errors.attendees}</p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
