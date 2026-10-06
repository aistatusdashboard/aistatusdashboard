interface SkeletonProps {
  className?: string;
}

export function SkeletonLine({ className = '' }: SkeletonProps) {
  return (
    <div className={`animate-pulse bg-slate-200/70 dark:bg-slate-700/70 rounded-sm h-4 ${className}`} />
  );
}

export function SkeletonCard({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse surface-card p-6 ${className}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="h-6 bg-slate-200/70 dark:bg-slate-700/70 rounded-sm w-32" />
        <div className="h-6 bg-slate-200/70 dark:bg-slate-700/70 rounded-sm w-20" />
      </div>
      <div className="space-y-3">
        <div className="h-4 bg-slate-200/70 dark:bg-slate-700/70 rounded-sm w-full" />
        <div className="h-4 bg-slate-200/70 dark:bg-slate-700/70 rounded-sm w-3/4" />
        <div className="h-4 bg-slate-200/70 dark:bg-slate-700/70 rounded-sm w-1/2" />
      </div>
    </div>
  );
}

export function SkeletonStatus({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse surface-card p-6 ${className}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-slate-200/70 dark:bg-slate-700/70 rounded-full" />
          <div className="h-6 bg-slate-200/70 dark:bg-slate-700/70 rounded-sm w-24" />
        </div>
        <div className="h-6 bg-slate-200/70 dark:bg-slate-700/70 rounded-sm w-16" />
      </div>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="h-4 bg-slate-200/70 dark:bg-slate-700/70 rounded-sm" />
        <div className="h-4 bg-slate-200/70 dark:bg-slate-700/70 rounded-sm" />
      </div>
      <div className="h-4 bg-slate-200/70 dark:bg-slate-700/70 rounded-sm w-3/4" />
    </div>
  );
}

export function SkeletonComment({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse surface-card p-4 ${className}`}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="h-8 w-8 bg-slate-200/70 dark:bg-slate-700/70 rounded-full" />
        <div className="h-4 bg-slate-200/70 dark:bg-slate-700/70 rounded-sm w-20" />
        <div className="h-4 bg-slate-200/70 dark:bg-slate-700/70 rounded-sm w-16" />
      </div>
      <div className="space-y-2">
        <div className="h-4 bg-slate-200/70 dark:bg-slate-700/70 rounded-sm w-full" />
        <div className="h-4 bg-slate-200/70 dark:bg-slate-700/70 rounded-sm w-4/5" />
        <div className="h-4 bg-slate-200/70 dark:bg-slate-700/70 rounded-sm w-3/5" />
      </div>
    </div>
  );
}

export function SkeletonList({ count = 3, className = '' }: SkeletonProps & { count?: number }) {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonStatus key={i} />
      ))}
    </div>
  );
}
