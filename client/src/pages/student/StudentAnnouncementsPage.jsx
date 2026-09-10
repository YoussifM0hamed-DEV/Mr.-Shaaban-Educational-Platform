import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Megaphone, Pin } from 'lucide-react';
import { announcementApi } from '../../services/endpoints';
import { useAuth } from '../../context/AuthContext';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Pagination,
  SkeletonCard,
} from '../../components/ui';
import { formatDateTime, relativeTime } from '../../utils/format';

export default function StudentAnnouncementsPage() {
  const { platform } = useAuth();
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['announcements', page],
    queryFn: () => announcementApi.list({ page, limit: 10 }),
    keepPreviousData: true,
  });

  const items = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (isError) return <ErrorState message={error?.message} onRetry={refetch} />;

  if (!items.length) {
    return (
      <Card>
        <EmptyState
          icon={Megaphone}
          title="No announcements"
          description={`${platform?.teacherName || 'Your teacher'} has not posted anything yet.`}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((a) => (
        <Card key={a._id} className={a.pinned ? 'border-brand-200 p-5' : 'p-5'}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-ink-900">{a.title}</h3>
                {a.pinned ? (
                  <Badge tone="brand" icon={Pin}>
                    Pinned
                  </Badge>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs text-ink-400" title={formatDateTime(a.createdAt)}>
                {relativeTime(a.createdAt)}
                {a.createdBy?.name ? ` - ${a.createdBy.name}` : ''}
              </p>
            </div>
          </div>

          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-700">{a.body}</p>
        </Card>
      ))}

      <Pagination pagination={data?.pagination} onPageChange={setPage} />
    </div>
  );
}
