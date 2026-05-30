import NavbarClient from './NavbarClient';
import { getLivePulseSnapshot } from '@/lib/services/live-pulse';
import { formatTimeAgo } from '@/lib/utils/time';
import { shouldRenderStatusPill } from '@/lib/ui/status-chrome';

export default async function Navbar({ showStatusChrome = true }: { showStatusChrome?: boolean }) {
  let statusLabel: string | null = null;
  let updatedAgo: string | null = null;
  let reports: number | null = null;
  let statusTone: 'operational' | 'degraded' | 'down' | 'maintenance' | 'unknown' = 'unknown';

  if (showStatusChrome) {
    const snapshot = await getLivePulseSnapshot();
    if (
      shouldRenderStatusPill({
        status: snapshot.status,
        lastUpdated: snapshot.lastUpdated,
        communityReports: snapshot.communityReports,
      })
    ) {
      const updated = formatTimeAgo(snapshot.lastUpdated);
      if (updated !== '—') {
        statusLabel = 'Monitoring: Active';
        updatedAgo = updated;
        reports = snapshot.communityReports;
        statusTone = 'operational';
      }
    }
  }

  return (
    <NavbarClient
      statusLabel={statusLabel}
      updatedAgo={updatedAgo}
      reports={reports}
      statusTone={statusTone}
    />
  );
}
