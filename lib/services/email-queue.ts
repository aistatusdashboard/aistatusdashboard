import { getDb } from '@/lib/db/firestore';
import { EmailUtils } from '@/lib/utils/email';
import { renderEmailTemplate } from '@/lib/utils/email-templates';
import { config } from '@/lib/config';

const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 50;

export type EmailQueueResult = {
  processed: number;
  successes: number;
  failures: number;
  message?: string;
};

// Draining the queue used to have its own Cloud Scheduler job on a separate
// 10-minute cadence. It is a few milliseconds of work that only has anything
// to do once the status cycle has queued something, so it now runs at the tail
// of that cycle instead — one less scheduled job to pay for, and no window
// where a queued notification waits on a timer that just fired.
export async function drainEmailQueue(): Promise<EmailQueueResult> {
  if (!config.email.enabled) {
    return {
      processed: 0,
      successes: 0,
      failures: 0,
      message: 'Email sending is disabled (set APP_ENABLE_EMAIL=true to enable).',
    };
  }

  const db = getDb();
  const snapshot = await db
    .collection('emailQueue')
    .where('status', '==', 'pending')
    .limit(BATCH_SIZE)
    .get();

  if (snapshot.empty) {
    return { processed: 0, successes: 0, failures: 0, message: 'No pending notifications found in the queue.' };
  }

  const results = await Promise.allSettled(
    snapshot.docs.map(async (doc) => {
      const data = doc.data();
      const attempts = typeof data.attempts === 'number' ? data.attempts : 0;

      if (!data.to || typeof data.to !== 'string') {
        await doc.ref.update({
          status: 'failed',
          attempts: attempts + 1,
          lastError: 'Missing recipient (to)',
          updatedAt: new Date(),
        });
        return false;
      }

      let subject: string | undefined = typeof data.subject === 'string' ? data.subject : undefined;
      let html: string | undefined = typeof data.html === 'string' ? data.html : undefined;

      if (!subject || !html) {
        const template = typeof data.template === 'string' ? data.template : undefined;
        const rendered = template ? renderEmailTemplate(template, data.data || {}) : null;
        if (rendered) {
          subject = rendered.subject;
          html = rendered.html;
        }
      }

      if (!subject || !html) {
        await doc.ref.update({
          status: 'failed',
          attempts: attempts + 1,
          lastError: 'Missing subject/html and no renderable template',
          updatedAt: new Date(),
        });
        return false;
      }

      const success = await EmailUtils.sendEmail(data.to, subject, html);

      if (success) {
        await doc.ref.update({ status: 'sent', sentAt: new Date(), subject, updatedAt: new Date() });
      } else {
        const nextAttempts = attempts + 1;
        await doc.ref.update({
          status: nextAttempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
          attempts: nextAttempts,
          lastError: 'Send failed',
          updatedAt: new Date(),
        });
      }
      return success;
    })
  );

  const processed = results.length;
  const successes = results.filter((r) => r.status === 'fulfilled' && r.value).length;
  return { processed, successes, failures: processed - successes };
}
