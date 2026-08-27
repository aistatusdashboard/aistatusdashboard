import NavbarClient from './NavbarClient';
import { getLivePulseSnapshot } from '@/lib/services/live-pulse';
import { formatTimeAgo } from '@/lib/utils/time';

export default async function Navbar() {
  let statusLabel: string | null = null;
  let updatedAgo: string | null = null;
  let statusTone: 'operational' | 'degraded' | 'down' | 'maintenance' | 'unknown' = 'unknown';

  try {
    const snapshot = await getLivePulseSnapshot();
    const updated = formatTimeAgo(snapshot.lastUpdated);
    if (updated !== '—') {
      statusLabel = 'Live';
      updatedAgo = updated;
      statusTone = 'operational';
    }
  } catch {
    // The navbar renders without the pill when live data is unavailable.
  }

  return (
    <NavbarClient
      statusLabel={statusLabel}
      updatedAgo={updatedAgo}
      reports={null}
      statusTone={statusTone}
    />
  );
}
