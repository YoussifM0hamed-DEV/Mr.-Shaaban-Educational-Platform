import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { meetingApi } from '../../services/endpoints';
import { onSocketEvent, SOCKET_EVENTS } from '../../services/socket';
import StatCard from '../../components/shared/StatCard';
import {
  Avatar,
  Badge,
  Card,
  ErrorState,
  PageLoader,
  ProgressBar,
} from '../../components/ui';
import { formatDateTime, formatTime } from '../../utils/format';

const STATUS_STYLE = {
  ATTENDED: { tone: 'success', label: 'Attended', Icon: CheckCircle2 },
  JOINED: { tone: 'info', label: 'In the class', Icon: Clock },
  ABSENT: { tone: 'danger', label: 'Absent', Icon: XCircle },
  INVITED: { tone: 'neutral', label: 'Invited', Icon: Clock },
};

export default function MeetingAttendancePage({ basePath = '/teacher' }) {
  const { id } = useParams();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['meetings', id, 'attendance'],
    queryFn: () => meetingApi.attendance(id),
    refetchInterval: 30000,
  });

  // A student joining a live class updates the roll call immediately.
  useEffect(() => {
    const off = onSocketEvent(SOCKET_EVENTS.MEETING_STUDENT_JOINED, (payload) => {
      if (payload.meetingId === id) {
        queryClient.invalidateQueries({ queryKey: ['meetings', id, 'attendance'] });
      }
    });
    return off;
  }, [id, queryClient]);

  if (isLoading) return <PageLoader label="Loading attendance" />;
  if (isError) return <ErrorState message={error?.message} onRetry={refetch} />;

  const { meeting, rows, stats } = data.data;

  return (
    <div className="space-y-5">
      <Link
        to={`${basePath}/live-classes`}
        className="inline-flex items-center gap-2 text-sm font-medium text-ink-500 hover:text-ink-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to live classes
      </Link>

      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-ink-900">{meeting.title}</h2>
              <Badge
                tone={
                  meeting.status === 'LIVE'
                    ? 'danger'
                    : meeting.status === 'UPCOMING'
                      ? 'info'
                      : meeting.status === 'CANCELLED'
                        ? 'neutral'
                        : 'success'
                }
              >
                {meeting.status}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-ink-500">
              {formatDateTime(meeting.startTime)} to {formatTime(meeting.endTime)}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total invited" value={stats.invited} tone="brand" />
        <StatCard label="Attended" value={stats.attended} tone="success" />
        <StatCard label="Absent" value={stats.absent} tone="danger" />
        <StatCard
          label="Attendance"
          value={`${stats.attendancePercentage}%`}
          tone="info"
          progress={stats.attendancePercentage}
        />
      </div>

      <div className="table-wrap">
        <table className="w-full">
          <thead className="border-b border-ink-200 bg-ink-50/60">
            <tr>
              <th className="th">Student</th>
              <th className="th">Status</th>
              <th className="th">Joined</th>
              <th className="th">Left</th>
              <th className="th">Time in class</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.map((r) => {
              const style = STATUS_STYLE[r.status] || STATUS_STYLE.INVITED;
              return (
                <tr key={r.student._id} className="transition-colors hover:bg-ink-50/60">
                  <td className="td">
                    <Link to={`${basePath}/students/${r.student._id}`} className="flex items-center gap-3">
                      <Avatar name={r.student.name} src={r.student.avatarUrl} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-ink-900">
                          {r.student.name}
                        </span>
                        <span className="block truncate text-xs text-ink-500">{r.student.email}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="td">
                    <span className="inline-flex items-center gap-2">
                      <style.Icon
                        className={`h-4 w-4 ${
                          r.status === 'ATTENDED'
                            ? 'text-emerald-500'
                            : r.status === 'ABSENT'
                              ? 'text-rose-500'
                              : 'text-ink-400'
                        }`}
                      />
                      <Badge tone={style.tone}>{style.label}</Badge>
                    </span>
                  </td>
                  <td className="td text-ink-600">{r.joinTime ? formatTime(r.joinTime) : '-'}</td>
                  <td className="td text-ink-600">{r.leaveTime ? formatTime(r.leaveTime) : '-'}</td>
                  <td className="td tabular-nums">
                    {r.durationMinutes ? `${r.durationMinutes} min` : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Card className="p-5">
        <p className="mb-2 text-sm font-medium text-ink-700">Attendance rate</p>
        <ProgressBar value={stats.attendancePercentage} size="lg" showLabel />
      </Card>
    </div>
  );
}
