import { Timestamp } from 'firebase-admin/firestore';
import { getDb } from '@/lib/db/firestore';
import { log } from '@/lib/utils/logger';

export async function getCommunityReportCount(windowMinutes = 10): Promise<number | null> {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000);
  const db = getDb();

  try {
    const snapshot = await db
      .collection('casual_reports')
      .where('createdAt', '>=', Timestamp.fromDate(since))
      .get();
    const reports = snapshot.docs.map((doc) => doc.data());
    return reports.filter((report) => report.issue === true).length;
  } catch (error: any) {
    if (error?.code === 9 || error?.message?.includes('index')) {
      try {
        const fallback = await db.collection('casual_reports').limit(200).get();
        const reports = fallback.docs.map((doc) => doc.data()).filter((report) => {
          const ts = report.createdAt?.toDate?.()?.getTime?.() || 0;
          return ts >= since.getTime();
        });
        return reports.filter((report) => report.issue === true).length;
      } catch (innerError) {
        log('warn', 'Fallback community reports query failed', { innerError });
        return null;
      }
    }
    log('warn', 'Community reports query failed', { error });
    return null;
  }
}
