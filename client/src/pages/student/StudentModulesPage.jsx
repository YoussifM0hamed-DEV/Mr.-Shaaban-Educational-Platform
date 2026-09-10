import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BookOpen } from 'lucide-react';
import { moduleApi } from '../../services/endpoints';
import { useDebounced } from '../../hooks/useDebounced';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  ProgressBar,
  SearchInput,
  SkeletonCard,
} from '../../components/ui';
import { pluralize } from '../../utils/format';

const COLOR_BAR = {
  indigo: 'from-brand-500 to-brand-700',
  emerald: 'from-emerald-500 to-emerald-700',
  amber: 'from-amber-500 to-amber-600',
  rose: 'from-rose-500 to-rose-700',
  sky: 'from-sky-500 to-sky-700',
  violet: 'from-violet-500 to-violet-700',
};

export default function StudentModulesPage() {
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search, 250);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['modules'],
    queryFn: moduleApi.list,
  });

  const modules = (data?.data ?? []).filter((m) =>
    `${m.title} ${m.description || ''}`.toLowerCase().includes(debounced.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <SearchInput
        value={search}
        onChange={setSearch}
        onClear={() => setSearch('')}
        placeholder="Search modules"
        className="max-w-md"
      />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : isError ? (
        <ErrorState message={error?.message} onRetry={refetch} />
      ) : modules.length === 0 ? (
        <Card>
          <EmptyState
            icon={BookOpen}
            title={debounced ? 'No modules match' : 'No modules yet'}
            description={
              debounced
                ? 'Try a different search term.'
                : 'Your teacher has not published any modules yet.'
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((m) => (
            <Link key={m._id} to={`/student/modules/${m._id}`} className="card card-hover overflow-hidden">
              <div className={`bg-gradient-to-br p-5 ${COLOR_BAR[m.color] || COLOR_BAR.indigo}`}>
                <BookOpen className="h-6 w-6 text-white/90" />
                <h3 className="mt-3 line-clamp-2 text-lg font-bold text-white">{m.title}</h3>
              </div>

              <div className="p-5">
                {m.description ? (
                  <p className="line-clamp-2 text-sm text-ink-600">{m.description}</p>
                ) : null}

                <div className="mt-4 flex items-center justify-between gap-3">
                  <Badge tone="neutral">{pluralize(m.lessonCount || 0, 'lesson')}</Badge>
                  {m.completedLessons !== undefined ? (
                    <span className="text-xs text-ink-500">
                      {m.completedLessons} completed
                    </span>
                  ) : null}
                </div>

                <ProgressBar value={m.progress || 0} className="mt-3" showLabel />

                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600">
                  {m.progress > 0 ? 'Continue' : 'Start'}
                  <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
