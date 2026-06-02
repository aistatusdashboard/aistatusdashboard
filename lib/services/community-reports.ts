import { log } from '@/lib/utils/logger';
import { summarizeRecentCasualReports } from '@/lib/services/casual-report-maintenance';

export async function getCommunityReportCount(windowMinutes = 10): Promise<number | null> {
  try {
    const summary = await summarizeRecentCasualReports({
      secondsAgo: windowMinutes * 60,
    });
    return summary.issueReportsFiltered;
  } catch (error: any) {
    log('warn', 'Community reports query failed', { error });
    return null;
  }
}
