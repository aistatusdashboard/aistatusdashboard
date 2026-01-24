import { getLivePulseSnapshot } from '@/lib/services/live-pulse';
import { formatTimeAgo } from '@/lib/utils/time';
import { headers } from 'next/headers';

export default async function TodayStrip() {
  const headerList = headers();
  const rawPath =
    headerList.get('x-pathname') ||
    headerList.get('x-forwarded-uri') ||
    headerList.get('x-original-url') ||
    headerList.get('x-url') ||
    headerList.get('x-rewrite-url') ||
    headerList.get('x-invoke-path') ||
    '';
  const pathname = rawPath.split('?')[0];
  if (pathname === '/') return null;

  const snapshot = await getLivePulseSnapshot();
  const updatedAgo = formatTimeAgo(snapshot.lastUpdated);
  const reports = snapshot.communityReports !== null ? snapshot.communityReports : '—';

  return (
    <div className="today-strip w-full bg-slate-900/90 text-white text-xs" data-role="today-strip">
      <div className="max-w-6xl mx-auto px-4 py-2 flex flex-wrap items-center justify-center gap-2">
        <span>Last check: {updatedAgo}</span>
        <span aria-hidden="true">•</span>
        <span>Updates every 60s</span>
        <span aria-hidden="true">•</span>
        <span>Community reports: {reports} in last 10 min</span>
      </div>
    </div>
  );
}
