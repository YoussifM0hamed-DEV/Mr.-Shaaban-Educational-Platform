import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity } from 'lucide-react';
import { analyticsApi } from '../../services/endpoints';
import { onSocketEvent, SOCKET_EVENTS } from '../../services/socket';
import ActivityTimeline from '../../components/shared/ActivityTimeline';
import {
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Pagination,
  Select,
  SkeletonCard,
} from '../../components/ui';
import { ACTIVITY_LABELS } from '../../utils/constants';

const TYPE_OPTIONS = Object.entries(ACTIVITY_LABELS).map(([value, label]) => ({ value, label }));

/** Platform-wide feed of what students actually did. */
export default function ActivityPage() {
  const queryClient = useQueryClient();
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['activities', type, page],
    queryFn: () => analyticsApi.activities({ type: type || undefined, page, limit: 30 }),
    keepPreviousData: true,
  });

  // New tracked events arrive over the socket; refresh only the first page.
  useEffect(() => {
    const off = onSocketEvent(SOCKET_EVENTS.ACTIVITY, () => {
      if (page === 1) queryClient.invalidateQueries({ queryKey: ['activities'] });
    });
    return off;
  }, [page, queryClient]);

  const items = data?.data ?? [];

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <Select
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(1);
          }}
          placeholder="All activity types"
          options={TYPE_OPTIONS}
          className="max-w-sm"
        />
      </Card>

      <Card>
        <CardHeader
          title="Student activity"
          subtitle="Every tracked educational event, newest first"
        />

        {isLoading ? (
          <div className="space-y-3 p-5">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : isError ? (
          <ErrorState message={error?.message} onRetry={refetch} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No activity recorded"
            description="Activity appears as soon as a student opens a lesson or watches a video."
            className="py-12"
          />
        ) : (
          <div className="p-5">
            <ActivityTimeline items={items} showStudent />
          </div>
        )}

        <Pagination pagination={data?.pagination} onPageChange={setPage} />
      </Card>
    </div>
  );
}
