import NavbarClient from './NavbarClient';
import { getLivePulseSnapshot } from '@/lib/services/live-pulse';
import { formatTimeAgo } from '@/lib/utils/time';
import { shouldRenderStatusPill } from '@/lib/ui/status-chrome';

function formatStatusLabel(status: string): string | null {
  switch (status) {
    case 'operational':
      return 'Operational';
    case 'degraded':
      return 'Degraded';
    case 'down':
      return 'Down';
    case 'maintenance':
      return 'Maintenance';
    default:
      return null;
  }
}

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
      const formatted = formatStatusLabel(snapshot.status);
      const updated = formatTimeAgo(snapshot.lastUpdated);
      if (formatted && updated !== '—') {
        statusLabel = formatted;
        updatedAgo = updated;
        reports = snapshot.communityReports;
        statusTone = snapshot.status;
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
