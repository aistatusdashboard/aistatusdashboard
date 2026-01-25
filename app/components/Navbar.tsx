import NavbarClient from './NavbarClient';
import { getLivePulseSnapshot } from '@/lib/services/live-pulse';
import { formatTimeAgo } from '@/lib/utils/time';

function formatStatusLabel(status: string) {
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
      return 'Unknown';
  }
}

export default async function Navbar() {
  const snapshot = await getLivePulseSnapshot();
  const updatedAgo = formatTimeAgo(snapshot.lastUpdated);
  const reports = snapshot.communityReports ?? '—';
  const statusLabel = formatStatusLabel(snapshot.status);

  return (
    <NavbarClient
      statusLabel={statusLabel}
      updatedAgo={updatedAgo}
      reports={reports}
      statusTone={snapshot.status}
    />
  );
}
